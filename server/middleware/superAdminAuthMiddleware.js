// Dosya: server/middleware/superAdminAuthMiddleware.js
const { getDb } = require('../database');
const authMiddleware = require('./authMiddleware');

const superAdminAuthMiddleware = (req, res, next) => {
    // Önce normal bir admin olarak giriş yapmış mı diye kontrol et
    authMiddleware(req, res, async () => {
        try {
            const db = getDb();
            // Giriş yapmış kullanıcının rolünü veritabanından al
            const user = await db.get('SELECT role FROM users WHERE id = ?', req.user.id);

            // Eğer kullanıcı 'super_admin' rolüne sahipse, işleme devam etmesine izin ver
            if (user && user.role === 'super_admin') {
                next();
            } else {
                // Değilse, yetkisi olmadığını bildir
                res.status(403).json({ message: 'Bu işlem için Süper Admin yetkisi gereklidir.' });
            }
        } catch (error) {
            console.error("Süper admin yetki kontrolü sırasında hata:", error);
            res.status(500).json({ message: 'Sunucu hatası.' });
        }
    });
};

module.exports = superAdminAuthMiddleware;
