// backend/server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Importar la conexión centralizada (CORRECCIÓN)
const db = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Rutas
app.use('/api/auth', require('./routes/auth'));
// ruta de modulo lotes
app.use('/api/lotes', require('./routes/lotes'));
// ruta clientes 
// En backend/server.js
app.use('/api/clientes', require('./routes/clientes'));
// app de proyectos
app.use('/api/proyectos', require('./routes/proyectos'));
// app de ventas
app.use('/api/ventas', require('./routes/ventas'));
// app dashboard 
app.use('/api/dashboard', require('./routes/dashboard'));
// ruta imagenes upload
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// perfil
app.use('/api/perfil', require('./routes/perfil'));
// reportes 
app.use('/api/reportes', require('./routes/reportes'));
// ruta de edicion  logo reportes:
app.use('/api/empresa', require('./routes/empresa'));
// empresa
app.use('/api/empresa', require('./routes/empresa'));
// app pagos
app.use('/api/pagos', require('./routes/pagos'));
// Aseguramos que usuarios requiera autenticación
app.use('/api/usuarios', require('./middleware/auth').authenticateToken, require('./routes/usuarios'));



// backend/server.js

// Función simplificada: Solo prueba la conexión
async function initDB() {
    try {
        // Probamos conexión con una consulta simple
        await db.query('SELECT 1');
        console.log('Conectado exitosamente a la Base de Datos MySQL');
        
        

    } catch (error) {
        console.error('Error fatal: No se pudo conectar a la Base de Datos:', error);
        // Opcional: Detener el servidor si no hay DB, porque nada funcionará
        process.exit(1); 
    }
}

// Iniciar servidor
app.listen(PORT, async () => {
    await initDB();
    console.log(`Servidor NEXUS corriendo en http://localhost:${PORT}`);
});