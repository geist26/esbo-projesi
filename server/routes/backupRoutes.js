// Dosya: server/routes/backupRoutes.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const superAdminAuthMiddleware = require('../middleware/superAdminAuthMiddleware');

const router = express.Router();

// Bu rotadaki tüm isteklerin önce Süper Admin kontrolünden geçmesini sağla
router.use(superAdminAuthMiddleware);

const dbPath = path.join(__dirname, '..', 'data', 'esbo.db');
const backupsDir = path.join(__dirname, '..', 'backups');

/**
 * GET /api/backup/create
 * Veritabanının yedeğini oluşturur ve istemciye indirilebilir bir zip dosyası olarak gönderir.
 */
router.get('/create', (req, res) => {
    try {
        // Yedekler klasörü yoksa oluştur
        if (!fs.existsSync(backupsDir)) {
            fs.mkdirSync(backupsDir, { recursive: true });
        }

        // Tarih ve saat bilgisiyle benzersiz bir dosya adı oluştur
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '-');
        const backupFileName = `esbo-backup-${timestamp}.zip`;
        const backupFilePath = path.join(backupsDir, backupFileName);

        // İndirilebilir bir zip arşivi oluştur
        const output = fs.createWriteStream(backupFilePath);
        const archive = archiver('zip', {
            zlib: { level: 9 } // En iyi sıkıştırma
        });

        // Arşiv oluşturma tamamlandığında...
        output.on('close', () => {
            console.log(`✅ Veritabanı yedeği oluşturuldu: ${backupFileName}`);
            // Dosyayı istemciye indirilebilir olarak gönder
            res.download(backupFilePath, backupFileName, (err) => {
                if (err) {
                    console.error("Yedek indirilirken hata:", err);
                }
                // İndirme tamamlandıktan veya hata oluştuktan sonra geçici zip dosyasını sil
                fs.unlinkSync(backupFilePath);
            });
        });

        archive.on('error', (err) => {
            throw err;
        });

        // Arşivi çıkışa (dosyaya) yönlendir
        archive.pipe(output);
        // Veritabanı dosyasını arşive ekle
        archive.file(dbPath, { name: 'esbo.db' });
        // Arşivi sonlandır (yazma işlemini bitir)
        archive.finalize();

    } catch (error) {
        console.error("Yedek oluşturulurken kritik hata:", error);
        res.status(500).json({ message: "Veritabanı yedeği oluşturulurken bir sunucu hatası oluştu." });
    }
});

module.exports = router;
