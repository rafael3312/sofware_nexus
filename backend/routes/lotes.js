const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

router.use(authenticateToken);

// --- 1. CONFIGURACIÓN DE CARPETA UPLOADS ---
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// --- 2. CONFIGURACIÓN MULTER (IMÁGENES) ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        // Limpiar nombre de archivo para evitar caracteres raros
        const cleanName = file.originalname.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9._-]/g, '');
        cb(null, Date.now() + '-' + cleanName);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Límite 5MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Solo se permiten imágenes'), false);
    }
});

// --- RUTAS DE LA API ---

// 1. OBTENER LOTES (Con filtros: Proyecto y Estado)
router.get('/', async (req, res) => {
    const { project_id, status } = req.query; 
    const targetOwnerId = req.user.isOwner ? req.user.id : req.user.ownerId;

    try {
        let query = `
            SELECT u.*, p.nombre as nombre_proyecto, 
            GROUP_CONCAT(ui.image_url SEPARATOR ',') as imagenes,
            c.primer_nombre, c.primer_apellido
            FROM units u
            INNER JOIN projects p ON u.project_id = p.id
            LEFT JOIN unit_images ui ON u.id = ui.unit_id
            LEFT JOIN clients c ON u.client_id = c.id
            WHERE p.owner_id = ?
        `;
        
        const params = [targetOwnerId];

        // Filtro por Proyecto
        if (project_id) {
            query += ' AND u.project_id = ?';
            params.push(project_id);
        }
        
        // Filtro por Estado (disponible, separado, vendido)
        if (status && status !== 'todos') {
            query += ' AND u.status = ?';
            params.push(status);
        }

        query += ' GROUP BY u.id ORDER BY u.unit_code ASC';

        const [lotes] = await db.query(query, params);
        res.json(lotes);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error cargando inventario' });
    }
});

// 2. OBTENER UN SOLO LOTE (Para edición)
router.get('/:id', async (req, res) => {
    try {
        // Obtenemos datos básicos
        const [lotes] = await db.query('SELECT * FROM units WHERE id=?', [req.params.id]);
        if (lotes.length === 0) return res.status(404).json({ error: 'Lote no encontrado' });
        
        const lote = lotes[0];
        
        // Obtenemos sus imágenes
        const [imagenes] = await db.query('SELECT id, image_url FROM unit_images WHERE unit_id=?', [lote.id]);
        lote.listaImagenes = imagenes;
        
        res.json(lote);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error cargando detalle del lote' });
    }
});

// 3. CREAR LOTE (Con imágenes)
router.post('/', upload.array('imagenes', 5), async (req, res) => {
    const { project_id, unit_code, type, price, area, description } = req.body;
    
    // Validación básica
    if (!project_id || !unit_code || !price) {
        return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();
        
        // A. Insertar Lote
        const [result] = await connection.query(
            'INSERT INTO units (project_id, unit_code, type, price, area, description, status) VALUES (?, ?, ?, ?, ?, ?, "disponible")',
            [project_id, unit_code, type, price, area, description]
        );
        
        const unitId = result.insertId;

        // B. Insertar Imágenes
        if (req.files && req.files.length > 0) {
            const imageValues = req.files.map((file, index) => [
                unitId, 
                `/uploads/${file.filename}`, 
                index === 0 ? 1 : 0 // Primera imagen es portada
            ]);
            await connection.query('INSERT INTO unit_images (unit_id, image_url, is_main) VALUES ?', [imageValues]);
        }

        await connection.commit();
        res.status(201).json({ message: 'Unidad creada correctamente', id: unitId });

    } catch (error) {
        await connection.rollback();
        // Error común: Código de lote duplicado en el mismo proyecto
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'El código ya existe en este proyecto' });
        }
        console.error(error);
        res.status(500).json({ error: 'Error al crear unidad' });
    } finally {
        connection.release();
    }
});

