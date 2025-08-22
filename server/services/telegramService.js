const TelegramBot = require('node-telegram-bot-api');
const { getDb } = require('../database');
const callbackService = require('./callbackService');

let bot;
let siteConfigs = {};
let ioInstance;
let lockedBanksInstance;
const conversationState = {};

const isToday = (d) => {
    const t = new Date();
    const c = new Date(d);
    return c.getDate() === t.getDate() && c.getMonth() === t.getMonth() && c.getFullYear() === t.getFullYear();
};

const isBeforeToday = (d) => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return new Date(d) < t;
};

const formatCurrency = (amount) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(amount || 0);

const calculateStats = async (filter = {}) => {
    const { siteName, dateFilter } = filter;
    const db = getDb();
    
    let investmentRequests = await db.all('SELECT * FROM investment_requests');
    let withdrawalRequests = await db.all('SELECT * FROM withdrawal_requests');
    const sites = await db.all('SELECT * FROM sites');

    if (siteName && siteName !== 'all') {
        investmentRequests = investmentRequests.filter(r => r.site.trim().toLowerCase() === siteName.trim().toLowerCase());
        withdrawalRequests = withdrawalRequests.filter(r => r.site.trim().toLowerCase() === siteName.trim().toLowerCase());
    }

    if (dateFilter === 'today') {
        investmentRequests = investmentRequests.filter(r => isToday(r.talepTarihi));
        withdrawalRequests = withdrawalRequests.filter(r => isToday(r.talepTarihi));
    } else if (dateFilter === 'before_today') {
        investmentRequests = investmentRequests.filter(r => isBeforeToday(r.talepTarihi));
        withdrawalRequests = withdrawalRequests.filter(r => isBeforeToday(r.talepTarihi));
    }

    const approvedInvestments = investmentRequests.filter(r => r.durum === 'Onaylandı');
    const approvedWithdrawals = withdrawalRequests.filter(r => r.durum === 'Onaylandı');

    let totalCommission = 0;
    sites.forEach(site => {
        if (!siteName || siteName === 'all' || site.siteAdi.trim().toLowerCase() === siteName.trim().toLowerCase()) {
            const siteInvestments = approvedInvestments.filter(r => r.site.trim().toLowerCase() === site.siteAdi.trim().toLowerCase());
            const siteWithdrawals = approvedWithdrawals.filter(r => r.site.trim().toLowerCase() === site.siteAdi.trim().toLowerCase());
            totalCommission += siteInvestments.reduce((sum, r) => sum + r.tutar * (parseFloat(site.yatirimKomisyonu || 0) / 100), 0);
            totalCommission += siteWithdrawals.reduce((sum, r) => sum + r.tutar * (parseFloat(site.cekimKomisyonu || 0) / 100), 0);
        }
    });

    return {
        totalInvestment: approvedInvestments.reduce((sum, r) => sum + r.tutar, 0),
        totalWithdrawal: approvedWithdrawals.reduce((sum, r) => sum + r.tutar, 0),
        totalCommission,
    };
};

const checkBankLimitsAndLock = async (approvedRequest) => {
    try {
        const db = getDb();
        const bank = await db.get('SELECT * FROM investment_banks WHERE iban = ?', approvedRequest.iban);
        if (!bank) return;

        const stats = await db.get('SELECT COUNT(*) as count, SUM(tutar) as total FROM investment_requests WHERE iban = ? AND durum = ?', bank.iban, 'Onaylandı');
        const totalAmount = stats.total || 0;
        const transactionCount = stats.count || 0;

        if (totalAmount >= parseFloat(bank.maxYatirim) || transactionCount >= parseInt(bank.islemAdedi, 10)) {
            lockedBanksInstance.add(bank.id);
            ioInstance.emit('bank_status_updated', { bankId: bank.id, isLocked: true });
            ioInstance.to('admins').emit('bank_limit_full_notification', { bankName: bank.bankaAdi });
            sendLimitFullNotification({ bankName: bank.bankaAdi, siteName: approvedRequest.site, bankId: bank.id });
        }
    } catch (error) {
        console.error("Banka limit kontrolü sırasında hata (Telegram):", error);
    }
};

