const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');
const apiAuth = require('../middleware/apiAuthMiddleware');
const telegramService = require('../services/telegramService');

const router = express.Router();
router.use(apiAuth);

const readDataSafe = (filePath) => {
    try {
        if (require('fs').existsSync(filePath)) {
            const fileContent = require('fs').readFileSync(filePath, 'utf8');
            return fileContent.trim() === '' ? [] : JSON.parse(fileContent);
        }
    } catch (error) {
        console.error(`HATA: ${filePath} dosyası okunamadı veya bozuk.`, error);
    }
    return [];
};

router.get('/site-info', (req, res) => {
    const { siteAdi, siteLogo } = req.site;
    res.json({ siteAdi, siteLogo });
});

router.get('/request-status/:username', async (req, res) => {
    const { username } = req.params;
    const siteName = req.site.siteAdi;
    try {
        const db = getDb();
        const pendingInvestment = await db.get('SELECT id FROM investment_requests WHERE kullaniciAdi = ? AND site = ? AND durum = ?', username, siteName, 'Beklemede');
        const pendingWithdrawal = await db.get('SELECT id FROM withdrawal_requests WHERE kullaniciAdi = ? AND site = ? AND durum = ?', username, siteName, 'Beklemede');
        res.json({ 
            hasPendingInvestment: !!pendingInvestment, 
            hasPendingWithdrawal: !!pendingWithdrawal 
        });
    } catch (error) {
        console.error("Talep durumu kontrol edilirken hata:", error);
        res.status(500).json({ message: 'Talep durumu kontrol edilirken hata oluştu.' });
    }
});

router.get('/investment-banks', async (req, res) => {
    try {
        const db = getDb();
        const banks = await db.all('SELECT * FROM investment_banks');
        const lockedBanks = req.app.get('lockedBanks');
        
        const banksWithLockStatus = banks.map(bank => ({
            ...bank,
            isLocked: lockedBanks.has(bank.id)
        }));
        const publicBanks = banksWithLockStatus.map(({ islemAdedi, ...bank }) => bank);
        res.json(publicBanks);
    } catch (error) {
        console.error("Yatırım bankaları alınırken hata:", error);
        res.status(500).json({ message: "Sunucu hatası: Banka verileri okunamadı." });
    }
});

