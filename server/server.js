const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const path = require('path');
const { initializeDatabase } = require('./database');
const authRoutes = require('./routes/authRoutes');
const bankRoutes = require('./routes/bankRoutes');
const requestRoutes = require('./routes/requestRoutes');
const userRoutes = require('./routes/userRoutes');
const siteRoutes = require('./routes/siteRoutes');
const reportRoutes = require('./routes/reportRoutes');
const publicApiRoutes = require('./routes/publicApiRoutes');
const testRoutes = require('./routes/testRoutes');
const gatewayApiRoutes = require('./routes/gatewayApiRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const systemRoutes = require('./routes/systemRoutes');
const accountRoutes = require('./routes/accountRoutes');
const logRoutes = require('./routes/logRoutes');
const backupRoutes = require('./routes/backupRoutes');
const telegramService = require('./services/telegramService');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST", "PUT"]
  }
});

const PORT = process.env.PORT || 5001;

const lockedBanks = new Set();
const activeAdmins = {};
const activeCustomers = new Set();

app.set('socketio', io);
app.set('lockedBanks', lockedBanks);

io.on('connection', (socket) => {
  console.log('🔌 Yeni bir kullanıcı bağlandı:', socket.id);

  const broadcastActiveAdmins = () => {
    const uniqueAdminsMap = new Map();
    Object.values(activeAdmins).forEach(admin => {
        uniqueAdminsMap.set(admin.userId, admin);
    });
    io.emit('update_active_admins', Array.from(uniqueAdminsMap.values()));
  };

  socket.on('admin_online', ({ userId, username }) => {
    socket.join('admins');
    activeAdmins[socket.id] = { userId, username };
    console.log(`✅ ${username} online oldu ve 'admins' odasına katıldı.`);
    broadcastActiveAdmins();
  });

  socket.on('customer_active', () => {
    activeCustomers.add(socket.id);
    io.to('admins').emit('update_active_customers', activeCustomers.size);
  });

  socket.on('disconnect', () => {
    console.log('🔌 Kullanıcı ayrıldı:', socket.id);
    if (activeAdmins[socket.id]) {
      const disconnectedAdmin = activeAdmins[socket.id].username;
      delete activeAdmins[socket.id];
      console.log(`❌ ${disconnectedAdmin} offline oldu.`);
      broadcastActiveAdmins();
    }
    if (activeCustomers.has(socket.id)) {
        activeCustomers.delete(socket.id);
        io.to('admins').emit('update_active_customers', activeCustomers.size);
    }
  });
});

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/sounds', express.static(path.join(__dirname, 'uploads', 'sounds')));
app.use('/pictures', express.static(path.join(__dirname, 'uploads', 'pictures')));
app.use('/site-logos', express.static(path.join(__dirname, 'uploads', 'site-logos')));

app.use((req, res, next) => {
    req.io = app.get('socketio');
    req.lockedBanks = app.get('lockedBanks');
    next();
});

app.use('/api/auth', authRoutes);
app.use('/api/banks', bankRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/users', userRoutes);
app.use('/api/sites', siteRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/public', publicApiRoutes);
app.use('/api/test', testRoutes);
app.use('/api/gateway', gatewayApiRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/backup', backupRoutes);

const startServer = async () => {
    try {
        await initializeDatabase();
        server.listen(PORT, () => {
            console.log(`🚀 Sunucu http://localhost:${PORT} adresinde çalışıyor.`);
            telegramService.init(io, lockedBanks);
        });
    } catch (error) {
        console.error("Sunucu başlatılamadı:", error);
        process.exit(1);
    }
};

startServer();
