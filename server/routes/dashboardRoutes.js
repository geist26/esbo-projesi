// Dosya: server/routes/dashboardRoutes.js
const express = require('express');
const { getDb } = require('../database'); // Veritabanı bağlantısını import et

const router = express.Router();

// Tarih kontrolü için yardımcı fonksiyonlar
const isToday = (someDate) => {
    const today = new Date();
    const dateToCompare = new Date(someDate);
    return dateToCompare.getDate() === today.getDate() &&
           dateToCompare.getMonth() === today.getMonth() &&
           dateToCompare.getFullYear() === today.getFullYear();
};
const isBeforeToday = (someDate) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Bugünün başlangıcı
    return new Date(someDate) < today;
};

// Ana istatistik rotası
router.get('/stats', async (req, res) => {
    try {
        const db = getDb();

        // Veritabanından tüm gerekli verileri bir kerede çekelim
        const investmentRequests = await db.all('SELECT * FROM investment_requests');
        const withdrawalRequests = await db.all('SELECT * FROM withdrawal_requests');
        const sites = await db.all('SELECT * FROM sites');
        const investmentBanks = await db.all('SELECT * FROM investment_banks');

        // --- HESAPLAMALAR ---

        const todayTotalInvestment = investmentRequests.filter(r => isToday(r.talepTarihi)).reduce((sum, r) => sum + r.tutar, 0);
        const todayTotalWithdrawal = withdrawalRequests.filter(r => isToday(r.talepTarihi)).reduce((sum, r) => sum + r.tutar, 0);

        const todayApprovedInvestment = investmentRequests.filter(r => isToday(r.talepTarihi) && r.durum === 'Onaylandı').reduce((sum, r) => sum + r.tutar, 0);
        const todayApprovedWithdrawal = withdrawalRequests.filter(r => isToday(r.talepTarihi) && r.durum === 'Onaylandı').reduce((sum, r) => sum + r.tutar, 0);

        const highestInvestment = Math.max(0, ...investmentRequests.map(r => r.tutar));

        const approvedInvestments = investmentRequests.filter(r => r.durum === 'Onaylandı');
        const approvedWithdrawals = withdrawalRequests.filter(r => r.durum === 'Onaylandı');

        const groupBy = (arr, key) => arr.reduce((acc, item) => {
            (acc[item[key]] = acc[item[key]] || []).push(item);
            return acc;
        }, {});

        const topInvestmentBanks = Object.entries(groupBy(approvedInvestments, 'banka'))
            .map(([name, requests]) => ({ name, total: requests.reduce((sum, r) => sum + r.tutar, 0) }))
            .sort((a, b) => b.total - a.total).slice(0, 3);

        const topWithdrawalBanks = Object.entries(groupBy(approvedWithdrawals, 'yontemAdi'))
            .map(([name, requests]) => ({ name, total: requests.reduce((sum, r) => sum + r.tutar, 0) }))
            .sort((a, b) => b.total - a.total).slice(0, 3);
            
        const topInvestmentSites = Object.entries(groupBy(approvedInvestments, 'site'))
            .map(([name, requests]) => ({ name, total: requests.reduce((sum, r) => sum + r.tutar, 0) }))
            .sort((a, b) => b.total - a.total).slice(0, 3);
            
        const topWithdrawalSites = Object.entries(groupBy(approvedWithdrawals, 'site'))
            .map(([name, requests]) => ({ name, total: requests.reduce((sum, r) => sum + r.tutar, 0) }))
            .sort((a, b) => b.total - a.total).slice(0, 3);

        let totalCommissionBySite = sites.map(site => {
            const siteInvestments = approvedInvestments.filter(r => r.site === site.siteAdi);
            const siteWithdrawals = approvedWithdrawals.filter(r => r.site === site.siteAdi);
            const investmentCommission = siteInvestments.reduce((sum, r) => sum + r.tutar * (parseFloat(site.yatirimKomisyonu || 0) / 100), 0);
            const withdrawalCommission = siteWithdrawals.reduce((sum, r) => sum + r.tutar * (parseFloat(site.cekimKomisyonu || 0) / 100), 0);
            return { name: site.siteAdi, total: investmentCommission + withdrawalCommission };
        });

        const topCommissionSite = totalCommissionBySite.sort((a, b) => b.total - a.total)[0] || { name: 'N/A', total: 0 };

        const pastInvestments = approvedInvestments.filter(r => isBeforeToday(r.talepTarihi));
        const pastWithdrawals = approvedWithdrawals.filter(r => isBeforeToday(r.talepTarihi));
        let yesterdayCommission = 0;
        sites.forEach(site => {
            const siteInvestments = pastInvestments.filter(r => r.site === site.siteAdi);
            const siteWithdrawals = pastWithdrawals.filter(r => r.site === site.siteAdi);
            yesterdayCommission += siteInvestments.reduce((sum, r) => sum + r.tutar * (parseFloat(site.yatirimKomisyonu || 0) / 100), 0);
            yesterdayCommission += siteWithdrawals.reduce((sum, r) => sum + r.tutar * (parseFloat(site.cekimKomisyonu || 0) / 100), 0);
        });

        const totalBankLimit = investmentBanks.reduce((sum, b) => sum + parseFloat(b.maxYatirim || 0), 0);
        const totalApprovedAmount = approvedInvestments.reduce((sum, r) => sum + r.tutar, 0);
        const remainingBankLimit = totalBankLimit - totalApprovedAmount;

        res.json({
            todayTotalInvestment,
            todayTotalWithdrawal,
            todayApprovedInvestment,
            todayApprovedWithdrawal,
            highestInvestment,
            topInvestmentBanks,
            topWithdrawalBanks,
            topInvestmentSites,
            topWithdrawalSites,
            topCommissionSite,
            yesterdayCommission,
            totalBankLimit,
            remainingBankLimit
        });

    } catch (error) {
        console.error("Dashboard istatistikleri alınırken hata:", error);
        res.status(500).json({ message: "Dashboard verileri alınırken bir hata oluştu." });
    }
});

module.exports = router;
