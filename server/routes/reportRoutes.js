// Dosya: server/routes/reportRoutes.js
const express = require('express');
const ExcelJS = require('exceljs');
const { getDb } = require('../database');

const router = express.Router();

const getDateFilterQuery = (dateRange, params) => {
    const now = new Date();
    let startDate;

    if (dateRange === 'daily') {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (dateRange === 'weekly') {
        const firstDayOfWeek = now.getDate() - now.getDay();
        startDate = new Date(now.setDate(firstDayOfWeek));
        startDate.setHours(0, 0, 0, 0);
    } else if (dateRange === 'monthly') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (dateRange === 'yearly') {
        startDate = new Date(now.getFullYear(), 0, 1);
    } else {
        return '';
    }
    params.push(startDate.toISOString());
    return 'AND talepTarihi >= ?';
};

router.get('/summary', async (req, res) => {
    try {
        const db = getDb();
        const { site: filterSite, dateRange } = req.query;

        let baseInvQuery = 'SELECT tutar, site FROM investment_requests WHERE durum = ?';
        let baseWdrQuery = 'SELECT tutar, site FROM withdrawal_requests WHERE durum = ?';
        const paramsInv = ['Onaylandı'];
        const paramsWdr = ['Onaylandı'];

        const dateQueryPart = getDateFilterQuery(dateRange, []); // Parametreleri ayrı yönet
        if (dateQueryPart) {
            baseInvQuery += ` ${dateQueryPart}`;
            baseWdrQuery += ` ${dateQueryPart}`;
            paramsInv.push(new Date(dateRange === 'daily' ? new Date().setHours(0,0,0,0) : dateRange === 'weekly' ? new Date(new Date().setDate(new Date().getDate() - new Date().getDay())).setHours(0,0,0,0) : dateRange === 'monthly' ? new Date(new Date().getFullYear(), new Date().getMonth(), 1) : new Date(new Date().getFullYear(), 0, 1)).toISOString());
            paramsWdr.push(new Date(dateRange === 'daily' ? new Date().setHours(0,0,0,0) : dateRange === 'weekly' ? new Date(new Date().setDate(new Date().getDate() - new Date().getDay())).setHours(0,0,0,0) : dateRange === 'monthly' ? new Date(new Date().getFullYear(), new Date().getMonth(), 1) : new Date(new Date().getFullYear(), 0, 1)).toISOString());
        }

        if (filterSite) {
            baseInvQuery += ' AND site = ?';
            paramsInv.push(filterSite);
            baseWdrQuery += ' AND site = ?';
            paramsWdr.push(filterSite);
        }

        const approvedInvestments = await db.all(baseInvQuery, paramsInv);
        const approvedWithdrawals = await db.all(baseWdrQuery, paramsWdr);
        const sites = await db.all('SELECT * FROM sites');

        const toplamYatirim = approvedInvestments.reduce((sum, req) => sum + req.tutar, 0);
        const toplamCekim = approvedWithdrawals.reduce((sum, req) => sum + req.tutar, 0);
        
        let yatirimKomisyonKari = 0;
        let cekimKomisyonKari = 0;

        approvedInvestments.forEach(req => {
            const site = sites.find(s => s.siteAdi.trim().toLowerCase() === req.site.trim().toLowerCase());
            if (site && site.yatirimKomisyonu) {
                yatirimKomisyonKari += req.tutar * (parseFloat(site.yatirimKomisyonu) / 100);
            }
        });

        approvedWithdrawals.forEach(req => {
            const site = sites.find(s => s.siteAdi.trim().toLowerCase() === req.site.trim().toLowerCase());
            if (site && site.cekimKomisyonu) {
                cekimKomisyonKari += req.tutar * (parseFloat(site.cekimKomisyonu) / 100);
            }
        });

        res.json({
            toplamYatirim,
            toplamCekim,
            netFark: toplamYatirim - toplamCekim,
            yatirimKomisyonKari,
            cekimKomisyonKari,
            toplamKomisyonKari: yatirimKomisyonKari + cekimKomisyonKari
        });

    } catch (error) {
        console.error("Rapor oluşturulurken hata:", error);
        res.status(500).json({ message: 'Rapor oluşturulurken bir hata oluştu.', error: error.message });
    }
});

router.get('/export', async (req, res) => {
    try {
        const db = getDb();
        const { site: filterSite, dateRange } = req.query;

        let invQuery = 'SELECT * FROM investment_requests WHERE 1=1';
        let wdrQuery = 'SELECT * FROM withdrawal_requests WHERE 1=1';
        const params = [];

        const dateQueryPart = getDateFilterQuery(dateRange, params);
        invQuery += ` ${dateQueryPart}`;
        wdrQuery += ` ${dateQueryPart}`;

        let finalInvParams = [...params];
        let finalWdrParams = [...params];

        if (filterSite) {
            invQuery += ' AND site = ?';
            wdrQuery += ' AND site = ?';
            finalInvParams.push(filterSite);
            finalWdrParams.push(filterSite);
        }

        const investmentRequests = await db.all(invQuery, finalInvParams);
        const withdrawalRequests = await db.all(wdrQuery, finalWdrParams);
        
        const workbook = new ExcelJS.Workbook();
        const investmentSheet = workbook.addWorksheet('Yatırım Talepleri');
        investmentSheet.columns = [
            { header: 'ID', key: 'id', width: 30 },
            { header: 'Site', key: 'site', width: 15 },
            { header: 'Kullanıcı Adı', key: 'kullaniciAdi', width: 20 },
            { header: 'Tutar', key: 'tutar', width: 15, style: { numFmt: '#,##0.00 "TL"' } },
            { header: 'Durum', key: 'durum', width: 15 },
            { header: 'Tarih', key: 'talepTarihi', width: 25 },
            { header: 'Operatör', key: 'operator', width: 20 },
        ];
        investmentSheet.addRows(investmentRequests);

        const withdrawalSheet = workbook.addWorksheet('Çekim Talepleri');
        withdrawalSheet.columns = [
            { header: 'ID', key: 'id', width: 30 },
            { header: 'Site', key: 'site', width: 15 },
            { header: 'Kullanıcı Adı', key: 'kullaniciAdi', width: 20 },
            { header: 'Tutar', key: 'tutar', width: 15, style: { numFmt: '#,##0.00 "TL"' } },
            { header: 'Durum', key: 'durum', width: 15 },
            { header: 'Tarih', key: 'talepTarihi', width: 25 },
            { header: 'Operatör', key: 'operator', width: 20 },
        ];
        withdrawalSheet.addRows(withdrawalRequests);
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=' + 'rapor.xlsx');
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error("Excel oluşturulurken hata:", error);
        res.status(500).send("Rapor oluşturulamadı.");
    }
});

module.exports = router;