router.post('/investment-requests', async (req, res) => {
    try {
        const db = getDb();
        const io = req.app.get('socketio');
        const { kullaniciAdi, kullaniciIsimSoyisim, banka, iban, tutar, bankaHesapSahibi } = req.body;
        const siteAdi = req.site.siteAdi;
        const ipAddress = req.ip || req.connection.remoteAddress;

        if (!kullaniciAdi || kullaniciAdi === 'Bilinmiyor' || !kullaniciIsimSoyisim || kullaniciIsimSoyisim === 'Bilinmiyor') {
            return res.status(400).json({ message: 'Geçersiz kullanıcı bilgileri. Lütfen linkin doğru olduğundan emin olun.' });
        }

        const pendingRequest = await db.get('SELECT id FROM investment_requests WHERE kullaniciAdi = ? AND site = ? AND durum = ?', kullaniciAdi, siteAdi, 'Beklemede');
        if (pendingRequest) {
            return res.status(409).json({ message: 'Zaten bekleyen bir yatırım talebiniz var.' });
        }

        let isSuspicious = 0;
        let suspicionReason = null;
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const similarRequest = await db.get(`SELECT site FROM investment_requests WHERE kullaniciAdi = ? AND iban = ? AND site != ? AND durum = 'Beklemede' AND talepTarihi >= ?`, kullaniciAdi, iban, siteAdi, fiveMinutesAgo);
        if (similarRequest) {
            isSuspicious = 1;
            suspicionReason = `Bu kullanıcı, son 5 dakika içinde '${similarRequest.site}' sitesinden aynı IBAN'a talep oluşturdu.`;
        }

        const newRequest = {
            id: `req-${uuidv4()}`, site: siteAdi, kullaniciAdi, kullaniciIsimSoyisim, banka, iban, tutar: Number(tutar), bankaHesapSahibi, durum: "Beklemede", talepTarihi: new Date().toISOString(), operator: null, ipAddress, isSuspicious, suspicionReason
        };
        
        await db.run(`INSERT INTO investment_requests (id, site, kullaniciAdi, kullaniciIsimSoyisim, banka, iban, tutar, bankaHesapSahibi, durum, talepTarihi, operator, ipAddress, isSuspicious, suspicionReason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, Object.values(newRequest));
        
        io.emit('new_investment_request', newRequest);
        telegramService.sendRequestNotification(newRequest, 'investment');
        res.status(201).json({ message: 'Yatırım talebiniz başarıyla alındı.', requestId: newRequest.id });
    } catch (error) {
        console.error("Yatırım talebi oluşturulurken hata:", error);
        res.status(500).json({ message: "Sunucu hatası: Talep oluşturulamadı." });
    }
});

router.get('/withdrawal-methods', async (req, res) => {
    try {
        const db = getDb();
        const methods = await db.all('SELECT * FROM withdrawal_banks');
        const lockedBanks = req.app.get('lockedBanks');

        const methodsWithLockStatus = methods.map(method => ({
            ...method,
            requiredFields: method.requiredFields ? JSON.parse(method.requiredFields) : [],
            isLocked: lockedBanks.has(method.id)
        }));
        res.json(methodsWithLockStatus);
    } catch (error) {
        console.error("Çekim yöntemleri alınırken hata:", error);
        res.status(500).json({ message: "Sunucu hatası: Çekim yöntemleri okunamadı." });
    }
});

router.post('/withdrawal-requests', async (req, res) => {
    try {
        const db = getDb();
        const io = req.app.get('socketio');
        const { kullaniciAdi, kullaniciIsimSoyisim, yontemAdi, tutar, cekimBilgileri } = req.body;
        const siteAdi = req.site.siteAdi;
        const ipAddress = req.ip || req.connection.remoteAddress;

        if (!kullaniciAdi || kullaniciAdi === 'Bilinmiyor' || !kullaniciIsimSoyisim || kullaniciIsimSoyisim === 'Bilinmiyor') {
            return res.status(400).json({ message: 'Geçersiz kullanıcı bilgileri. Lütfen linkin doğru olduğundan emin olun.' });
        }

        const pendingRequest = await db.get('SELECT id FROM withdrawal_requests WHERE kullaniciAdi = ? AND site = ? AND durum = ?', kullaniciAdi, siteAdi, 'Beklemede');
        if (pendingRequest) {
            return res.status(409).json({ message: 'Zaten bekleyen bir çekim talebiniz var.' });
        }

        const newRequest = {
            id: `wreq-${uuidv4()}`, site: siteAdi, kullaniciAdi, kullaniciIsimSoyisim, yontemAdi, tutar: Number(tutar), durum: "Beklemede", talepTarihi: new Date().toISOString(), cekimBilgileri: JSON.stringify(cekimBilgileri), operator: null, ipAddress, isSuspicious: 0, suspicionReason: null
        };
        
        await db.run(`INSERT INTO withdrawal_requests (id, site, kullaniciAdi, kullaniciIsimSoyisim, yontemAdi, tutar, durum, talepTarihi, cekimBilgileri, operator, ipAddress, isSuspicious, suspicionReason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, Object.values(newRequest));
        
        newRequest.cekimBilgileri = JSON.parse(newRequest.cekimBilgileri);
        io.emit('new_withdrawal_request', newRequest);
        telegramService.sendRequestNotification(newRequest, 'withdrawal');
        res.status(201).json({ message: 'Çekim talebiniz başarıyla alındı.', requestId: newRequest.id });
    } catch (error) {
        console.error("Çekim talebi oluşturulurken hata:", error);
        res.status(500).json({ message: "Sunucu hatası: Çekim talebi oluşturulamadı." });
    }
});

module.exports = router;
