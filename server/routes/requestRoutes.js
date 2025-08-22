const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');
const telegramService = require('../services/telegramService');
const callbackService = require('../services/callbackService');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

const checkBankLimitsAndLock = async (req, approvedRequest) => {
    try {
        const db = getDb();
        const bank = await db.get('SELECT * FROM investment_banks WHERE iban = ?', approvedRequest.iban);
        if (!bank) {
            return;
        }

        const maxAmount = parseFloat(bank.maxYatirim);
        const maxTransactions = parseInt(bank.islemAdedi, 10);

        const stats = await db.get(
            'SELECT COUNT(*) as count, SUM(tutar) as total FROM investment_requests WHERE iban = ? AND durum = ?',
            bank.iban, 'Onaylandı'
        );

        const totalAmount = stats.total || 0;
        const transactionCount = stats.count || 0;

        if (totalAmount >= maxAmount || transactionCount >= maxTransactions) {
            req.lockedBanks.add(bank.id);
            req.io.emit('bank_status_updated', { bankId: bank.id, isLocked: true });
            req.io.to('admins').emit('bank_limit_full_notification', { bankName: bank.bankaAdi });
            telegramService.sendLimitFullNotification({ 
                bankName: bank.bankaAdi, 
                siteName: approvedRequest.site,
                bankId: bank.id 
            });
        }
    } catch (error) {
        console.error("Banka limit kontrolü sırasında hata:", error);
    }
};

router.get('/investment', async (req, res) => {
    try {
        const db = getDb();
        let query = 'SELECT * FROM investment_requests WHERE 1=1';
        const params = [];
        if (req.query.site) {
            query += ' AND site LIKE ?';
            params.push(`%${req.query.site}%`);
        }
        if (req.query.kullaniciAdi) {
            query += ' AND kullaniciAdi LIKE ?';
            params.push(`%${req.query.kullaniciAdi}%`);
        }
        if (req.query.banka) {
            query += ' AND banka LIKE ?';
            params.push(`%${req.query.banka}%`);
        }
        if (req.query.durum) {
            query += ' AND durum = ?';
            params.push(req.query.durum);
        }
        query += ' ORDER BY talepTarihi DESC';
        
        const requests = await db.all(query, params);
        res.json(requests);
    } catch (error) {
        console.error("Yatırım talepleri alınırken hata:", error);
        res.status(500).json({ message: 'Yatırım talepleri alınırken hata oluştu.' });
    }
});

router.put('/investment/:id/status', authMiddleware, async (req, res) => {
    const { status } = req.body;
    const { id } = req.params;
    const operator = req.user.username;

    try {
        const db = getDb();
        await db.run(
            'UPDATE investment_requests SET durum = ?, operator = ? WHERE id = ?',
            status, operator, id
        );
        
        const updatedRequest = await db.get('SELECT * FROM investment_requests WHERE id = ?', id);

        if (status === 'Onaylandı') {
            await checkBankLimitsAndLock(req, updatedRequest);
            await callbackService.sendBalanceUpdate({
                siteName: updatedRequest.site,
                requestDetails: updatedRequest,
                type: 'deposit'
            });
        }
        res.json(updatedRequest);
    } catch (error) {
        console.error("Yatırım talebi güncellenirken hata:", error);
        res.status(500).json({ message: 'Yatırım talebi güncellenirken hata oluştu.' });
    }
});

router.get('/withdrawal', async (req, res) => {
    try {
        const db = getDb();
        let query = 'SELECT * FROM withdrawal_requests WHERE 1=1';
        const params = [];
        if (req.query.site) {
            query += ' AND site LIKE ?';
            params.push(`%${req.query.site}%`);
        }
        if (req.query.kullaniciAdi) {
            query += ' AND kullaniciAdi LIKE ?';
            params.push(`%${req.query.kullaniciAdi}%`);
        }
        if (req.query.yontemAdi) {
            query += ' AND yontemAdi LIKE ?';
            params.push(`%${req.query.yontemAdi}%`);
        }
        if (req.query.durum) {
            query += ' AND durum = ?';
            params.push(req.query.durum);
        }
        query += ' ORDER BY talepTarihi DESC';

        const requests = await db.all(query, params);
        const parsedRequests = requests.map(req => ({
            ...req,
            cekimBilgileri: req.cekimBilgileri ? JSON.parse(req.cekimBilgileri) : []
        }));
        res.json(parsedRequests);
    } catch (error) {
        console.error("Çekim talepleri alınırken hata:", error);
        res.status(500).json({ message: 'Çekim talepleri alınırken hata oluştu.' });
    }
});

