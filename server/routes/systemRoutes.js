// Dosya: server/routes/systemRoutes.js
const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb } = require('../database'); // Veritabanı bağlantısını import et
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Şifre doğrulama için yardımcı fonksiyon
const verifyAdminPassword = async (password) => {
    const db = getDb();
    const adminUser = await db.get('SELECT * FROM users WHERE username = ?', 'admin');
    if (!adminUser) return false;
    return bcrypt.compareSync(password, adminUser.password);
};

// Rota 1: Belirli işlemleri veritabanından sıfırlama
router.post('/reset-transactions', authMiddleware, async (req, res) => {
    if (req.user.username !== 'admin') {
        return res.status(403).json({ message: 'Bu işlem için yetkiniz yok.' });
    }

    const { site, deleteApproved, deleteRejected, password } = req.body;

    if (!await verifyAdminPassword(password)) {
        return res.status(401).json({ message: 'Admin şifresi yanlış.' });
    }

    try {
        const db = getDb();
        const statusesToDelete = [];
        if (deleteApproved) statusesToDelete.push('Onaylandı');
        if (deleteRejected) statusesToDelete.push('Reddedildi');

        if (statusesToDelete.length > 0) {
            const statusPlaceholders = statusesToDelete.map(() => '?').join(',');
            
            let investmentQuery = `DELETE FROM investment_requests WHERE durum IN (${statusPlaceholders})`;
            let withdrawalQuery = `DELETE FROM withdrawal_requests WHERE durum IN (${statusPlaceholders})`;
            
            const investmentParams = [...statusesToDelete];
            const withdrawalParams = [...statusesToDelete];

            if (site !== 'all') {
                investmentQuery += ' AND site = ?';
                investmentParams.push(site);
                withdrawalQuery += ' AND site = ?';
                withdrawalParams.push(site);
            }

            await db.run(investmentQuery, investmentParams);
            await db.run(withdrawalQuery, withdrawalParams);
        }

        res.json({ message: 'Seçilen işlemler başarıyla sıfırlandı.' });
    } catch (error) {
        console.error("İşlemler sıfırlanırken hata:", error);
        res.status(500).json({ message: 'İşlemler sıfırlanırken bir hata oluştu.' });
    }
});

// Rota 2: Tüm sistemi veritabanından sıfırlama (Hard Reset)
router.post('/hard-reset', authMiddleware, async (req, res) => {
    if (req.user.username !== 'admin') {
        return res.status(403).json({ message: 'Bu işlem için yetkiniz yok.' });
    }

    const { password } = req.body;

    if (!await verifyAdminPassword(password)) {
        return res.status(401).json({ message: 'Admin şifresi yanlış.' });
    }

    try {
        const db = getDb();
        // 'admin' kullanıcısı hariç tüm kullanıcıları sil
        await db.run("DELETE FROM users WHERE username != 'admin'");
        
        // Diğer tüm tabloları tamamen boşalt
        await db.run("DELETE FROM sites");
        await db.run("DELETE FROM investment_banks");
        await db.run("DELETE FROM withdrawal_banks");
        await db.run("DELETE FROM investment_requests");
        await db.run("DELETE FROM withdrawal_requests");
        await db.run("DELETE FROM account_ledger");

        res.json({ message: 'Sistem başarıyla sıfırlandı! Sadece "admin" kullanıcısı korundu.' });
    } catch (error) {
        console.error("Sistem sıfırlanırken hata:", error);
        res.status(500).json({ message: 'Sistem sıfırlanırken bir hata oluştu.' });
    }
});

module.exports = router;
