const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

router.use(authenticateToken);

// --- Configuración de Subida de Fotos ---
const uploadDir = path.join(__dirname, '../uploads/perfiles'); // Subcarpeta para orden
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: function (req, file, cb) { cb(null, uploadDir); },
    filename: function (req, file, cb) {
        cb(null, 'PERFIL-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// 1. OBTENER DATOS DEL PERFIL ACTUAL
router.get('/', async (req, res) => {
    try {
        let query = '';
        let params = [req.user.id];

        if (req.user.isOwner) {
            query = 'SELECT id, razon_social, numero_documento, username, email, foto_perfil FROM owners WHERE id = ?';
        } else {
            query = 'SELECT id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, numero_documento, username, email, foto_perfil FROM users WHERE id = ?';
        }

        const [user] = await db.query(query, params);
        
        if (user.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
        
        // Añadimos un flag para que el frontend sepa qué campos mostrar
        const datos = user[0];
        datos.tipo_usuario = req.user.isOwner ? 'owner' : 'empleado';
        
        res.json(datos);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al cargar perfil' });
    }
});

// 2. ACTUALIZAR PERFIL (Soporta foto y contraseña)
router.put('/', upload.single('foto'), async (req, res) => {
    const { 
        email, password, // Campos comunes
        razon_social, // Solo Owner
        primer_nombre, segundo_nombre, primer_apellido, segundo_apellido // Solo Empleado
    } = req.body;

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        let query = '';
        let params = [];

        // Lógica dinámica según tipo de usuario
        if (req.user.isOwner) {
            query = 'UPDATE owners SET email=?, razon_social=?';
            params = [email, razon_social];
        } else {
            query = 'UPDATE users SET email=?, primer_nombre=?, segundo_nombre=?, primer_apellido=?, segundo_apellido=?';
            params = [email, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido];
        }

        // Si envió contraseña nueva, la encriptamos y agregamos al query
        if (password && password.trim() !== '') {
            const hash = await bcrypt.hash(password, 12);
            query += ', password_hash=?';
            params.push(hash);
        }

        // Si subió foto nueva
        if (req.file) {
            const fotoUrl = `/uploads/perfiles/${req.file.filename}`;
            query += ', foto_perfil=?';
            params.push(fotoUrl);
        }

        query += ' WHERE id=?';
        params.push(req.user.id);

        await connection.query(query, params);
        await connection.commit();

        res.json({ 
            message: 'Perfil actualizado correctamente',
            nuevaFoto: req.file ? `/uploads/perfiles/${req.file.filename}` : null 
        });

    } catch (error) {
        await connection.rollback();
        console.error(error);
        res.status(500).json({ error: 'Error al actualizar perfil' });
    } finally {
        connection.release();
    }
});

module.exports = router;