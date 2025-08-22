// Dosya: server/services/logService.js
const { getDb } = require('../database');

/**
 * Sisteme bir admin eylemini kaydeder (loglar).
 * @param {string} adminUsername - Eylemi yapan adminin kullanıcı adı.
 * @param {string} actionType - Eylemin tipi (örn: 'KULLANICI_SILINDI', 'BANKA_GUNCELLEDI').
 * @param {string} details - Eylemle ilgili detaylar (örn: 'emre kullanıcısı silindi.').
 */
const logAction = async (adminUsername, actionType, details) => {
    try {
        const db = getDb();
        await db.run(
            'INSERT INTO action_logs (adminUsername, actionType, details, timestamp) VALUES (?, ?, ?, ?)',
            adminUsername,
            actionType,
            details,
            new Date().toISOString()
        );
    } catch (error) {
        // Loglama hatası kritik bir sistem hatası olmadığı için sadece konsola yazdırıyoruz.
        console.error("İşlem loglanırken hata oluştu:", error);
    }
};

module.exports = { logAction };