// 4. EDITAR LOTE (Actualizar datos e insertar nuevas fotos)
router.put('/:id', upload.array('imagenes', 5), async (req, res) => {
    const { unit_code, type, price, area, description, status } = req.body;
    const unitId = req.params.id;

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        // A. Actualizar Datos
        await connection.query(
            'UPDATE units SET unit_code=?, type=?, price=?, area=?, description=?, status=? WHERE id=?',
            [unit_code, type, price, area, description, status, unitId]
        );

        // B. Agregar NUEVAS imágenes (sin borrar las viejas)
        if (req.files && req.files.length > 0) {
            const imageValues = req.files.map(file => [
                unitId, 
                `/uploads/${file.filename}`, 
                0 // No las marcamos como portada por defecto al editar
            ]);
            await connection.query('INSERT INTO unit_images (unit_id, image_url, is_main) VALUES ?', [imageValues]);
        }

        await connection.commit();
        res.json({ message: 'Lote actualizado correctamente' });

    } catch (error) {
        await connection.rollback();
        console.error(error);
        res.status(500).json({ error: 'Error al editar lote' });
    } finally {
        connection.release();
    }
});

// 5. SEPARAR LOTE (NUEVA FUNCIONALIDAD)
router.put('/:id/separar', async (req, res) => {
    const { client_id, amount, deadline } = req.body;
    const unitId = req.params.id;

    if (!client_id || !amount || !deadline) {
        return res.status(400).json({ error: 'Faltan datos de separación' });
    }

    try {
        // Verificar que esté disponible antes de separar
        const [check] = await db.query('SELECT status FROM units WHERE id=?', [unitId]);
        if (check.length === 0 || check[0].status !== 'disponible') {
            return res.status(400).json({ error: 'El lote no está disponible para separar' });
        }

        await db.query(
            `UPDATE units SET 
             status = 'separado', 
             client_id = ?, 
             separation_amount = ?, 
             separation_date = NOW(), 
             separation_deadline = ? 
             WHERE id = ?`,
            [client_id, amount, deadline, unitId]
        );
        res.json({ message: 'Lote separado correctamente' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al separar el lote' });
    }
});

// 6. LIBERAR LOTE (Cancelar separación y volver a disponible)
router.put('/:id/liberar', async (req, res) => {
    try {
        await db.query(
            `UPDATE units SET 
             status = 'disponible', 
             client_id = NULL, 
             separation_amount = 0, 
             separation_date = NULL,
             separation_deadline = NULL 
             WHERE id = ?`,
            [req.params.id]
        );
        res.json({ message: 'Lote liberado y disponible nuevamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al liberar el lote' });
    }
});

// 7. ELIMINAR LOTE (Borrado físico)
router.delete('/:id', async (req, res) => {
    try {
        // A. Seguridad: Verificar si tiene ventas asociadas
        const [sales] = await db.query('SELECT id FROM sales WHERE unit_id = ?', [req.params.id]);
        if (sales.length > 0) {
            return res.status(400).json({ error: 'No se puede eliminar: El lote ya tiene ventas registradas. Debes anular la venta primero.' });
        }

        // B. Borrar imágenes del disco físico
        const [imgs] = await db.query('SELECT image_url FROM unit_images WHERE unit_id = ?', [req.params.id]);
        
        imgs.forEach(img => {
            // La URL es "/uploads/archivo.jpg", necesitamos extraer solo el nombre
            const nombreArchivo = img.image_url.split('/uploads/')[1];
            if (nombreArchivo) {
                const rutaAbsoluta = path.join(uploadDir, nombreArchivo);
                if (fs.existsSync(rutaAbsoluta)) {
                    try {
                        fs.unlinkSync(rutaAbsoluta);
                    } catch(err) {
                        console.error("No se pudo borrar archivo:", rutaAbsoluta);
                    }
                }
            }
        });

        // C. Borrar registro de la BD (Las imágenes en BD se borran solas por el ON DELETE CASCADE)
        await db.query('DELETE FROM units WHERE id = ?', [req.params.id]);
        
        res.json({ message: 'Lote eliminado permanentemente' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al eliminar lote' });
    }
});

// 8. ELIMINAR UNA IMAGEN ESPECÍFICA (De la galería)
router.delete('/imagen/:id', async (req, res) => {
    try {
        const [img] = await db.query('SELECT image_url FROM unit_images WHERE id=?', [req.params.id]);
        
        if (img.length > 0) {
            const nombreArchivo = img[0].image_url.split('/uploads/')[1];
            if (nombreArchivo) {
                const rutaAbsoluta = path.join(uploadDir, nombreArchivo);
                if (fs.existsSync(rutaAbsoluta)) fs.unlinkSync(rutaAbsoluta);
            }
            await db.query('DELETE FROM unit_images WHERE id=?', [req.params.id]);
            res.json({ message: 'Imagen eliminada' });
        } else {
            res.status(404).json({ error: 'Imagen no encontrada' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Error eliminando imagen' });
    }
});

module.exports = router;