// Dosya: server/routes/userRoutes.js
const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getDb } = require('../database');
const { logAction } = require('../services/logService');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Ses dosyaları için Multer ayarları
const soundStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const soundsDir = path.join(__dirname, '..', 'uploads', 'sounds');
    if (!fs.existsSync(soundsDir)) {
      fs.mkdirSync(soundsDir, { recursive: true });
    }
    cb(null, soundsDir);
  },
  filename: (req, file, cb) => cb(null, `${req.params.userId}-${Date.now()}${path.extname(file.originalname)}`)
});
const uploadSound = multer({ storage: soundStorage });

// Profil resimleri için Multer ayarları
const pictureStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const picturesDir = path.join(__dirname, '..', 'uploads', 'pictures');
    if (!fs.existsSync(picturesDir)) {
      fs.mkdirSync(picturesDir, { recursive: true });
    }
    cb(null, picturesDir);
  },
  // GÜNCELLEME: Dosya adını, üzerine yazma sorunlarını önlemek için benzersiz yap
  filename: (req, file, cb) => cb(null, `${req.params.userId}-${Date.now()}${path.extname(file.originalname)}`)
});
const uploadPicture = multer({ storage: pictureStorage });


// GET /api/users - Tüm kullanıcıları getir
router.get('/', authMiddleware, async (req, res) => {
    try {
        const db = getDb();
        const users = await db.all('SELECT id, username, createdAt, settings, profilePicture FROM users');
        const parsedUsers = users.map(user => ({
            ...user,
            settings: user.settings ? JSON.parse(user.settings) : {}
        }));
        res.json(parsedUsers);
    } catch (error) {
        res.status(500).json({ message: 'Kullanıcılar alınırken hata oluştu.' });
    }
});

// POST /api/users - Yeni kullanıcı ekle
router.post('/', authMiddleware, async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Kullanıcı adı ve şifre gereklidir.' });
    }

    try {
        const db = getDb();
        const existingUser = await db.get('SELECT id FROM users WHERE username = ?', username);
        if (existingUser) {
            return res.status(409).json({ message: 'Bu kullanıcı adı zaten mevcut.' });
        }

        const newUser = {
            id: uuidv4(),
            username,
            password: bcrypt.hashSync(password, 10),
            createdAt: new Date().toISOString(),
            settings: JSON.stringify({ soundEnabled: true, selectedSound: "/sounds/default.mp3" }),
            profilePicture: null,
            role: 'operator' // Varsayılan rol
        };

        await db.run(
            'INSERT INTO users (id, username, password, createdAt, settings, profilePicture, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
            Object.values(newUser)
        );
        
        await logAction(req.user.username, 'KULLANICI_EKLENDI', `Yeni kullanıcı oluşturuldu: ${username}`);
        const { password: _, ...userToReturn } = newUser;
        userToReturn.settings = JSON.parse(userToReturn.settings);
        res.status(201).json(userToReturn);
    } catch (error) {
        res.status(500).json({ message: 'Kullanıcı eklenirken hata oluştu.' });
    }
});

// PUT /api/users/update-own-password/:userId - Kendi şifresini güncelle
router.put('/update-own-password/:userId', authMiddleware, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const { userId } = req.params;

    if (req.user.id !== userId) {
        return res.status(403).json({ message: "Sadece kendi şifrenizi değiştirebilirsiniz." });
    }

    try {
        const db = getDb();
        const user = await db.get('SELECT * FROM users WHERE id = ?', userId);
        if (!user) return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });

        if (!bcrypt.compareSync(currentPassword, user.password)) {
            return res.status(403).json({ message: 'Mevcut şifreniz yanlış.' });
        }

        const newHashedPassword = bcrypt.hashSync(newPassword, 10);
        await db.run('UPDATE users SET password = ? WHERE id = ?', newHashedPassword, userId);

        await logAction(req.user.username, 'SIFRE_GUNCELLEME', 'Kendi şifresini güncelledi.');
        res.json({ message: 'Şifreniz başarıyla güncellendi.' });
    } catch (error) {
        res.status(500).json({ message: 'Şifre güncellenirken hata oluştu.' });
    }
});

// DELETE /api/users/:id - Kullanıcı sil
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const db = getDb();
        const userToDelete = await db.get('SELECT username FROM users WHERE id = ?', req.params.id);
        if (!userToDelete) return res.status(404).json({ message: 'Kullanıcı bulunamadı' });

        await db.run('DELETE FROM users WHERE id = ?', req.params.id);
        
        await logAction(req.user.username, 'KULLANICI_SILINDI', `Kullanıcı silindi: ${userToDelete.username}`);
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ message: 'Kullanıcı silinirken hata oluştu.' });
    }
});

// PUT /api/users/:id/settings - Ayarları güncelle
router.put('/:id/settings', authMiddleware, async (req, res) => {
    const { settings } = req.body;
    try {
        const db = getDb();
        const user = await db.get('SELECT settings, username FROM users WHERE id = ?', req.params.id);
        if (!user) return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });

        const currentSettings = user.settings ? JSON.parse(user.settings) : {};
        const newSettings = { ...currentSettings, ...settings };
        
        await db.run('UPDATE users SET settings = ? WHERE id = ?', JSON.stringify(newSettings), req.params.id);

        await logAction(req.user.username, 'AYAR_GUNCELLEME', `${user.username} kullanıcısının ayarlarını güncelledi.`);
        res.json({ message: 'Ayarlar kaydedildi.', settings: newSettings });
    } catch (error) {
        res.status(500).json({ message: 'Ayarlar kaydedilirken hata oluştu.' });
    }
});

// POST /api/users/upload-sound/:userId - Ses yükle
router.post('/upload-sound/:userId', authMiddleware, uploadSound.single('soundFile'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Ses dosyası yüklenmedi.' });
  }
  const soundUrl = `/sounds/${req.file.filename}`;
  res.json({ message: 'Ses dosyası yüklendi.', soundUrl });
});

// POST /api/users/upload-picture/:userId - Profil resmi yükle
router.post('/upload-picture/:userId', authMiddleware, uploadPicture.single('pictureFile'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'Resim dosyası yüklenmedi.' });
    }
    const pictureUrl = `/pictures/${req.file.filename}`;
    try {
        const db = getDb();
        await db.run('UPDATE users SET profilePicture = ? WHERE id = ?', pictureUrl, req.params.userId);
        
        await logAction(req.user.username, 'PROFIL_RESMI_YUKLEME', 'Profil resmini güncelledi.');
        res.json({ message: 'Profil resmi yüklendi.', pictureUrl });
    } catch (error) {
        console.error("Profil resmi güncellenirken veritabanı hatası:", error);
        res.status(500).json({ message: 'Profil resmi kaydedilirken hata oluştu.' });
    }
});

module.exports = router;
