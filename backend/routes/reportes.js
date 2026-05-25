const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit-table');
const path = require('path');
const fs = require('fs');

router.use(authenticateToken);

// --- FUNCIÓN AYUDANTE: ENCABEZADO DINÁMICO DE EMPRESA ---
async function dibujarEncabezadoEmpresa(doc, ownerId) {
    const [empresa] = await db.query(
        'SELECT razon_social, numero_documento, telefono, direccion, ciudad, logo_url FROM owners WHERE id = ?',
        [ownerId]
    );
    
    const datos = empresa.length > 0 ? empresa[0] : {};

    // Pintar Logo
    if (datos.logo_url) {
        const logoPath = path.join(__dirname, '..', datos.logo_url); 
        if (fs.existsSync(logoPath)) {
            doc.image(logoPath, 30, 20, { width: 60 }); 
        }
    }

    // Pintar Texto
    let currentY = 25; 
    doc.fontSize(14).font('Helvetica-Bold')
       .text(datos.razon_social || 'NEXUS INMOBILIARIA', 100, currentY, { align: 'right' });
    currentY += 20;
    
    doc.fontSize(9).font('Helvetica')
       .text(`NIT/Doc: ${datos.numero_documento || 'No registrado'}`, 100, currentY, { align: 'right' });
    currentY += 12;
    
    if(datos.direccion) {
        doc.text(datos.direccion + (datos.ciudad ? `, ${datos.ciudad}` : ''), 100, currentY, { align: 'right' });
        currentY += 12;
    }
    if(datos.telefono) {
        doc.text(`Tel: ${datos.telefono}`, 100, currentY, { align: 'right' });
    }
    
    doc.moveDown();
    const headerBottom = Math.max(currentY + 10, 90); 
    doc.moveTo(30, headerBottom).lineTo(570, headerBottom).stroke(); 
    doc.y = headerBottom + 20; 
}

//--- UTILIDAD: Obtener datos filtrados para ventas ---
async function obtenerDatosVentas(ownerId, fechaInicio, fechaFin) {
    let query = `
        SELECT 
            s.contract_date, s.final_price, s.payment_method,
            u.unit_code, p.nombre as proyecto,
            CONCAT(c.primer_nombre, ' ', c.primer_apellido) as cliente,
            c.numero_documento
        FROM sales s
        JOIN units u ON s.unit_id = u.id
        JOIN projects p ON u.project_id = p.id
        JOIN clients c ON s.client_id = c.id
        WHERE p.owner_id = ? AND s.contract_status = 'activo'
    `;
    const params = [ownerId];
    if (fechaInicio && fechaFin) {
        query += ' AND s.contract_date BETWEEN ? AND ?';
        params.push(fechaInicio, fechaFin);
    }
    query += ' ORDER BY s.contract_date DESC';
    return await db.query(query, params);
}

// 1. REPORTE DE VENTAS (EXCEL)
router.get('/ventas/excel', async (req, res) => {
    const { inicio, fin } = req.query;
    const targetOwnerId = req.user.isOwner ? req.user.id : req.user.ownerId;

    try {
        const [ventas] = await obtenerDatosVentas(targetOwnerId, inicio, fin);
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Reporte de Ventas');

        sheet.columns = [
            { header: 'Fecha', key: 'date', width: 15 },
            { header: 'Proyecto', key: 'proj', width: 25 },
            { header: 'Unidad', key: 'unit', width: 15 },
            { header: 'Cliente', key: 'client', width: 30 },
            { header: 'Documento', key: 'doc', width: 15 },
            { header: 'Método', key: 'method', width: 15 },
            { header: 'Valor Venta', key: 'price', width: 20 },
        ];

        sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0d6efd' } };

        let total = 0;
        ventas.forEach(v => {
            total += parseFloat(v.final_price);
            sheet.addRow({
                date: new Date(v.contract_date).toLocaleDateString(),
                proj: v.proyecto,
                unit: v.unit_code,
                client: v.cliente,
                doc: v.numero_documento,
                method: v.payment_method,
                price: parseFloat(v.final_price)
            });
        });

        sheet.addRow({});
        const filaTotal = sheet.addRow({ method: 'TOTAL VENDIDO:', price: total });
        filaTotal.font = { bold: true };

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Reporte_Ventas.xlsx');
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error(error);
        res.status(500).send('Error generando Excel');
    }
});

