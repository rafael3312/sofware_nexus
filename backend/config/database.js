// backend/config/database.js
const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'nexus_urbanizaciones2',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Exportamos la promesa del pool para usar await en las consultas
module.exports = pool.promise();