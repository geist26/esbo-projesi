// Dosya: server/routes/authRoutes.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../database');

const router = express.Router();
const JWT_SECRET = 'sizin-cok-gizli-anahtariniz-12345';

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const db = getDb();
    // GÜNCELLEME: Kullanıcının rolünü de veritabanından al
    const user = await db.get('SELECT * FROM users WHERE username = ?', username);

    if (!user) {
      return res.status(400).json({ message: 'Kullanıcı adı veya şifre hatalı' });
    }

    const isPasswordCorrect = bcrypt.compareSync(password, user.password);

    if (!isPasswordCorrect) {
      return res.status(400).json({ message: 'Kullanıcı adı veya şifre hatalı' });
    }

    // GÜNCELLEME: Token'ın içine kullanıcının rolünü de ekle
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Şifre hariç tüm kullanıcı bilgilerini (rol ve ayarlar dahil) geri gönder
    const { password: _, ...userToReturn } = user;
    userToReturn.settings = user.settings ? JSON.parse(user.settings) : {};
    
    res.json({ token, user: userToReturn });

  } catch (error) {
      console.error("Giriş sırasında veritabanı hatası:", error);
      res.status(500).json({ message: 'Sunucu hatası' });
  }
});

module.exports = router;
