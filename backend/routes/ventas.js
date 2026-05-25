const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

router.use(authenticateToken);

// 1. LISTAR VENTAS
router.get('/', async (req, res) => {
    try {
        const targetOwnerId = req.user.isOwner ? req.user.id : req.user.ownerId;
        const query = `
            SELECT 
                s.id, s.contract_date, s.final_price, s.contract_status,
                u.unit_code, p.nombre as proyecto,
                c.primer_nombre, c.primer_apellido, c.numero_documento
            FROM sales s
            JOIN units u ON s.unit_id = u.id
            JOIN projects p ON u.project_id = p.id
            JOIN clients c ON s.client_id = c.id
            WHERE p.owner_id = ?
            ORDER BY s.contract_date DESC
        `;
        const [ventas] = await db.query(query, [targetOwnerId]);
        res.json(ventas);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al cargar historial' });
    }
});

// 2. CREAR VENTA (Con depuración)
router.post('/', async (req, res) => {
    // 1. Logs de Entrada (Míralos en la terminal del servidor)
    console.log("--- INTENTO DE VENTA ---");
    console.log("Datos recibidos:", req.body);

    let { 
        unit_id, client_id, 
        payment_method, original_price, discount, down_payment, 
        contract_date, notes,
        num_quotas, start_date 
    } = req.body;

    // Conversión segura de tipos
    original_price = parseFloat(original_price) || 0;
    discount = parseFloat(discount) || 0;
    down_payment = parseFloat(down_payment) || 0;
    num_quotas = parseInt(num_quotas) || 0;

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        // 2. Validar Disponibilidad
        const [unitCheck] = await connection.query('SELECT status FROM units WHERE id = ?', [unit_id]);
        if (unitCheck.length === 0 || unitCheck[0].status !== 'disponible') {
            throw new Error('El lote ya no está disponible o no existe.');
        }

        // 3. Registrar Venta
        const sellerType = req.user.isOwner ? 'owner' : 'user';
        const [saleResult] = await connection.query(
            `INSERT INTO sales (
                unit_id, client_id, seller_id, seller_type,
                payment_method, original_price, discount, down_payment, 
                contract_date, notes, contract_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'activo')`,
            [
                unit_id, client_id, req.user.id, sellerType,
                payment_method, original_price, discount, down_payment, 
                contract_date, notes
            ]
        );

        const saleId = saleResult.insertId;
        const finalPrice = original_price - discount;
        const balance = finalPrice - down_payment;

        // Logs de Lógica Financiera
        console.log(`Venta ID: ${saleId} | Metodo: ${payment_method} | Balance: ${balance} | Cuotas: ${num_quotas}`);

        // 4. Generar Plan de Pagos
        // CONDICIÓN CRÍTICA: Debe ser credito, tener deuda y cuotas > 0
        if (payment_method === 'credito' && balance > 0 && num_quotas > 0) {
            
            console.log("Generando plan de pagos..."); // Si no ves esto, la condición falló
            
            const quotaValue = balance / num_quotas;
            
            // Fecha base segura
            const fechaBaseStr = (start_date && start_date !== "") ? start_date : contract_date;
            const fechaBase = new Date(fechaBaseStr);

            const quotasValues = [];

            for (let i = 1; i <= num_quotas; i++) {
                // Cálculo de fecha: Sumar meses a la fecha base
                const fechaCuota = new Date(fechaBase);
                fechaCuota.setMonth(fechaBase.getMonth() + (i - 1));

                quotasValues.push([
                    saleId, 
                    i, 
                    fechaCuota, 
                    quotaValue, 
                    'pendiente'
                ]);
            }

            // Insertar masivo
            await connection.query(
                'INSERT INTO payment_plan (sale_id, quota_number, due_date, amount, status) VALUES ?',
                [quotasValues]
            );
            console.log("Plan de pagos guardado en BD.");

        } else {
            console.log("NO se generó plan de pagos. Razón:", 
                payment_method !== 'credito' ? "No es crédito" : 
                balance <= 0 ? "Saldo es 0" : 
                num_quotas <= 0 ? "0 Cuotas definidas" : "Desconocida"
            );
        }

        // 5. Actualizar Estado Lote
        await connection.query('UPDATE units SET status = ? WHERE id = ?', ['vendido', unit_id]);

        await connection.commit();
        res.status(201).json({ message: 'Venta registrada con éxito' });

    } catch (error) {
        await connection.rollback();
        console.error("ERROR EN TRANSACCIÓN:", error);
        res.status(400).json({ error: error.message || 'Error al procesar la venta' });
    } finally {
        connection.release();
    }
});

module.exports = router;