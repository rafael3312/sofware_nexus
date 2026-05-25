const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);


/*
========================================
1. BUSCAR CARTERA (Cédula o Lote)
========================================
Ahora muestra:

✔ Múltiples lotes
✔ Créditos
✔ Separados
✔ Contado
✔ Todas las cuotas
*/

router.get('/buscar', async (req, res) => {

const { termino } = req.query;

const targetOwnerId =
req.user.isOwner ? req.user.id : req.user.ownerId;

if (!termino) {
return res.status(400).json({
error: 'Escribe un término de búsqueda'
});
}

try {

const search = `%${termino}%`;


/*
CONSULTA PROFESIONAL

Parte desde CLIENTES → UNITS → SALES → PAYMENT_PLAN

Esto permite:

✔ Ver todos los lotes
✔ Ver lotes sin cuotas
✔ Ver separaciones
✔ Ver contado
*/

const query = `

SELECT

c.primer_nombre,
c.primer_apellido,
c.numero_documento,

u.unit_code,
u.status as unit_status,

p.nombre as proyecto,

s.id as sale_id,
s.payment_method,

pp.id,
pp.quota_number,
pp.due_date,
pp.amount,
pp.status,
pp.payment_date

FROM projects p

JOIN units u ON u.project_id = p.id

LEFT JOIN sales s ON s.unit_id = u.id
LEFT JOIN clients c ON (
c.id = s.client_id
OR c.id = u.client_id
)

LEFT JOIN payment_plan pp ON pp.sale_id = s.id

WHERE p.owner_id = ?
AND (
c.numero_documento LIKE ?
OR u.unit_code LIKE ?
)

ORDER BY u.unit_code, pp.due_date

`;


const [rows] = await db.query(query, [
targetOwnerId,
search,
search
]);



/*
========================
CLASIFICACIÓN
========================
*/

const pendientes = [];
const pagados = [];

rows.forEach(r => {


// LOTE SEPARADO (SIN VENTA)
if(!r.sale_id){

pendientes.push({

id: null,

quota_number: "Separación",

due_date: r.separation_deadline || new Date(),

amount: r.separation_amount || 0,

status: "pendiente",

payment_date: null,

primer_nombre: r.primer_nombre,
primer_apellido: r.primer_apellido,
numero_documento: r.numero_documento,

unit_code: r.unit_code,
proyecto: r.proyecto,

tipo: "separado"

});

return;

}


// LOTE CONTADO
if(r.payment_method === 'contado' && !r.id){

pagados.push({

id: null,

quota_number: "Pago contado",

due_date: null,

amount: r.amount || 0,

status: "pagado",

payment_date: r.payment_date,

primer_nombre: r.primer_nombre,
primer_apellido: r.primer_apellido,
numero_documento: r.numero_documento,

unit_code: r.unit_code,
proyecto: r.proyecto,

tipo: "contado"

});

return;

}


// CUOTAS NORMALES

if(!r.id) return;


const cuota = {

id: r.id,

quota_number: r.quota_number,

due_date: r.due_date,

amount: r.amount,

status: r.status,

payment_date: r.payment_date,

primer_nombre: r.primer_nombre,
primer_apellido: r.primer_apellido,
numero_documento: r.numero_documento,

unit_code: r.unit_code,
proyecto: r.proyecto,

tipo: "credito"

};


if(
r.status === 'pendiente'
|| r.status === 'vencido'
){

pendientes.push(cuota);

}else{

pagados.push(cuota);

}


});



res.json({

pendientes,
pagados,
total_registros: rows.length

});


} catch (error) {

console.error(error);

res.status(500).json({
error:'Error al buscar en la base de datos'
});

}

});



/*
========================================
2. REGISTRAR PAGO
========================================
*/

router.post('/:id/pagar', async (req, res) => {

try {

await db.query(

'UPDATE payment_plan SET status = ?, payment_date = NOW() WHERE id = ?',

['pagado', req.params.id]

);

res.json({
message:'Pago registrado exitosamente'
});

} catch (error) {

console.error(error);

res.status(500).json({
error:'Error registrando pago'
});

}

});



/*
========================================
3. ANULAR PAGO
========================================
*/

router.put('/:id/anular', async (req, res) => {

try {

await db.query(

'UPDATE payment_plan SET status = ?, payment_date = NULL WHERE id = ?',

['pendiente', req.params.id]

);

res.json({
message:'Pago anulado correctamente'
});

} catch (error) {

res.status(500).json({
error:'Error anulando pago'
});

}

});


module.exports = router;