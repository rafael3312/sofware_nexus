// backend/middleware/auth.js
const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Token requerido' });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Token inválido o expirado' });
        req.user = user; // Aquí guardamos {id, isOwner, ownerId}
        next();
    });
};

const requireOwner = (req, res, next) => {
    if (!req.user || !req.user.isOwner) {
        return res.status(403).json({ error: 'Acceso denegado. Se requiere ser Propietario.' });
    }
    next();
};

module.exports = { authenticateToken, requireOwner };