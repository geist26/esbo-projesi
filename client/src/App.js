import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SocketProvider, useSocket } from './contexts/SocketContext';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Layouts ve Sayfalar
import AdminLayout from './components/layout/AdminLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/admin/DashboardPage';
import InvestmentBanksPage from './pages/admin/InvestmentBanksPage';
import WithdrawalBanksPage from './pages/admin/WithdrawalBanksPage';
import InvestmentRequestsPage from './pages/admin/InvestmentRequestsPage';
import WithdrawalRequestsPage from './pages/admin/WithdrawalRequestsPage';
import UsersPage from './pages/admin/UsersPage';
import SitesPage from './pages/admin/SitesPage';
import ReportsPage from './pages/admin/ReportsPage';
import AccountPage from './pages/admin/AccountPage';
import ActionLogsPage from './pages/admin/ActionLogsPage'; // YENİ: İşlem logları sayfasını import et
import CustomerYatirimPage from './pages/customer/CustomerYatirimPage';
import CustomerCekimPage from './pages/customer/CustomerCekimPage';

// Bildirimleri ve Rotaları yöneten ana içerik bileşeni
const AppContent = () => {
  const socket = useSocket();
  const token = localStorage.getItem('authToken');
  const isAuthenticated = !!token;

  useEffect(() => {
    if (socket == null) return;

    const handleLimitNotification = ({ bankName }) => {
      if (isAuthenticated) {
        toast.info(`🔔 ${bankName} bankasının limiti doldu. Lütfen güncelleyin!`, {
          position: "top-right",
          autoClose: 10000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "colored"
        });
      }
    };

    socket.on('bank_limit_full_notification', handleLimitNotification);

    return () => {
      socket.off('bank_limit_full_notification', handleLimitNotification);
    };
  }, [socket, isAuthenticated]);

  return (
    <BrowserRouter>
      <ToastContainer />
      <Routes>
        {/* MÜŞTERİ ROTALARI */}
        <Route path="/musteri/yatirim/:siteId" element={<CustomerYatirimPage />} />
        <Route path="/musteri/cekim/:siteId" element={<CustomerCekimPage />} />

        {/* ADMİN ROTALARI */}
        <Route 
          path="/login" 
          element={!isAuthenticated ? <LoginPage /> : <Navigate to="/dashboard" />} 
        />
        <Route 
          path="/" 
          element={isAuthenticated ? <AdminLayout /> : <Navigate to="/login" />}
        >
          <Route index element={<Navigate to="/dashboard" />} /> 
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="investment-banks" element={<InvestmentBanksPage />} />
          <Route path="withdrawal-banks" element={<WithdrawalBanksPage />} />
          <Route path="investment-requests" element={<InvestmentRequestsPage />} />
          <Route path="withdrawal-requests" element={<WithdrawalRequestsPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="sites" element={<SitesPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="account" element={<AccountPage />} />
          <Route path="action-logs" element={<ActionLogsPage />} /> {/* YENİ: İşlem logları rotası eklendi */}
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

// Ana App bileşeni artık sadece Provider'ları ve ana içeriği içeriyor
function App() {
  return (
    <SocketProvider>
      <AppContent />
    </SocketProvider>
  );
}

export default App;