router.put('/withdrawal/:id/status', authMiddleware, async (req, res) => {
    const { status } = req.body;
    const { id } = req.params;
    const operator = req.user.username;

    try {
        const db = getDb();
        await db.run(
            'UPDATE withdrawal_requests SET durum = ?, operator = ? WHERE id = ?',
            status, operator, id
        );

        const updatedRequest = await db.get('SELECT * FROM withdrawal_requests WHERE id = ?', id);
        updatedRequest.cekimBilgileri = JSON.parse(updatedRequest.cekimBilgileri);

        if (status === 'Onaylandı') {
            await callbackService.sendBalanceUpdate({
                siteName: updatedRequest.site,
                requestDetails: updatedRequest,
                type: 'withdrawal'
            });
        }
        res.json(updatedRequest);
    } catch (error) {
        console.error("Çekim talebi güncellenirken hata:", error);
        res.status(500).json({ message: 'Çekim talebi güncellenirken hata oluştu.' });
    }
});

router.post('/investment/simulate', async (req, res) => {
    const { siteAdi } = req.body;
    if (!siteAdi) {
        return res.status(400).json({ message: 'Lütfen bir siteAdi gönderin.' });
    }
    
    const newSimulatedRequest = {
        id: `sim-${Date.now()}`,
        site: siteAdi,
        kullaniciAdi: "sim_user",
        kullaniciIsimSoyisim: "Simülasyon Kullanıcısı",
        banka: "Simülasyon Bankası",
        iban: "TR000000000000000000000000",
        tutar: Math.floor(Math.random() * 1000) + 50,
        bankaHesapSahibi: "Simülasyon Hesap Sahibi",
        durum: "Beklemede",
        talepTarihi: new Date().toISOString(),
        operator: null
    };

    try {
        const db = getDb();
        await db.run(
            `INSERT INTO investment_requests (id, site, kullaniciAdi, kullaniciIsimSoyisim, banka, iban, tutar, bankaHesapSahibi, durum, talepTarihi, operator)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            Object.values(newSimulatedRequest)
        );
        
        telegramService.sendRequestNotification(newSimulatedRequest, 'investment');
        res.status(200).json({ message: `'${siteAdi}' sitesi için simülasyon talebi oluşturuldu.`, request: newSimulatedRequest });
    } catch (error) {
        console.error("Yatırım simülasyonu hatası:", error);
        res.status(500).json({ message: 'Simülasyon talebi oluşturulurken veritabanı hatası oluştu.' });
    }
});

router.post('/withdrawal/simulate', async (req, res) => {
    const { siteAdi } = req.body;
    if (!siteAdi) {
        return res.status(400).json({ message: 'Lütfen bir siteAdi gönderin.' });
    }

    const newSimulatedRequest = {
        id: `wsim-${Date.now()}`,
        site: siteAdi,
        kullaniciAdi: "sim_user_withdraw",
        kullaniciIsimSoyisim: "Çekim Simülasyon Kullanıcısı",
        yontemAdi: "Simülasyon Yöntemi",
        tutar: Math.floor(Math.random() * 500) + 50,
        durum: "Beklemede",
        talepTarihi: new Date().toISOString(),
        cekimBilgileri: JSON.stringify([{ "label": "Test Alanı 1", "value": "Test Değeri 1" }, { "label": "Test Alanı 2", "value": "Test Değeri 2" }]),
        operator: null
    };

    try {
        const db = getDb();
        await db.run(
            `INSERT INTO withdrawal_requests (id, site, kullaniciAdi, kullaniciIsimSoyisim, yontemAdi, tutar, durum, talepTarihi, cekimBilgileri, operator)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            Object.values(newSimulatedRequest)
        );
        
        newSimulatedRequest.cekimBilgileri = JSON.parse(newSimulatedRequest.cekimBilgileri);
        telegramService.sendRequestNotification(newSimulatedRequest, 'withdrawal');
        res.status(200).json({ message: `'${siteAdi}' sitesi için çekim simülasyon talebi oluşturuldu.`, request: newSimulatedRequest });
    } catch (error) {
        console.error("Çekim simülasyonu hatası:", error);
        res.status(500).json({ message: 'Simülasyon talebi oluşturulurken veritabanı hatası oluştu.' });
    }
});

module.exports = router;
