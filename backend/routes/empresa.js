const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken, requireOwner } = require('../middleware/auth'); // Tu middleware de seguridad
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// --- Configuración para subir Logos ---
const uploadDir = path.join(__dirname, '../uploads/logos');
// Crear carpeta si no existe
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        // Nombre único: LOGO-fecha-numero.jpg
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'LOGO-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Todas las rutas requieren login
router.use(authenticateToken); 

// 1. GET: Obtener datos de la empresa
router.get('/', async (req, res) => {
    try {
        // Si el usuario es empleado, buscamos los datos de su JEFE (Owner)
        const ownerId = req.user.isOwner ? req.user.id : req.user.ownerId;
        
        const [rows] = await db.query(
            'SELECT razon_social, numero_documento, email, telefono, direccion, ciudad, logo_url FROM owners WHERE id = ?', 
            [ownerId]
        );

        if (rows.length === 0) return res.status(404).json({ error: 'Empresa no encontrada' });
        res.json(rows[0]);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al cargar datos de empresa' });
    }
});

// 2. PUT: Actualizar datos (Solo el Owner puede hacer esto)
router.put('/', requireOwner, upload.single('logo'), async (req, res) => {
    const { razon_social, telefono, direccion, ciudad } = req.body;
    
    try {
        // Construimos la consulta dinámicamente
        let query = 'UPDATE owners SET razon_social=?, telefono=?, direccion=?, ciudad=?';
        let params = [razon_social, telefono, direccion, ciudad];

        // Si subió un logo nuevo, actualizamos también ese campo
        if (req.file) {
            query += ', logo_url=?';
            // Guardamos la ruta relativa para accederla desde el navegador
            params.push(`/uploads/logos/${req.file.filename}`);
        }

        query += ' WHERE id=?';
        params.push(req.user.id);

        await db.query(query, params);

        res.json({ 
            message: 'Información actualizada correctamente',
            newLogo: req.file ? `/uploads/logos/${req.file.filename}` : null 
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al actualizar la empresa' });
    }
});

module.exports = router;