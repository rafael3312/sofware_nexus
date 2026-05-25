const express = require('express');
const db = require('../config/database');
// Importamos requireOwner para proteger la ruta
const { authenticateToken, requireOwner } = require('../middleware/auth');
const router = express.Router();

router.use(authenticateToken);

// 1. RESUMEN DE KPIS Y GRÁFICAS
// AGREGADO: middleware 'requireOwner'
router.get('/resumen', requireOwner, async (req, res) => {
    try {
        const targetOwnerId = req.user.id; // Al ser requireOwner, req.user.id SIEMPRE es el dueño

        // --- 1. KPIS DE INVENTARIO ---
        const [kpis] = await db.query(`
            SELECT 
                COUNT(*) as total_units,
                SUM(CASE WHEN u.status = 'disponible' THEN 1 ELSE 0 END) as available,
                SUM(CASE WHEN u.status = 'vendido' OR u.status = 'separado' THEN 1 ELSE 0 END) as sold
            FROM units u
            JOIN projects p ON u.project_id = p.id
            WHERE p.owner_id = ?
        `, [targetOwnerId]);

        // --- 2. FINANZAS (Cartera) ---
        const [finanzas] = await db.query(`
            SELECT 
                pp.status,
                SUM(pp.amount) as total
            FROM payment_plan pp
            JOIN sales s ON pp.sale_id = s.id
            JOIN units u ON s.unit_id = u.id
            JOIN projects p ON u.project_id = p.id
            WHERE p.owner_id = ?
            GROUP BY pp.status
        `, [targetOwnerId]);

        let recaudado = 0;
        let pendiente = 0;

        finanzas.forEach(f => {
            const valor = parseFloat(f.total || 0);
            if (f.status === 'pagado') recaudado += valor;
            else pendiente += valor; // pendiente + vencido
        });

        // --- 3. GRÁFICA DE VENTAS (Últimos 6 meses) ---
        const [ventasMes] = await db.query(`
            SELECT 
                DATE_FORMAT(s.contract_date, '%Y-%m') as mes,
                SUM(s.final_price) as total_vendido
            FROM sales s
            JOIN units u ON s.unit_id = u.id
            JOIN projects p ON u.project_id = p.id
            WHERE p.owner_id = ?
            GROUP BY mes
            ORDER BY mes ASC
            LIMIT 6
        `, [targetOwnerId]);

        res.json({
            kpis: kpis[0],
            dinero: { recaudado, pendiente },
            grafica: ventasMes
        });

    } catch (error) {
        console.error("Error en dashboard:", error);
        res.status(500).json({ error: 'Error calculando estadísticas' });
    }
});

module.exports = router;