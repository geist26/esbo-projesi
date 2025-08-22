// Dosya: server/routes/testRoutes.js
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const router = express.Router();

// YENİ, DAHA DİREKT TEST ADRESİ
router.get('/telegram-direct', async (req, res) => {
  // --- LÜTFEN BİLGİLERİNİN DOĞRULUĞUNU KONTROL ET ---
  const HARDCODED_TOKEN = "8291221281:AAGaEv9hqDYTaf1q4zFgeB0wgbZtbFCGD0w";
  const HARDCODED_CHAT_ID = "-4854676058";
  // ------------------------------------------------

  try {
    console.log(`--- EN DİREKT TEST BAŞLATILDI ---`);
    console.log(`Kullanılan Token (ilk 5 hanesi): ${HARDCODED_TOKEN.substring(0, 5)}...`);
    console.log(`Kullanılan Kanal ID: ${HARDCODED_CHAT_ID}`);

    const bot = new TelegramBot(HARDCODED_TOKEN);
    await bot.sendMessage(HARDCODED_CHAT_ID, "Bu EN DİREKT test mesajıdır. Eğer bu mesaj geldiyse, Token ve ID doğrudur.");
    
    console.log("--> Mesaj başarıyla gönderildi (gibi görünüyor).");
    res.send("En direkt test mesajı gönderildi. Lütfen Telegram kanalını kontrol et.");

  } catch (error) {
    // Hata olursa, tüm detayıyla terminale yazdır
    console.error("🔴 EN DİREKT TESTTE KRİTİK HATA:", error.response ? error.response.body : error.message);
    res.status(500).send("HATA OLUŞTU! Lütfen sunucu terminalini (siyah ekranı) kontrol et.");
  }
});

module.exports = router;