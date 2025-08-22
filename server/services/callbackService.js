// Dosya: server/services/callbackService.js
const fs = require('fs');
const path = require('path');
const axios = require('axios'); // Sunucudan sunucuya istek atmak için axios'u kullanacağız

const sitesPath = path.join(__dirname, '..', 'data', 'sites.json');

/**
 * Müşteri sitesine bakiye güncelleme bildirimini (callback/webhook) gönderir.
 * @param {object} options - Gönderilecek bilgiler.
 * @param {string} options.siteName - İşlemin yapıldığı sitenin adı.
 * @param {object} options.requestDetails - Onaylanan talebin detayları.
 * @param {'deposit' | 'withdrawal'} options.type - İşlem tipi (yatırım veya çekim).
 */
const sendBalanceUpdate = async ({ siteName, requestDetails, type }) => {
    console.log(`-> Bakiye güncelleme süreci başlatıldı: ${siteName} - ${requestDetails.kullaniciAdi}`);
    try {
        const sites = JSON.parse(fs.readFileSync(sitesPath, 'utf8'));
        const siteConfig = sites.find(s => s.siteAdi.trim() === siteName.trim());

        // 1. Sitenin callback adresi var mı diye kontrol et
        if (!siteConfig || !siteConfig.bakiyeApiAdresi) {
            console.log(`⚠️ UYARI: '${siteName}' sitesi için bir Bakiye Güncelleme Adresi (Callback URL) tanımlanmamış. Bakiye güncellenemedi.`);
            return;
        }

        // 2. Müşteri sitesine gönderilecek olan veri paketini (payload) hazırla
        const payload = {
            username: requestDetails.kullaniciAdi,
            amount: requestDetails.tutar,
            transactionType: type, // 'deposit' (yatırım) veya 'withdrawal' (çekim)
            transactionId: requestDetails.id // İşlemin bizim sistemimizdeki benzersiz ID'si
        };

        // 3. Müşteri sitesinin bizden istediği bir API anahtarı varsa, onu başlığa (header) ekle
        const headers = {
            'Content-Type': 'application/json',
        };
        if (siteConfig.sitedenAlinanApi) {
            // Genellikle 'Authorization' başlığı kullanılır, 'Bearer' standardı yaygındır.
            headers['Authorization'] = `Bearer ${siteConfig.sitedenAlinanApi}`;
        }

        console.log(`--> ${siteConfig.bakiyeApiAdresi} adresine POST isteği gönderiliyor...`);
        console.log(`--> Payload:`, payload);

        // 4. Müşteri sitesine POST isteğini gönder
        await axios.post(siteConfig.bakiyeApiAdresi, payload, { headers });

        console.log(`✅ BAŞARILI: '${siteName}' sitesindeki '${requestDetails.kullaniciAdi}' kullanıcısının bakiyesi için güncelleme isteği gönderildi.`);

    } catch (error) {
        console.error(`❌ HATA: '${siteName}' sitesine bakiye güncelleme isteği gönderilirken bir hata oluştu.`);
        // Canlı bir sistemde burada admini bilgilendirecek bir loglama sistemi (örn: Sentry, LogRocket) kullanılabilir.
        console.error("Hata Detayı:", error.response ? error.response.data : error.message);
    }
};

module.exports = {
    sendBalanceUpdate
};
