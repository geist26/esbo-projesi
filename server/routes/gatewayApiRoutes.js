// Dosya: server/routes/gatewayApiRoutes.js
const express = require('express');
const axios = require('axios');
const { getDb } = require('../database');

const router = express.Router();

const getApiKeyFromSiteId = async (siteId) => {
    try {
        const db = getDb();
        const site = await db.get('SELECT bizimApimiz FROM sites WHERE id = ?', siteId);
        return site ? site.bizimApimiz : null;
    } catch (error) {
        console.error("Veritabanından API anahtarı alınırken hata:", error);
        return null;
    }
};

const forwardRequest = async (req, res, targetPath) => {
    const { siteId } = req.params;
    const apiKey = await getApiKeyFromSiteId(siteId);

    if (!apiKey) {
        return res.status(404).json({ message: "Geçersiz site kimliği veya yapılandırma hatası." });
    }

    try {
        const serverUrl = `http://localhost:5001`;
        const headers = {
            'Content-Type': 'application/json',
            'x-api-key': apiKey
        };

        let response;
        if (req.method === 'POST') {
            response = await axios.post(`${serverUrl}${targetPath}`, req.body, { headers });
        } else {
            response = await axios.get(`${serverUrl}${targetPath}`, { headers, params: req.params });
        }
        
        res.status(response.status).json(response.data);

    } catch (error) {
        const status = error.response ? error.response.status : 500;
        const message = error.response ? error.response.data : { message: "İç sunucu hatası." };
        res.status(status).json(message);
    }
};

// --- GÜVENLİ ROTALAR ---

// YENİ: Müşteri sayfasının site logosu ve adını çekmesi için rota
router.get('/site-info/:siteId', (req, res) => {
    forwardRequest(req, res, '/api/public/site-info');
});

router.get('/request-status/:username/:siteId', (req, res) => {
    const { username } = req.params;
    forwardRequest(req, res, `/api/public/request-status/${username}`);
});

router.get('/investment-banks/:siteId', (req, res) => {
    forwardRequest(req, res, '/api/public/investment-banks');
});

router.get('/withdrawal-methods/:siteId', (req, res) => {
    forwardRequest(req, res, '/api/public/withdrawal-methods');
});

router.post('/investment-requests/:siteId', (req, res) => {
    forwardRequest(req, res, '/api/public/investment-requests');
});

router.post('/withdrawal-requests/:siteId', (req, res) => {
    forwardRequest(req, res, '/api/public/withdrawal-requests');
});

module.exports = router;
