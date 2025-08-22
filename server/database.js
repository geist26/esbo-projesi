// Dosya: server/database.js
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'esbo.db');
let db;

async function initializeDatabase() {
    if (db) return db;

    try {
        db = await open({
            filename: dbPath,
            driver: sqlite3.Database
        });
        console.log('✅ SQLite veritabanına başarıyla bağlanıldı.');
        await createTables();
        return db;
    } catch (error) {
        console.error('❌ Veritabanı başlatılırken hata oluştu:', error);
        process.exit(1);
    }
}

async function createTables() {
    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            createdAt TEXT NOT NULL,
            settings TEXT,
            profilePicture TEXT,
            role TEXT DEFAULT 'operator' NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sites (
            id TEXT PRIMARY KEY,
            siteAdi TEXT NOT NULL,
            siteLogo TEXT,
            telegramBotToken TEXT,
            telegramGrupId TEXT,
            yatirimKomisyonu REAL DEFAULT 0,
            cekimKomisyonu REAL DEFAULT 0,
            sitedenAlinanApi TEXT,
            bizimApimiz TEXT UNIQUE,
            bakiyeApiAdresi TEXT
        );

        CREATE TABLE IF NOT EXISTS investment_banks (
            id TEXT PRIMARY KEY,
            bankaAdi TEXT,
            iban TEXT UNIQUE,
            hesapSahibi TEXT,
            minYatirim INTEGER,
            maxYatirim INTEGER,
            islemAdedi INTEGER,
            logo TEXT
        );

        CREATE TABLE IF NOT EXISTS withdrawal_banks (
            id TEXT PRIMARY KEY,
            bankaAdi TEXT,
            logo TEXT,
            requiredFields TEXT
        );

        CREATE TABLE IF NOT EXISTS investment_requests (
            id TEXT PRIMARY KEY,
            site TEXT,
            kullaniciAdi TEXT,
            kullaniciIsimSoyisim TEXT,
            banka TEXT,
            iban TEXT,
            tutar REAL,
            bankaHesapSahibi TEXT,
            durum TEXT,
            talepTarihi TEXT,
            operator TEXT,
            ipAddress TEXT,
            isSuspicious INTEGER DEFAULT 0,
            suspicionReason TEXT
        );

        CREATE TABLE IF NOT EXISTS withdrawal_requests (
            id TEXT PRIMARY KEY,
            site TEXT,
            kullaniciAdi TEXT,
            kullaniciIsimSoyisim TEXT,
            yontemAdi TEXT,
            tutar REAL,
            durum TEXT,
            talepTarihi TEXT,
            cekimBilgileri TEXT,
            operator TEXT,
            ipAddress TEXT,
            isSuspicious INTEGER DEFAULT 0,
            suspicionReason TEXT
        );
        
        CREATE TABLE IF NOT EXISTS account_ledger (
            id TEXT PRIMARY KEY,
            siteName TEXT,
            period TEXT,
            totalInvestment REAL,
            totalWithdrawal REAL,
            commissionProfit REAL,
            amountToPay REAL,
            closedAt TEXT,
            closedBy TEXT
        );

        CREATE TABLE IF NOT EXISTS action_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            adminUsername TEXT NOT NULL,
            actionType TEXT NOT NULL,
            details TEXT,
            timestamp TEXT NOT NULL
        );
    `);
    console.log('✅ Veritabanı tabloları kontrol edildi/oluşturuldu.');
}

function getDb() {
    if (!db) {
        throw new Error('Veritabanı başlatılmadı!');
    }
    return db;
}

module.exports = { initializeDatabase, getDb };