const formatMessage = (request, type) => {
    if (type === 'investment') {
        return `👍 *Yeni Yatırım Talebi* 👍\n\n*Site Adı:* ${request.site}\n*Kullanıcı Adı:* ${request.kullaniciAdi}\n*Müşteri İsim Soyisim:* ${request.kullaniciIsimSoyisim}\n*Banka Adı:* ${request.banka}\n*IBAN:* \`${request.iban}\`\n*Yatırım Tutarı:* *${request.tutar} TL*`;
    } else if (type === 'withdrawal') {
        const cekimBilgileri = typeof request.cekimBilgileri === 'string' ? JSON.parse(request.cekimBilgileri) : request.cekimBilgileri;
        let fieldsText = cekimBilgileri.map(f => `*${f.label}:* \`${f.value}\``).join('\n');
        return `💸 *Yeni Çekim Talebi* 💸\n\n*Site Adı:* ${request.site}\n*Kullanıcı Adı:* ${request.kullaniciAdi}\n*Tutar:* *${request.tutar} TL*\n\n*Çekim Bilgileri:*\n${fieldsText}`;
    }
    return '';
};

const sendRequestNotification = (request, type) => {
  if (!bot) return;
  const cleanRequestSiteName = request.site.trim();
  const siteConfig = siteConfigs[cleanRequestSiteName];
  if (!siteConfig) return;

  const message = formatMessage(request, type);
  const options = {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Onayla', callback_data: `approve_${type}_${request.id}` },
          { text: '❌ Reddet', callback_data: `reject_${type}_${request.id}` }
        ]
      ]
    }
  };
  
  bot.sendMessage(siteConfig.groupId, message, options)
    .then(() => {
        if (request.isSuspicious) {
            const warningMessage = `⚠️ *ŞÜPHELİ İŞLEM UYARISI* ⚠️\n\n*Sebep:* ${request.suspicionReason}`;
            bot.sendMessage(siteConfig.groupId, warningMessage, { parse_mode: 'Markdown' });
        }
    })
    .catch(err => console.error("TELEGRAM MESAJ GÖNDERME HATASI:", err.response ? err.response.body : err.message));
};

const sendLimitFullNotification = ({ bankName, siteName, bankId }) => {
    if (!bot) return;
    const siteConfig = siteConfigs[siteName.trim()];
    if (!siteConfig || !siteConfig.groupId) return;
    const message = `❗️ *LİMİT UYARISI* ❗️\n\n*Site:* ${siteName}\n*Banka:* ${bankName}\n\nBu bankanın yatırım limiti dolmuştur ve kilitlenmiştir.`;
    bot.sendMessage(siteConfig.groupId, message, { 
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: '🏦 Bilgileri Güncelle', callback_data: `update_bank_${bankId}` }]
            ]
        }
    });
};

const sendProactiveLimitWarning = ({ bankName, siteName, requestDetails }) => {
    if (!bot) return;
    const siteConfig = siteConfigs[siteName.trim()];
    if (!siteConfig || !siteConfig.groupId) return;
    const message = `⚠️ *PROAKTİF LİMİT UYARISI* ⚠️\n\n*Site:* ${siteName}\n*Banka:* ${bankName}\n*Kullanıcı:* ${requestDetails.kullaniciAdi}\n*Tutar:* ${formatCurrency(requestDetails.tutar)}\n\nBu işlem onaylanırsa, banka limitleri dolacaktır.`;
    bot.sendMessage(siteConfig.groupId, message, { parse_mode: 'Markdown' });
};