// 2. REPORTE DE VENTAS (PDF)
router.get('/ventas/pdf', async (req, res) => {
    const { inicio, fin } = req.query;
    const targetOwnerId = req.user.isOwner ? req.user.id : req.user.ownerId;

    try {
        const [ventas] = await obtenerDatosVentas(targetOwnerId, inicio, fin);
        const doc = new PDFDocument({ margin: 30, size: 'A4' });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=Reporte_Ventas.pdf');
        doc.pipe(res);

        await dibujarEncabezadoEmpresa(doc, targetOwnerId);

        doc.fontSize(18).text('Reporte General de Ventas', { align: 'center' });
        doc.fontSize(10).text(`Generado el: ${new Date().toLocaleString()}`, { align: 'center' });
        doc.moveDown();

        const table = {
            title: "Detalle de Transacciones",
            headers: ["Fecha", "Proyecto", "Lote", "Cliente", "Valor"],
            rows: ventas.map(v => [
                new Date(v.contract_date).toLocaleDateString(),
                v.proyecto,
                v.unit_code,
                v.cliente,
                `$ ${new Intl.NumberFormat('es-CO').format(v.final_price)}`
            ])
        };

        const tableWidth = doc.page.width - (doc.page.margins.left + doc.page.margins.right);
        await doc.table(table, {
            width: tableWidth,
            x: doc.page.margins.left,
            prepareHeader: () => doc.font("Helvetica-Bold").fontSize(10),
            prepareRow: (row, indexColumn, indexRow, rectRow) => {
                doc.font("Helvetica").fontSize(10);
                indexColumn === 0 && doc.addBackground(rectRow, (indexRow % 2 ? 'white' : '#f0f0f0'), 0.15);
            }
        });

        const total = ventas.reduce((sum, v) => sum + parseFloat(v.final_price), 0);
        doc.moveDown();
        doc.font("Helvetica-Bold").fontSize(12).text(`TOTAL VENDIDO: $ ${new Intl.NumberFormat('es-CO').format(total)}`, { align: 'right' });
        doc.end();
    } catch (error) {
        console.error(error);
        res.status(500).send('Error generando PDF');
    }
});

// 3. REPORTE INDIVIDUAL CLIENTE (PDF)
router.get('/cliente/pdf', async (req, res) => {
    // (Esta ruta se mantiene igual que en tu código anterior)
    const { documento } = req.query;
    const targetOwnerId = req.user.isOwner ? req.user.id : req.user.ownerId;

    try {
        const [clientes] = await db.query(
            'SELECT * FROM clients WHERE numero_documento = ? AND owner_id = ?',
            [documento, targetOwnerId]
        );

        if (clientes.length === 0) return res.status(404).send('Cliente no encontrado');
        const cliente = clientes[0];

        const [ventas] = await db.query(`
            SELECT s.id, s.contract_date, s.final_price, s.balance,
            u.unit_code, p.nombre as proyecto, p.ubicacion
            FROM sales s
            JOIN units u ON s.unit_id = u.id
            JOIN projects p ON u.project_id = p.id
            WHERE s.client_id = ?
        `, [cliente.id]);

        const doc = new PDFDocument({ margin: 30, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Estado_Cuenta_${documento}.pdf`);
        doc.pipe(res);

        await dibujarEncabezadoEmpresa(doc, targetOwnerId);

        doc.fontSize(16).font("Helvetica-Bold").text('ESTADO DE CUENTA POR CLIENTE', { align: 'center' });
        doc.moveDown();

        doc.fontSize(10).font("Helvetica-Bold").text('DATOS DEL CLIENTE');
        doc.font("Helvetica").text(`Nombre: ${cliente.primer_nombre} ${cliente.primer_apellido} ${cliente.segundo_apellido || ""}`);
        doc.text(`Identificación: ${cliente.tipo_documento} ${cliente.numero_documento}`);
        doc.text(`Contacto: ${cliente.phone || ""} | ${cliente.email || ""}`);
        doc.text(`Fecha Emisión: ${new Date().toLocaleString()}`);
        doc.moveDown();
        doc.moveTo(30, doc.y).lineTo(570, doc.y).stroke();
        doc.moveDown();

        if (ventas.length === 0) {
            doc.font("Helvetica-Oblique").text("Este cliente no tiene propiedades registradas activas.");
        }

        const tableWidth = doc.page.width - (doc.page.margins.left + doc.page.margins.right);

        for (const venta of ventas) {
            doc.fontSize(12).fillColor('#0d6efd').font("Helvetica-Bold")
                .text(`PROYECTO: ${venta.proyecto} - UNIDAD: ${venta.unit_code}`);
            
            doc.fillColor('black').fontSize(10).font("Helvetica")
                .text(`Valor Negocio: $ ${new Intl.NumberFormat('es-CO').format(venta.final_price)} | Saldo Pendiente: $ ${new Intl.NumberFormat('es-CO').format(venta.balance)}`);
            doc.moveDown(0.5);

            const [pagos] = await db.query(`
                SELECT quota_number, due_date, amount, status, payment_date
                FROM payment_plan WHERE sale_id = ? ORDER BY quota_number ASC
            `, [venta.id]);

            if (pagos.length > 0) {
                const table = {
                    headers: ["Cuota", "Vencimiento", "Valor", "Estado", "Fecha Pago"],
                    rows: pagos.map(p => [
                        `#${p.quota_number}`,
                        new Date(p.due_date).toLocaleDateString(),
                        `$ ${new Intl.NumberFormat('es-CO').format(p.amount)}`,
                        p.status.toUpperCase(),
                        p.payment_date ? new Date(p.payment_date).toLocaleDateString() : '-'
                    ])
                };

                await doc.table(table, {
                    width: tableWidth,
                    x: doc.page.margins.left,
                    prepareHeader: () => doc.font("Helvetica-Bold").fontSize(8),
                    prepareRow: (row, indexColumn, indexRow, rectRow) => {
                        doc.font("Helvetica").fontSize(8);
                        indexColumn === 0 && doc.addBackground(rectRow, (indexRow % 2 ? 'white' : '#f5f5f5'), 0.15);
                    }
                });
            } else {
                doc.fontSize(9).text("Venta de contado o sin plan de pagos registrado.");
            }
            doc.moveDown(1.5);
        }
        doc.end();
    } catch (error) {
        console.error(error);
        if (!res.headersSent) res.status(500).send('Error generando reporte');
    }
});

