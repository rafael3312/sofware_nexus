const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { requireOwner } = require('../middleware/auth'); 
const router = express.Router();

// OBTENER EMPLEADOS
router.get('/', requireOwner, async (req, res) => {
    try {
        const [users] = await db.query(`
            SELECT id, primer_nombre, primer_apellido, numero_documento, username, email, is_active, created_at
            FROM users 
            WHERE owner_id = ?
        `, [req.user.id]);
        res.json(users);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener usuarios' });
    }
});

// CREAR EMPLEADO
router.post('/', requireOwner, async (req, res) => {
    const { 
        tipo_documento, numero_documento, 
        primer_nombre, segundo_nombre, 
        primer_apellido, segundo_apellido, 
        username, password, email, modules 
    } = req.body; 

    try {
        // 1. Validar duplicados
        const [existsDoc] = await db.query('SELECT id FROM users WHERE numero_documento = ?', [numero_documento]);
        if (existsDoc.length > 0) return res.status(400).json({ error: 'Ya existe un usuario con ese número de documento.' });

        const [existsUser] = await db.query('SELECT id FROM users WHERE owner_id = ? AND username = ?', [req.user.id, username]);
        if (existsUser.length > 0) return res.status(400).json({ error: 'El nombre de usuario ya está en uso.' });

        const passwordHash = await bcrypt.hash(password, 12);

        // 2. Insertar Usuario
        const [result] = await db.query(
            `INSERT INTO users (
                owner_id, tipo_documento, numero_documento, 
                primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, 
                username, password_hash, email
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.user.id, tipo_documento, numero_documento, primer_nombre, segundo_nombre || null, primer_apellido, segundo_apellido || null, username, passwordHash, email]
        );

        const newUserId = result.insertId;

        // 3. ASIGNAR PERMISOS (CORREGIDO)
        if (modules && Array.isArray(modules) && modules.length > 0) {
            // Buscamos IDs de módulos por nombre
            const [modulosDB] = await db.query('SELECT id FROM modules WHERE nombre IN (?)', [modules]);
            
            if (modulosDB.length > 0) {
                const values = modulosDB.map(m => [newUserId, m.id, 1, 1]); // can_view=1, can_edit=1
                await db.query(
                    'INSERT INTO user_modules (user_id, module_id, can_view, can_edit) VALUES ?',
                    [values]
                );
                console.log(`Permisos asignados al usuario ${newUserId}:`, modules);
            }
        }

        res.status(201).json({ message: 'Empleado creado exitosamente' });

    } catch (error) {
        console.error('Error en POST /usuarios:', error);
        res.status(500).json({ error: 'Error al crear empleado' });
    }
});

// OBTENER UN SOLO USUARIO (Para cargar el formulario de edición)
router.get('/:id', requireOwner, async (req, res) => {
    try {
        const [users] = await db.query('SELECT * FROM users WHERE id = ? AND owner_id = ?', [req.params.id, req.user.id]);
        if (users.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

        const [modules] = await db.query(`
            SELECT m.nombre 
            FROM user_modules um
            JOIN modules m ON um.module_id = m.id
            WHERE um.user_id = ? AND um.can_view = 1
        `, [req.params.id]);

        const user = users[0];
        user.modules = modules.map(m => m.nombre);
        
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Error al cargar datos' });
    }
});

// ACTUALIZAR USUARIO Y PERMISOS
router.put('/:id', requireOwner, async (req, res) => {
    const { primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, email, modules, password } = req.body;
    const userId = req.params.id;

    try {
        // 1. Actualizar datos de usuario
        let query = `UPDATE users SET primer_nombre=?, segundo_nombre=?, primer_apellido=?, segundo_apellido=?, email=?`;
        const params = [primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, email];

        if (password && password.trim() !== '') {
            const passwordHash = await bcrypt.hash(password, 12);
            query += `, password_hash=?`;
            params.push(passwordHash);
        }

        query += ` WHERE id=? AND owner_id=?`;
        params.push(userId, req.user.id);
        await db.query(query, params);

        // 2. RE-ASIGNAR PERMISOS (Borrar y Crear)
        await db.query('DELETE FROM user_modules WHERE user_id = ?', [userId]);

        if (modules && Array.isArray(modules) && modules.length > 0) {
            const [modulosDB] = await db.query('SELECT id FROM modules WHERE nombre IN (?)', [modules]);
            
            if (modulosDB.length > 0) {
                const values = modulosDB.map(m => [userId, m.id, 1, 1]);
                await db.query('INSERT INTO user_modules (user_id, module_id, can_view, can_edit) VALUES ?', [values]);
            }
        }

        res.json({ message: 'Usuario actualizado correctamente' });
    } catch (error) {
        console.error('Error en PUT /usuarios:', error);
        res.status(500).json({ error: 'Error al actualizar usuario' });
    }
});

// TOGGLE ESTADO
router.put('/:id/toggle', requireOwner, async (req, res) => {
    try {
        await db.query('UPDATE users SET is_active = NOT is_active WHERE id = ? AND owner_id = ?', [req.params.id, req.user.id]);
        res.json({ message: 'Estado actualizado' });
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar' });
    }
});

module.exports = router;