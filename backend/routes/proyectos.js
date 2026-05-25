const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

router.use(authenticateToken);

// --- 1. CONFIGURACIÓN DE CARPETA DE IMÁGENES ---
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// --- 2. CONFIGURACIÓN MULTER ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const cleanName = file.originalname.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9._-]/g, '');
        cb(null, 'PROY-' + Date.now() + '-' + cleanName);
    }
});

// Filtro para aceptar imágenes y SVGs
const fileFilter = (req, file, cb) => {
    if (file.fieldname === 'plano') {
        // Validación estricta para el plano
        if (file.mimetype === 'image/svg+xml' || file.originalname.toLowerCase().endsWith('.svg')) {
            return cb(null, true);
        }
        return cb(new Error('El plano debe ser obligatoriamente formato .svg'), false);
    }
    // Validación para galería
    if (file.mimetype.startsWith('image/')) {
        return cb(null, true);
    }
    cb(new Error('Formato no válido'), false);
};

const upload = multer({ storage: storage, fileFilter: fileFilter });

const uploadFields = upload.fields([
    { name: 'imagenes', maxCount: 10 },
    { name: 'plano', maxCount: 1 }
]);

// --- RUTAS DE LA API ---

// 1. LISTAR PROYECTOS (Con Filtro Activo/Archivado) - ¡CORREGIDO!
router.get('/', async (req, res) => {
    try {
        const targetOwnerId = req.user.isOwner ? req.user.id : req.user.ownerId;
        
        // CORRECCIÓN: Leer el parámetro del frontend. 
        // Si llega '0', buscamos archivados. Si llega cualquier otra cosa o nada, buscamos activos (1).
        const isActive = req.query.active === '0' ? 0 : 1;

        const query = `
            SELECT p.*, GROUP_CONCAT(pi.image_url SEPARATOR ',') as imagenes
            FROM projects p
            LEFT JOIN project_images pi ON p.id = pi.project_id
            WHERE p.owner_id = ? AND p.is_active = ?
            GROUP BY p.id
            ORDER BY p.created_at DESC
        `;
        
        // Pasamos isActive a la consulta
        const [proyectos] = await db.query(query, [targetOwnerId, isActive]);
        res.json(proyectos);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al cargar proyectos' });
    }
});

// 2. OBTENER UN PROYECTO (Detalle)
router.get('/:id', async (req, res) => {
    try {
        const targetOwnerId = req.user.isOwner ? req.user.id : req.user.ownerId;

        // CORRECCIÓN: Quitamos "AND is_active = 1" para permitir ver detalles de proyectos archivados
        const [proyectos] = await db.query(
            'SELECT * FROM projects WHERE id=? AND owner_id=?',
            [req.params.id, targetOwnerId]
        );

        if (proyectos.length === 0) return res.status(404).json({ error: 'No encontrado' });
        const proyecto = proyectos[0];

        const [imagenes] = await db.query('SELECT id, image_url FROM project_images WHERE project_id=?', [proyecto.id]);
        proyecto.listaImagenes = imagenes;

        res.json(proyecto);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener proyecto' });
    }
});

// 3. CREAR PROYECTO
router.post('/', (req, res, next) => {
    uploadFields(req, res, (err) => {
        if (err) return res.status(400).json({ error: err.message });
        next();
    });
}, async (req, res) => {
    const { nombre, ubicacion, description, status, auto_units, base_price, base_area } = req.body;
    const targetOwnerId = req.user.isOwner ? req.user.id : req.user.ownerId;

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        let planoUrl = null;
        if (req.files['plano'] && req.files['plano'][0]) {
            planoUrl = `/uploads/${req.files['plano'][0].filename}`;
        }

        const [result] = await connection.query(
            'INSERT INTO projects (owner_id, nombre, ubicacion, descripcion, status, plano_svg) VALUES (?, ?, ?, ?, ?, ?)',
            [targetOwnerId, nombre, ubicacion, description, status || 'planificacion', planoUrl]
        );
        
        const projectId = result.insertId;

        if (req.files['imagenes'] && req.files['imagenes'].length > 0) {
            const imageValues = req.files['imagenes'].map((file, index) => [
                projectId,
                `/uploads/${file.filename}`,
                index === 0 // 1 si es portada
            ]);
            await connection.query('INSERT INTO project_images (project_id, image_url, is_main) VALUES ?', [imageValues]);
        }

        const cantidad = parseInt(auto_units) || 0;
        if (cantidad > 0) {
            const precio = parseFloat(base_price) || 0;
            const area = parseFloat(base_area) || 0;
            const lotesValues = [];
            for (let i = 1; i <= cantidad; i++) {
                lotesValues.push([projectId, `Lote ${i}`, 'lote', precio, area, 'disponible']);
            }
            await connection.query(
                'INSERT INTO units (project_id, unit_code, type, price, area, status) VALUES ?',
                [lotesValues]
            );
        }

        await connection.commit();
        res.status(201).json({ message: 'Proyecto creado exitosamente' });

    } catch (error) {
        await connection.rollback();
        console.error(error);
        res.status(500).json({ error: 'Error al crear proyecto' });
    } finally {
        connection.release();
    }
});

