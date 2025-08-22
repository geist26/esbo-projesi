// Dosya: server/routes/bankRoutes.js
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getDb } = require('../database'); // Veritabanı bağlantısını import et

const router = express.Router();

// Multer (Dosya Yükleme) Ayarları
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'uploads/');
    if (!fs.existsSync(uploadDir)){
        fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage: storage });


// --- YATIRIM BANKALARI ROTALARI ---

router.get('/investment', async (req, res) => {
    try {
        const db = getDb();
        const banks = await db.all('SELECT * FROM investment_banks');
        res.json(banks);
    } catch (error) {
        console.error("Yatırım bankaları alınırken hata:", error);
        res.status(500).json({ message: 'Yatırım bankaları alınırken hata oluştu.' });
    }
});

router.post('/investment', upload.single('logo'), async (req, res) => {
    const { bankaAdi, iban, hesapSahibi, minYatirim, maxYatirim, islemAdedi } = req.body;
    const newBank = {
        id: uuidv4(),
        logo: req.file ? `/uploads/${req.file.filename}` : null,
        bankaAdi, iban, hesapSahibi, minYatirim, maxYatirim, islemAdedi
    };
    try {
        const db = getDb();
        await db.run(
            `INSERT INTO investment_banks (id, bankaAdi, iban, hesapSahibi, minYatirim, maxYatirim, islemAdedi, logo)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            newBank.id, newBank.bankaAdi, newBank.iban, newBank.hesapSahibi, newBank.minYatirim, newBank.maxYatirim, newBank.islemAdedi, newBank.logo
        );
        res.status(201).json(newBank);
    } catch (error) {
        console.error("Yatırım bankası eklenirken hata:", error);
        res.status(500).json({ message: 'Yatırım bankası eklenirken hata oluştu.' });
    }
});

router.put('/investment/:id', upload.single('logo'), async (req, res) => {
    const { bankaAdi, iban, hesapSahibi, minYatirim, maxYatirim, islemAdedi } = req.body;
    const { id } = req.params;
    
    try {
        const db = getDb();
        const existingBank = await db.get('SELECT logo FROM investment_banks WHERE id = ?', id);
        if (!existingBank) {
            return res.status(404).json({ message: 'Banka bulunamadı.' });
        }

        const logo = req.file ? `/uploads/${req.file.filename}` : existingBank.logo;

        await db.run(
            `UPDATE investment_banks SET 
             bankaAdi = ?, iban = ?, hesapSahibi = ?, minYatirim = ?, maxYatirim = ?, islemAdedi = ?, logo = ?
             WHERE id = ?`,
            bankaAdi, iban, hesapSahibi, minYatirim, maxYatirim, islemAdedi, logo, id
        );
        req.lockedBanks.delete(id);
        req.io.emit('bank_status_updated', { bankId: id, isLocked: false });
        res.json({ id, ...req.body, logo });
    } catch (error) {
        console.error("Yatırım bankası güncellenirken hata:", error);
        res.status(500).json({ message: 'Yatırım bankası güncellenirken hata oluştu.' });
    }
});

router.delete('/investment/:id', async (req, res) => {
    try {
        const db = getDb();
        await db.run('DELETE FROM investment_banks WHERE id = ?', req.params.id);
        res.status(204).send();
    } catch (error) {
        console.error("Yatırım bankası silinirken hata:", error);
        res.status(500).json({ message: 'Yatırım bankası silinirken hata oluştu.' });
    }
});

router.post('/investment/lock', (req, res) => {
    const { bankId, isLocked } = req.body;
    if (isLocked) {
        req.lockedBanks.add(bankId);
    } else {
        req.lockedBanks.delete(bankId);
    }
    req.io.emit('bank_status_updated', { bankId, isLocked });
    res.status(200).send({ message: 'Banka durumu güncellendi.' });
});


// --- ÇEKİM BANKALARI ROTALARI ---

router.get('/withdrawal', async (req, res) => {
    try {
        const db = getDb();
        const banks = await db.all('SELECT * FROM withdrawal_banks');
        const parsedBanks = banks.map(bank => ({
            ...bank,
            requiredFields: bank.requiredFields ? JSON.parse(bank.requiredFields) : []
        }));
        res.json(parsedBanks);
    } catch (error) {
        console.error("Çekim bankaları alınırken hata:", error);
        res.status(500).json({ message: 'Çekim bankaları alınırken hata oluştu.' });
    }
});

router.post('/withdrawal', upload.single('logo'), async (req, res) => {
    const { bankaAdi, requiredFields } = req.body;
    const newBank = {
        id: uuidv4(),
        bankaAdi,
        logo: req.file ? `/uploads/${req.file.filename}` : null,
        requiredFields: requiredFields
    };
    try {
        const db = getDb();
        await db.run(
            'INSERT INTO withdrawal_banks (id, bankaAdi, logo, requiredFields) VALUES (?, ?, ?, ?)',
            newBank.id, newBank.bankaAdi, newBank.logo, newBank.requiredFields
        );
        newBank.requiredFields = JSON.parse(newBank.requiredFields);
        res.status(201).json(newBank);
    } catch (error) {
        console.error("Çekim bankası eklenirken hata:", error);
        res.status(500).json({ message: 'Çekim bankası eklenirken hata oluştu.' });
    }
});

router.put('/withdrawal/:id', upload.single('logo'), async (req, res) => {
    const { bankaAdi, requiredFields } = req.body;
    const { id } = req.params;
    
    try {
        const db = getDb();
        const existingBank = await db.get('SELECT logo FROM withdrawal_banks WHERE id = ?', id);
        if (!existingBank) {
            return res.status(404).json({ message: 'Banka bulunamadı.' });
        }
        
        const logo = req.file ? `/uploads/${req.file.filename}` : existingBank.logo;

        await db.run(
            'UPDATE withdrawal_banks SET bankaAdi = ?, logo = ?, requiredFields = ? WHERE id = ?',
            bankaAdi, logo, requiredFields, id
        );
        req.lockedBanks.delete(id);
        req.io.emit('bank_status_updated', { bankId: id, isLocked: false });
        res.json({ id, ...req.body, logo, requiredFields: JSON.parse(requiredFields) });
    } catch (error) {
        console.error("Çekim bankası güncellenirken hata:", error);
        res.status(500).json({ message: 'Çekim bankası güncellenirken hata oluştu.' });
    }
});

router.delete('/withdrawal/:id', async (req, res) => {
    try {
        const db = getDb();
        await db.run('DELETE FROM withdrawal_banks WHERE id = ?', req.params.id);
        res.status(204).send();
    } catch (error) {
        console.error("Çekim bankası silinirken hata:", error);
        res.status(500).json({ message: 'Çekim bankası silinirken hata oluştu.' });
    }
});

module.exports = router;