// -- NUEVA UTILIDAD: Obtener Resumen de Cartera Agrupado por Proyecto --
async function obtenerResumenCartera(ownerId) {
    const query = `
        SELECT 
            p.nombre as proyecto,
            COUNT(DISTINCT u.id) as total_lotes_vendidos,
            SUM(CASE WHEN s.payment_method = 'contado' THEN 1 ELSE 0 END) as lotes_contado,
            SUM(CASE WHEN s.payment_method = 'credito' THEN 1 ELSE 0 END) as lotes_financiados,
            
            -- Dinero recaudado (Sumamos cuotas pagadas + pagos iniciales/contado que no estén en plan)
            -- Nota: Para simplificar, asumimos que 'amount' en plan de pagos cubre todo.
            -- Si usas down_payment fuera del plan, habría que sumarlo aparte.
            -- Aquí sumamos todo lo que está en payment_plan con status 'pagado'.
            COALESCE((
                SELECT SUM(pp.amount) 
                FROM payment_plan pp 
                JOIN sales s2 ON pp.sale_id = s2.id
                JOIN units u2 ON s2.unit_id = u2.id
                WHERE u2.project_id = p.id AND pp.status = 'pagado'
            ), 0) + 
            -- Sumar iniciales de ventas de contado que no generan plan de pagos
            COALESCE(SUM(CASE WHEN s.payment_method = 'contado' THEN s.final_price ELSE 0 END), 0) 
            as total_ingresado,

            -- Dinero por cobrar (Sumamos cuotas pendientes/vencidas)
            COALESCE((
                SELECT SUM(pp.amount) 
                FROM payment_plan pp 
                JOIN sales s3 ON pp.sale_id = s3.id
                JOIN units u3 ON s3.unit_id = u3.id
                WHERE u3.project_id = p.id AND (pp.status = 'pendiente' OR pp.status = 'vencido')
            ), 0) as total_por_cobrar,

            -- Total de lotes del proyecto (independiente si están vendidos o no)
            (SELECT COUNT(*) FROM units u_all WHERE u_all.project_id = p.id) as total_lotes_proyecto

        FROM projects p
        LEFT JOIN units u ON p.id = u.project_id AND (u.status = 'vendido' OR u.status = 'cedido')
        LEFT JOIN sales s ON u.id = s.unit_id AND s.contract_status = 'activo'
        WHERE p.owner_id = ? AND p.is_active = 1
        GROUP BY p.id, p.nombre
    `;
    
    return await db.query(query, [ownerId]);
}

