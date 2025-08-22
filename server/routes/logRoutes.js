// Dosya: server/routes/logRoutes.js
const express = require('express');
const { getDb } = require('../database');
const superAdminAuthMiddleware = require('../middleware/superAdminAuthMiddleware');

const router = express.Router();

// Bu rotadaki tüm isteklerin önce Süper Admin kontrolünden geçmesini sağla
router.use(superAdminAuthMiddleware);

/**
 * GET /api/logs
 * Tüm işlem loglarını, en yeniden eskiye doğru sıralanmış olarak getirir.
 * Sadece 'super_admin' rolüne sahip kullanıcılar erişebilir.
 */
router.get('/', async (req, res) => {
    try {
        const db = getDb();
        const logs = await db.all('SELECT * FROM action_logs ORDER BY timestamp DESC');
        res.json(logs);
    } catch (error) {
        console.error("İşlem logları alınırken hata:", error);
        res.status(500).json({ message: 'İşlem logları alınırken bir sunucu hatası oluştu.' });
    }
});

module.exports = router;
