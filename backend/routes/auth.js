// backend/routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const router = express.Router();

// REGISTRO DE PROPIETARIO (Empresa Inmobiliaria)
router.post('/register-owner', async (req, res) => {
    try {
        const { 
            razon_social, numero_documento, // Campos Nuevos
            username, email, password 
        } = req.body;

        // 1. Validaciones básicas
        if (!razon_social || !numero_documento || !username || !password || !email) {
            return res.status(400).json({ error: 'Todos los campos son requeridos' });
        }

        // 2. Verificar duplicados (Usuario, Email o NIT)
        const [existing] = await db.query(
            'SELECT id FROM owners WHERE username = ? OR email = ? OR numero_documento = ?', 
            [username, email, numero_documento]
        );
        
        if (existing.length > 0) {
            return res.status(400).json({ error: 'El usuario, correo o NIT ya están registrados' });
        }

        // 3. Encriptar contraseña
        const passwordHash = await bcrypt.hash(password, 12);

        // 4. Insertar en la Base de Datos
        await db.query(
            `INSERT INTO owners (razon_social, numero_documento, username, email, password_hash) 
             VALUES (?, ?, ?, ?, ?)`,
            [razon_social, numero_documento, username, email, passwordHash]
        );

        res.status(201).json({ message: 'Inmobiliaria registrada exitosamente' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Login Unificado (Busca Owner, si no, busca Empleado)
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        let user = null;
        let isOwner = false;
        let allowedModules = []; // Lista vacía por defecto

        // 1. Buscar en Owners
        const [owners] = await db.query('SELECT * FROM owners WHERE username = ?', [username]);
        
        if (owners.length > 0) {
            user = owners[0];
            isOwner = true;
            allowedModules = ['*']; // El dueño tiene acceso total (comodín)
        } else {
            // 2. Buscar en Empleados
            const [employees] = await db.query('SELECT * FROM users WHERE username = ? AND is_active = TRUE', [username]);
            if (employees.length > 0) {
                user = employees[0];
                isOwner = false;

                // --- NUEVO: OBTENER PERMISOS DEL EMPLEADO ---
                const [perms] = await db.query(`
                    SELECT m.nombre 
                    FROM user_modules um
                    JOIN modules m ON um.module_id = m.id
                    WHERE um.user_id = ? AND um.can_view = 1
                `, [user.id]);
                
                // Convertimos [{nombre: 'proyectos'}, {nombre: 'lotes'}] a ['proyectos', 'lotes']
                allowedModules = perms.map(p => p.nombre); 
            }
        }

        if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });

        // 3. Verificar contraseña
        const validPass = await bcrypt.compare(password, user.password_hash);
        if (!validPass) return res.status(401).json({ error: 'Credenciales inválidas' });

        // 4. Token Payload
        const tokenPayload = {
            id: user.id,
            username: user.username,
            isOwner: isOwner,
            ownerId: isOwner ? user.id : user.owner_id
        };

        const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '24h' });

        // --- ENVIAMOS LA LISTA DE MÓDULOS AL FRONTEND ---
        res.json({ 
            token, 
            user: {
                ...tokenPayload,
                allowedModules: allowedModules // Enviamos la lista aquí
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno' });
    }
});

module.exports = router;