const listenForCommands = () => {
    if (!bot) return;
    bot.onText(/\/rapor/, async (msg) => {
        const db = getDb();
        const sites = await db.all('SELECT siteAdi FROM sites');
        const keyboard = sites.map(site => ([{ text: site.siteAdi, callback_data: `report_${site.siteAdi.trim()}` }]));
        keyboard.push([{ text: 'Tümü', callback_data: 'report_all' }]);
        bot.sendMessage(msg.chat.id, "Hangi site için rapor istersiniz?", { reply_markup: { inline_keyboard: keyboard } });
    });
    bot.onText(/\/kasa/, async (msg) => {
        const allTimeStats = await calculateStats();
        const pastStats = await calculateStats({ dateFilter: 'before_today' });
        const message = `💰 *Genel Kasa Durumu* 💰\n\n*Toplam Onaylı Yatırım:* ${formatCurrency(allTimeStats.totalInvestment)}\n*Toplam Onaylı Çekim:* ${formatCurrency(allTimeStats.totalWithdrawal)}\n*Dünden Devreden Kar:* ${formatCurrency(pastStats.totalCommission)}`;
        bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
    });
    bot.onText(/\/komisyon/, async (msg) => {
        const todayStats = await calculateStats({ dateFilter: 'today' });
        const pastStats = await calculateStats({ dateFilter: 'before_today' });
        const message = `📈 *Komisyon Raporu* 📈\n\n*Bugünkü Komisyon Karı:* ${formatCurrency(todayStats.totalCommission)}\n*Dünden Devreden Kar:* ${formatCurrency(pastStats.totalCommission)}`;
        bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
    });
};

const listenForCallbacks = () => {
  if (!bot) return;
  bot.on('callback_query', async (callbackQuery) => {
    const msg = callbackQuery.message;
    const data = callbackQuery.data;
    const [action, ...params] = data.split('_');
    
    if (action === 'report') {
        const siteName = params.join('_');
        const todayStats = await calculateStats({ siteName, dateFilter: 'today' });
        const yesterdayStats = await calculateStats({ dateFilter: 'before_today' });
        const siteTitle = siteName === 'all' ? 'Tüm Siteler' : siteName;
        const message = `📊 *Günlük Rapor: ${siteTitle}* 📊\n\n*Bugünkü Onaylı Yatırım:* ${formatCurrency(todayStats.totalInvestment)}\n*Bugünkü Onaylı Çekim:* ${formatCurrency(todayStats.totalWithdrawal)}\n*Bugünkü Komisyon Karı:* ${formatCurrency(todayStats.totalCommission)}\n*Dünden Devreden Kar:* ${formatCurrency(yesterdayStats.totalCommission)}`;
        bot.editMessageText(message, { chat_id: msg.chat.id, message_id: msg.message_id, parse_mode: 'Markdown' });
        return;
    }

    if (action === 'update' && params[0] === 'bank') {
        const bankId = params[1];
        conversationState[msg.chat.id] = { step: 'ask_name', bankId: bankId };
        bot.sendMessage(msg.chat.id, `🏦 Banka güncelleme işlemi başlatıldı.\n\nLütfen yeni hesap sahibinin adını ve soyadını yazın:`);
        bot.answerCallbackQuery(callbackQuery.id);
        return;
    }

    if (action === 'approve' || action === 'reject') {
        const type = params[0];
        const requestId = params[1];
        const tableName = type === 'investment' ? 'investment_requests' : 'withdrawal_requests';
        
        try {
            const db = getDb();
            const requestDetails = await db.get(`SELECT * FROM ${tableName} WHERE id = ?`, requestId);
            if (!requestDetails) return;
            const newStatus = action === 'approve' ? 'Onaylandı' : 'Reddedildi';
            const operator = callbackQuery.from.username || callbackQuery.from.first_name;
            await db.run(`UPDATE ${tableName} SET durum = ?, operator = ? WHERE id = ?`, newStatus, operator, requestId);
            if (action === 'approve') {
                const transactionType = type === 'investment' ? 'deposit' : 'withdrawal';
                callbackService.sendBalanceUpdate({ siteName: requestDetails.site, requestDetails, type: transactionType });
                if (type === 'investment') {
                    await checkBankLimitsAndLock(requestDetails);
                }
            }
            if (ioInstance) {
                ioInstance.emit('request_status_updated', { type, requestId, newStatus, operator });
            }
            const updatedMessage = `${msg.text}\n\n*İşlem Yapan:* ${callbackQuery.from.first_name}\n*Durum:* *${newStatus}*`;
            bot.editMessageText(updatedMessage, { chat_id: msg.chat.id, message_id: msg.message_id, parse_mode: 'Markdown', reply_markup: { inline_keyboard: [] } });
            bot.answerCallbackQuery(callbackQuery.id, { text: `Talep ${newStatus}!` });
        } catch (error) {
            console.error("Telegram callback işlenirken hata:", error);
        }
    }
  });
};

