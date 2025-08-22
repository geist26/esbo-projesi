// Dosya: server/routes/siteRoutes.js
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getDb } = require('../database');
const { logAction } = require('../services/logService');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Site logoları için Multer ayarları
const siteLogoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const logosDir = path.join(__dirname, '..', 'uploads', 'site-logos');
    if (!fs.existsSync(logosDir)) {
      fs.mkdirSync(logosDir, { recursive: true });
    }
    cb(null, logosDir);
  },
  filename: (req, file, cb) => cb(null, `site-${Date.now()}${path.extname(file.originalname)}`)
});
const uploadSiteLogo = multer({ storage: siteLogoStorage });


// GET /api/sites - Tüm siteleri getir
router.get('/', async (req, res) => {
    try {
        const db = getDb();
        const sites = await db.all('SELECT * FROM sites');
        res.json(sites);
    } catch (error) {
        res.status(500).json({ message: 'Siteler alınırken hata oluştu.' });
    }
});

// POST /api/sites - Yeni site ekle (Logo yükleme ile birlikte)
router.post('/', authMiddleware, uploadSiteLogo.single('siteLogoFile'), async (req, res) => {
    const {
        siteAdi, telegramBotToken, telegramGrupId, yatirimKomisyonu, cekimKomisyonu, sitedenAlinanApi, bizimApimiz, bakiyeApiAdresi
    } = req.body;

    const newSite = {
        id: uuidv4(),
        siteAdi,
        siteLogo: req.file ? `/site-logos/${req.file.filename}` : null,
        telegramBotToken,
        telegramGrupId,
        yatirimKomisyonu,
        cekimKomisyonu,
        sitedenAlinanApi,
        bizimApimiz,
        bakiyeApiAdresi
    };

    try {
        const db = getDb();
        await db.run(
            `INSERT INTO sites (id, siteAdi, siteLogo, telegramBotToken, telegramGrupId, yatirimKomisyonu, cekimKomisyonu, sitedenAlinanApi, bizimApimiz, bakiyeApiAdresi)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            newSite.id, newSite.siteAdi, newSite.siteLogo, newSite.telegramBotToken, newSite.telegramGrupId, newSite.yatirimKomisyonu, newSite.cekimKomisyonu, newSite.sitedenAlinanApi, newSite.bizimApimiz, newSite.bakiyeApiAdresi
        );
        await logAction(req.user.username, 'SITE_EKLENDI', `Yeni site oluşturuldu: ${siteAdi}`);
        res.status(201).json(newSite);
    } catch (error) {
        console.error("Site eklenirken hata:", error);
        res.status(500).json({ message: 'Site eklenirken hata oluştu.' });
    }
});

// PUT /api/sites/:id - Site güncelle (Logo yükleme ile birlikte)
router.put('/:id', authMiddleware, uploadSiteLogo.single('siteLogoFile'), async (req, res) => {
    const {
        siteAdi, telegramBotToken, telegramGrupId, yatirimKomisyonu, cekimKomisyonu, sitedenAlinanApi, bizimApimiz, bakiyeApiAdresi
    } = req.body;
    const { id } = req.params;

    try {
        const db = getDb();
        const existingSite = await db.get('SELECT siteLogo FROM sites WHERE id = ?', id);
        if (!existingSite) {
            return res.status(404).json({ message: 'Site bulunamadı.' });
        }
        
        const siteLogo = req.file ? `/site-logos/${req.file.filename}` : existingSite.siteLogo;

        await db.run(
            `UPDATE sites SET 
             siteAdi = ?, siteLogo = ?, telegramBotToken = ?, telegramGrupId = ?, yatirimKomisyonu = ?, cekimKomisyonu = ?, sitedenAlinanApi = ?, bizimApimiz = ?, bakiyeApiAdresi = ?
             WHERE id = ?`,
            siteAdi, siteLogo, telegramBotToken, telegramGrupId, yatirimKomisyonu, cekimKomisyonu, sitedenAlinanApi, bizimApimiz, bakiyeApiAdresi, id
        );
        await logAction(req.user.username, 'SITE_GUNCELLEDI', `Site güncellendi: ${siteAdi}`);
        res.json({ id, ...req.body, siteLogo });
    } catch (error) {
        console.error("Site güncellenirken hata:", error);
        res.status(500).json({ message: 'Site güncellenirken hata oluştu.' });
    }
});

// DELETE /api/sites/:id - Site sil
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const db = getDb();
        const siteToDelete = await db.get('SELECT siteAdi FROM sites WHERE id = ?', req.params.id);
        if (!siteToDelete) {
            return res.status(404).json({ message: 'Site bulunamadı.' });
        }
        await db.run('DELETE FROM sites WHERE id = ?', req.params.id);
        await logAction(req.user.username, 'SITE_SILINDI', `Site silindi: ${siteToDelete.siteAdi}`);
        res.status(204).send();
    } catch (error) {
        console.error("Site silinirken hata:", error);
        res.status(500).json({ message: 'Site silinirken hata oluştu.' });
    }
});

module.exports = router;
