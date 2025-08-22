// Dosya: server/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const JWT_SECRET = 'sizin-cok-gizli-anahtariniz-12345'; // Bu anahtar authRoutes.js'deki ile aynı olmalı

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7); // "Bearer " kısmını atla
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            req.user = decoded;
            next();
        } catch (error) {
            return res.status(401).json({ message: 'Geçersiz veya süresi dolmuş token.' });
        }
    } else {
        return res.status(401).json({ message: 'Yetkilendirme token\'ı bulunamadı.' });
    }
};

module.exports = authMiddleware;