const listenForMessages = () => {
    if (!bot) return;
    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        const state = conversationState[chatId];
        if (!state || msg.text.startsWith('/')) return;

        const db = getDb();
        if (state.step === 'ask_name') {
            const newName = msg.text;
            conversationState[chatId].newName = newName;
            conversationState[chatId].step = 'ask_iban';
            bot.sendMessage(chatId, `✅ Hesap sahibi "${newName}" olarak ayarlandı.\n\nŞimdi lütfen yeni IBAN numarasını girin (örn: TR11...):`);
        } else if (state.step === 'ask_iban') {
            const newIban = msg.text.toUpperCase().replace(/\s/g, '');
            const { bankId, newName } = state;
            try {
                await db.run('UPDATE investment_banks SET hesapSahibi = ?, iban = ? WHERE id = ?', newName, newIban, bankId);
                bot.sendMessage(chatId, `✅ Harika! Banka bilgileri başarıyla güncellendi.\n\n*Yeni Hesap Sahibi:* ${newName}\n*Yeni IBAN:* ${newIban}`, { parse_mode: 'Markdown' });
                lockedBanksInstance.delete(bankId);
                ioInstance.emit('bank_status_updated', { bankId: bankId, isLocked: false });
            } catch (error) {
                bot.sendMessage(chatId, '❌ Güncelleme sırasında bir veritabanı hatası oluştu.');
            } finally {
                delete conversationState[chatId];
            }
        }
    });
};

const registerCommands = () => {
    if (!bot) return;
    bot.setMyCommands([
        { command: 'rapor', description: 'Günlük site raporu alın' },
        { command: 'kasa', description: 'Genel kasa durumunu gösterir' },
        { command: 'komisyon', description: 'Günlük ve geçmiş komisyon karını gösterir' },
    ]);
};

const init = async (io, lockedBanks) => {
  ioInstance = io;
  lockedBanksInstance = lockedBanks;
  try {
    const db = getDb();
    const sites = await db.all('SELECT * FROM sites');
    sites.forEach(site => {
      if (site.siteAdi && site.telegramBotToken && site.telegramGrupId) {
        siteConfigs[site.siteAdi.trim()] = { token: site.telegramBotToken, groupId: site.telegramGrupId };
      }
    });
    const firstSiteWithBot = Object.values(siteConfigs)[0];
    if (firstSiteWithBot && firstSiteWithBot.token) {
      bot = new TelegramBot(firstSiteWithBot.token, { polling: true });
      console.log('✅ Telegram botu başarıyla başlatıldı!');
      listenForCallbacks();
      listenForCommands();
      listenForMessages();
      registerCommands();
    } else {
      console.log('⚠️ Veritabanında token bilgisi olan site bulunamadı.');
    }
  } catch (error) {
    console.error('❌ Telegram servisi başlatılırken hata:', error.message);
  }
};

module.exports = {
  init,
  sendRequestNotification,
  sendLimitFullNotification,
  sendProactiveLimitWarning
};
