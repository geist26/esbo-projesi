// Dosya: server/createAdmin.js
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { initializeDatabase, getDb } = require('./database');

// Oluşturulacak veya rolleri güncellenecek kullanıcıların listesi
const usersToCreateOrUpdate = [
    {
        username: 'admin',
        password: 'password123',
        role: 'operator' // Standart admin (operatör)
    },
    {
        username: 'superadmin',
        password: 'superpassword123', // Canlıya almadan önce bu şifreyi değiştirin
        role: 'super_admin' // Süper Admin
    }
];

/**
 * Veritabanını başlatır ve başlangıç kullanıcılarını oluşturur/günceller.
 */
async function setupInitialUsers() {
    // Önce veritabanının hazır olduğundan emin ol
    await initializeDatabase();
    const db = getDb();

    try {
        // Listedeki her bir kullanıcı için işlem yap
        for (const userData of usersToCreateOrUpdate) {
            // Kullanıcının veritabanında olup olmadığını kontrol et
            const existingUser = await db.get('SELECT * FROM users WHERE username = ?', userData.username);
            
            if (existingUser) {
                // Eğer kullanıcı varsa, sadece rolünü istenen role güncelle
                if (existingUser.role !== userData.role) {
                    console.log(`'${userData.username}' kullanıcısı zaten var. Rolü güncelleniyor...`);
                    await db.run('UPDATE users SET role = ? WHERE username = ?', userData.role, userData.username);
                    console.log(`'${userData.username}' kullanıcısının rolü '${userData.role}' olarak güncellendi.`);
                } else {
                    console.log(`'${userData.username}' kullanıcısı zaten doğru role sahip. İşlem yapılmadı.`);
                }
            } else {
                // Eğer kullanıcı yoksa, yeni bir tane oluştur
                const newUser = {
                    id: uuidv4(),
                    username: userData.username,
                    password: bcrypt.hashSync(userData.password, 10),
                    createdAt: new Date().toISOString(),
                    settings: JSON.stringify({
                        soundEnabled: true,
                        selectedSound: "/sounds/default.mp3"
                    }),
                    profilePicture: null,
                    role: userData.role
                };

                await db.run(
                    'INSERT INTO users (id, username, password, createdAt, settings, profilePicture, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    Object.values(newUser)
                );
                console.log(`✅ Kullanıcı '${userData.username}' ('${userData.role}' rolüyle) başarıyla oluşturuldu.`);
                console.log(`   🔑 Şifre: ${userData.password}`);
            }
        }
    } catch (error) {
        console.error("İlk kullanıcılar oluşturulurken hata:", error);
    }
}

// Fonksiyonu çalıştır
setupInitialUsers();
