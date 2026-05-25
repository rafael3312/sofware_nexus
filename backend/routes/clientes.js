const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

router.use(authenticateToken);

// 1. LISTAR CLIENTES ACTIVOS
router.get('/', async (req, res) => {
    try {
        const targetOwnerId = req.user.isOwner ? req.user.id : req.user.ownerId;
        const [clientes] = await db.query(
            'SELECT * FROM clients WHERE owner_id = ? AND is_active = 1 ORDER BY created_at DESC',
            [targetOwnerId]
        );
        res.json(clientes);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener clientes' });
    }
});

// 2. OBTENER UN SOLO CLIENTE (Para Edición)
router.get('/:id', async (req, res) => {
    try {
        const targetOwnerId = req.user.isOwner ? req.user.id : req.user.ownerId;
        const [cliente] = await db.query(
            'SELECT * FROM clients WHERE id = ? AND owner_id = ?',
            [req.params.id, targetOwnerId]
        );
        if (cliente.length === 0) return res.status(404).json({ error: 'Cliente no encontrado' });
        res.json(cliente[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error cargando cliente' });
    }
});

// 3. BUSCAR POR CÉDULA (Para ventas)
router.get('/buscar/:doc', async (req, res) => {
    try {
        const targetOwnerId = req.user.isOwner ? req.user.id : req.user.ownerId;
        const [cliente] = await db.query(
            'SELECT * FROM clients WHERE owner_id = ? AND numero_documento = ? AND is_active = 1',
            [targetOwnerId, req.params.doc]
        );
        if (cliente.length === 0) return res.status(404).json({ error: 'Cliente no encontrado' });
        res.json(cliente[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error en búsqueda' });
    }
});

// 4. CREAR CLIENTE
router.post('/', async (req, res) => {
    const { 
        tipo_documento, numero_documento, 
        primer_nombre, segundo_nombre, 
        primer_apellido, segundo_apellido, 
        phone, email, address, city 
    } = req.body;

    const targetOwnerId = req.user.isOwner ? req.user.id : req.user.ownerId;

    try {
        const [result] = await db.query(
            `INSERT INTO clients (
                owner_id, tipo_documento, numero_documento, 
                primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, 
                phone, email, address, city
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                targetOwnerId, tipo_documento, numero_documento,
                primer_nombre, segundo_nombre || null, primer_apellido, segundo_apellido || null,
                phone, email, address, city
            ]
        );
        res.status(201).json({ message: 'Cliente registrado', id: result.insertId });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Ya existe un cliente con este documento' });
        }
        res.status(500).json({ error: 'Error al guardar cliente' });
    }
});

// 5. EDITAR CLIENTE (PUT)
router.put('/:id', async (req, res) => {
    const { 
        primer_nombre, segundo_nombre, 
        primer_apellido, segundo_apellido, 
        phone, email, address, city 
    } = req.body;
    
    const targetOwnerId = req.user.isOwner ? req.user.id : req.user.ownerId;

    try {
        // Nota: Por seguridad no permitimos cambiar el numero_documento ni tipo fácilmente
        await db.query(
            `UPDATE clients SET 
                primer_nombre=?, segundo_nombre=?, 
                primer_apellido=?, segundo_apellido=?, 
                phone=?, email=?, address=?, city=? 
             WHERE id=? AND owner_id=?`,
            [primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, phone, email, address, city, req.params.id, targetOwnerId]
        );
        res.json({ message: 'Cliente actualizado' });
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar' });
    }
});

// 6. ARCHIVAR CLIENTE (DELETE Lógico)
router.delete('/:id', async (req, res) => {
    const targetOwnerId = req.user.isOwner ? req.user.id : req.user.ownerId;
    try {
        await db.query(
            'UPDATE clients SET is_active = 0 WHERE id = ? AND owner_id = ?', 
            [req.params.id, targetOwnerId]
        );
        res.json({ message: 'Cliente archivado' });
    } catch (error) {
        res.status(500).json({ error: 'Error al archivar' });
    }
});

module.exports = router;