// 4. ACTUALIZAR PROYECTO
router.put('/:id', (req, res, next) => {
    uploadFields(req, res, (err) => {
        if (err) return res.status(400).json({ error: err.message });
        next();
    });
}, async (req, res) => {
    const { nombre, ubicacion, description, status } = req.body;
    const projectId = req.params.id;
    const targetOwnerId = req.user.isOwner ? req.user.id : req.user.ownerId;

    try {
        let query = 'UPDATE projects SET nombre=?, ubicacion=?, descripcion=?, status=?';
        let params = [nombre, ubicacion, description, status];

        if (req.files['plano'] && req.files['plano'][0]) {
            query += ', plano_svg=?';
            params.push(`/uploads/${req.files['plano'][0].filename}`);
        }

        query += ' WHERE id=? AND owner_id=?';
        params.push(projectId, targetOwnerId);

        await db.query(query, params);

        if (req.files['imagenes'] && req.files['imagenes'].length > 0) {
            const imageValues = req.files['imagenes'].map(file => [
                projectId, 
                `/uploads/${file.filename}`, 
                0
            ]);
            await db.query('INSERT INTO project_images (project_id, image_url, is_main) VALUES ?', [imageValues]);
        }

        res.json({ message: 'Proyecto actualizado' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al actualizar' });
    }
});

// 5. ELIMINAR IMAGEN
router.delete('/imagen/:id', async (req, res) => {
    try {
        const [img] = await db.query('SELECT image_url FROM project_images WHERE id=?', [req.params.id]);
        
        if (img.length > 0) {
            const nombreArchivo = img[0].image_url.split('/uploads/')[1];
            if (nombreArchivo) {
                const rutaAbsoluta = path.join(uploadDir, nombreArchivo);
                if (fs.existsSync(rutaAbsoluta)) fs.unlinkSync(rutaAbsoluta);
            }
            await db.query('DELETE FROM project_images WHERE id=?', [req.params.id]);
            res.json({ message: 'Imagen eliminada' });
        } else {
            res.status(404).json({ error: 'Imagen no encontrada' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Error eliminando imagen' });
    }
});

// 6. ARCHIVAR PROYECTO (SOFT DELETE)
router.delete('/:id', async (req, res) => {
    const targetOwnerId = req.user.isOwner ? req.user.id : req.user.ownerId;
    try {
        const [result] = await db.query('UPDATE projects SET is_active = 0 WHERE id = ? AND owner_id = ?', [req.params.id, targetOwnerId]);
        
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Proyecto no encontrado' });
        
        res.json({ message: 'Proyecto archivado correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al archivar' });
    }
});

// 7. REACTIVAR PROYECTO (RESTAURAR) - ¡NECESARIA PARA EL BOTÓN!
router.put('/:id/reactivar', async (req, res) => {
    const targetOwnerId = req.user.isOwner ? req.user.id : req.user.ownerId;
    try {
        // Cambiamos is_active de nuevo a 1
        const [result] = await db.query('UPDATE projects SET is_active = 1 WHERE id = ? AND owner_id = ?', [req.params.id, targetOwnerId]);
        
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Proyecto no encontrado' });
        
        res.json({ message: 'Proyecto restaurado exitosamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al restaurar' });
    }
});

module.exports = router;