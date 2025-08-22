// Dosya: server/routes/accountRoutes.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

const verifyAdminPassword = async (password) => {
    const db = getDb();
    const adminUser = await db.get('SELECT * FROM users WHERE username = ?', 'admin');
    if (!adminUser) return false;
    return bcrypt.compareSync(password, adminUser.password);
};

// GÜNCELLEME: Daha sağlam ve doğru hesaplama yapan fonksiyon
const calculateSummary = async (siteName, startDate, endDate) => {
    const db = getDb();
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const params = [start.toISOString(), end.toISOString()];
    let siteFilter = '';
    // DÜZELTME: Karşılaştırmayı daha esnek hale getiriyoruz (TRIM).
    if (siteName && siteName !== 'all') {
        siteFilter = 'AND TRIM(site) = TRIM(?)';
        params.push(siteName);
    }

    const approvedInvestments = await db.all(`SELECT * FROM investment_requests WHERE durum = 'Onaylandı' AND talepTarihi >= ? AND talepTarihi <= ? ${siteFilter}`, params);
    const approvedWithdrawals = await db.all(`SELECT * FROM withdrawal_requests WHERE durum = 'Onaylandı' AND talepTarihi >= ? AND talepTarihi <= ? ${siteFilter}`, params);
    const sites = await db.all('SELECT * FROM sites');

    const totalInvestment = approvedInvestments.reduce((sum, r) => sum + r.tutar, 0);
    const totalWithdrawal = approvedWithdrawals.reduce((sum, r) => sum + r.tutar, 0);

    let totalCommission = 0;
    approvedInvestments.forEach(req => {
        const site = sites.find(s => s.siteAdi.trim().toLowerCase() === req.site.trim().toLowerCase());
        if (site && site.yatirimKomisyonu) {
            totalCommission += req.tutar * (parseFloat(site.yatirimKomisyonu) / 100);
        }
    });
    approvedWithdrawals.forEach(req => {
        const site = sites.find(s => s.siteAdi.trim().toLowerCase() === req.site.trim().toLowerCase());
        if (site && site.cekimKomisyonu) {
            totalCommission += req.tutar * (parseFloat(site.cekimKomisyonu) / 100);
        }
    });

    const netDifference = totalInvestment - totalWithdrawal;
    const amountToPay = netDifference - totalCommission;

    return {
        totalInvestment,
        totalWithdrawal,
        commissionProfit: totalCommission,
        amountToPay
    };
};

router.post('/calculate', authMiddleware, async (req, res) => {
    const { siteName, startDate, endDate } = req.body;
    if (!siteName || !startDate || !endDate) {
        return res.status(400).json({ message: "Site, başlangıç ve bitiş tarihi gereklidir." });
    }
    const summary = await calculateSummary(siteName, startDate, endDate);
    res.json(summary);
});

router.post('/close', authMiddleware, async (req, res) => {
    if (req.user.username !== 'admin') {
        return res.status(403).json({ message: 'Bu işlem için yetkiniz yok.' });
    }
    const { siteName, startDate, endDate, password } = req.body;
    if (!await verifyAdminPassword(password)) {
        return res.status(401).json({ message: 'Admin şifresi yanlış.' });
    }

    const db = getDb();
    const summary = await calculateSummary(siteName, startDate, endDate);
    
    await db.run(
        `INSERT INTO account_ledger (id, siteName, period, totalInvestment, totalWithdrawal, commissionProfit, amountToPay, closedAt, closedBy)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        uuidv4(), siteName, `${startDate} - ${endDate}`, summary.totalInvestment, summary.totalWithdrawal, summary.commissionProfit, summary.amountToPay, new Date().toISOString(), req.user.username
    );

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    
    const params = [start.toISOString(), end.toISOString()];
    let siteFilter = '';
    // DÜZELTME: Silme işleminde de esnek karşılaştırma kullanıyoruz.
    if (siteName !== 'all') {
        siteFilter = 'AND TRIM(site) = TRIM(?)';
        params.push(siteName);
    }
    
    const statusesToDelete = `('Onaylandı', 'Reddedildi')`;
    await db.run(`DELETE FROM investment_requests WHERE durum IN ${statusesToDelete} AND talepTarihi >= ? AND talepTarihi <= ? ${siteFilter}`, params);
    await db.run(`DELETE FROM withdrawal_requests WHERE durum IN ${statusesToDelete} AND talepTarihi >= ? AND talepTarihi <= ? ${siteFilter}`, params);

    res.json({ message: 'Hesap başarıyla kapatıldı ve deftere işlendi.' });
});

router.get('/ledger', authMiddleware, async (req, res) => {
    const db = getDb();
    const ledger = await db.all('SELECT * FROM account_ledger ORDER BY closedAt DESC');
    res.json(ledger);
});

router.delete('/ledger/:id', authMiddleware, async (req, res) => {
    if (req.user.username !== 'admin') {
        return res.status(403).json({ message: 'Bu işlem için yetkiniz yok.' });
    }
    const db = getDb();
    await db.run('DELETE FROM account_ledger WHERE id = ?', req.params.id);
    res.status(204).send();
});

module.exports = router;
