// Dosya: server/middleware/apiAuthMiddleware.js
const { getDb } = require('../database'); // Veritabanı bağlantısını import et

const apiAuth = async (req, res, next) => {
    // İstek başlığından (header) API anahtarını al
    const apiKey = req.headers['x-api-key'];

    if (!apiKey) {
        return res.status(401).json({ message: 'Erişim reddedildi. API anahtarı eksik.' });
    }

    try {
        const db = getDb();
        // API anahtarını veritabanındaki 'sites' tablosunda ara
        const site = await db.get('SELECT * FROM sites WHERE bizimApimiz = ?', apiKey);

        if (!site) {
            return res.status(403).json({ message: 'Geçersiz API anahtarı.' });
        }

        // Site adındaki olası boşlukları temizleyerek devam et
        site.siteAdi = site.siteAdi.trim();
        req.site = site;
        next(); // Her şey yolundaysa, bir sonraki adıma geç

    } catch (error) {
        console.error("API kimlik doğrulaması sırasında veritabanı hatası:", error);
        res.status(500).json({ message: 'Sunucu hatası.' });
    }
};

module.exports = apiAuth;