// 4. REPORTE CARTERA AGRUPADO (EXCEL)
router.get('/cartera/excel', async (req, res) => {
    const targetOwnerId = req.user.isOwner ? req.user.id : req.user.ownerId;

    try {
        const [datos] = await obtenerResumenCartera(targetOwnerId);

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Resumen Financiero');

        sheet.columns = [
            { header: 'Proyecto', key: 'proy', width: 30 },
            { header: 'Total Lotes', key: 'tot', width: 15 },
            { header: 'Vendidos', key: 'ven', width: 15 },
            { header: 'Contado', key: 'cont', width: 15 },
            { header: 'Financiados', key: 'cred', width: 15 },
            { header: 'Total Recaudado', key: 'ingreso', width: 25 },
            { header: 'Total Por Cobrar', key: 'cobrar', width: 25 },
        ];

        sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFffc107' } };

        let sumIngreso = 0;
        let sumCobrar = 0;

        datos.forEach(d => {
            sumIngreso += parseFloat(d.total_ingresado);
            sumCobrar += parseFloat(d.total_por_cobrar);

            sheet.addRow({
                proy: d.proyecto,
                tot: d.total_lotes_proyecto,
                ven: d.total_lotes_vendidos,
                cont: d.lotes_contado,
                cred: d.lotes_financiados,
                ingreso: parseFloat(d.total_ingresado),
                cobrar: parseFloat(d.total_por_cobrar)
            });
        });

        sheet.addRow({});
        const filaTotal = sheet.addRow({ 
            proy: 'TOTALES GENERALES:', 
            ingreso: sumIngreso, 
            cobrar: sumCobrar 
        });
        filaTotal.font = { bold: true, size: 12 };

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Resumen_Cartera.xlsx');

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error(error);
        res.status(500).send('Error generando Excel');
    }
});

// 5. REPORTE CARTERA AGRUPADO (PDF)
router.get('/cartera/pdf', async (req, res) => {
    const targetOwnerId = req.user.isOwner ? req.user.id : req.user.ownerId;

    try {
        const [datos] = await obtenerResumenCartera(targetOwnerId);

        const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' }); // Horizontal para más espacio

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=Resumen_Cartera.pdf');
        doc.pipe(res);

        await dibujarEncabezadoEmpresa(doc, targetOwnerId);

        doc.fontSize(18).text('Informe Consolidado de Cartera', { align: 'center' });
        doc.fontSize(10).text(`Generado: ${new Date().toLocaleString()}`, { align: 'center' });
        doc.moveDown();

        const table = {
            headers: [
                "Proyecto", 
                "Total Lotes", 
                "Vendidos", 
                "Contado", 
                "Financiados", 
                "Recaudado ($)", 
                "Por Cobrar ($)"
            ],
            rows: datos.map(d => [
                d.proyecto,
                d.total_lotes_proyecto,
                d.total_lotes_vendidos,
                d.lotes_contado,
                d.lotes_financiados,
                `$ ${new Intl.NumberFormat('es-CO').format(d.total_ingresado)}`,
                `$ ${new Intl.NumberFormat('es-CO').format(d.total_por_cobrar)}`
            ])
        };

        const tableWidth = doc.page.width - (doc.page.margins.left + doc.page.margins.right);

        await doc.table(table, {
            width: tableWidth,
            x: doc.page.margins.left,
            prepareHeader: () => doc.font("Helvetica-Bold").fontSize(10),
            prepareRow: (row, indexColumn, indexRow, rectRow) => {
                doc.font("Helvetica").fontSize(10);
                indexColumn === 0 && doc.addBackground(rectRow, (indexRow % 2 ? 'white' : '#f0f0f0'), 0.15);
            }
        });

        const sumIngreso = datos.reduce((sum, d) => sum + parseFloat(d.total_ingresado), 0);
        const sumCobrar = datos.reduce((sum, d) => sum + parseFloat(d.total_por_cobrar), 0);

        doc.moveDown();
        doc.font("Helvetica-Bold").fontSize(12);
        doc.text(`TOTAL RECAUDADO: $ ${new Intl.NumberFormat('es-CO').format(sumIngreso)}`, { align: 'right' });
        doc.text(`TOTAL POR COBRAR: $ ${new Intl.NumberFormat('es-CO').format(sumCobrar)}`, { align: 'right' });

        doc.end();

    } catch (error) {
        console.error(error);
        res.status(500).send('Error generando PDF');
    }
});

module.exports = router;