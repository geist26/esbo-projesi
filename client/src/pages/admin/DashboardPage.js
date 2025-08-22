import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSocket } from '../../contexts/SocketContext';
import './DashboardPage.css'; // Yeni stil dosyasını ekleyeceğiz

// Para birimini formatlamak için yardımcı fonksiyon
const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return '0,00 TL';
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(amount);
};

const DashboardPage = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeCustomers, setActiveCustomers] = useState(0);
    const socket = useSocket();

    useEffect(() => {
        const fetchStats = async () => {
            try {
                setLoading(true);
                const response = await axios.get('http://localhost:5001/api/dashboard/stats');
                setStats(response.data);
            } catch (error) {
                console.error("Dashboard istatistikleri çekilirken hata oluştu:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    // Anlık aktif müşteri sayısını dinle
    useEffect(() => {
        if (socket == null) return;

        socket.on('update_active_customers', (count) => {
            setActiveCustomers(count);
        });

        // Sayfa yüklendiğinde de ilk sayıyı almak için bir sinyal gönderilebilir (opsiyonel)
        // socket.emit('get_initial_customer_count');

        return () => {
            socket.off('update_active_customers');
        };
    }, [socket]);

    if (loading) {
        return <div className="dashboard-container"><p>Yükleniyor...</p></div>;
    }

    if (!stats) {
        return <div className="dashboard-container"><p>Veriler yüklenemedi.</p></div>;
    }

    return (
        <div className="dashboard-container">
            <div className="stats-grid">
                {/* Ana İstatistik Kartları */}
                <div className="stat-card">
                    <h4>Aktif Müşteri (Anlık)</h4>
                    <p className="value-large">{activeCustomers}</p>
                </div>
                <div className="stat-card">
                    <h4>Bugün Gelen Yatırım</h4>
                    <p className="value-positive">{formatCurrency(stats.todayTotalInvestment)}</p>
                </div>
                <div className="stat-card">
                    <h4>Bugün Gelen Çekim</h4>
                    <p className="value-negative">{formatCurrency(stats.todayTotalWithdrawal)}</p>
                </div>
                 <div className="stat-card">
                    <h4>Bugün Onaylanan Yatırım</h4>
                    <p className="value-positive">{formatCurrency(stats.todayApprovedInvestment)}</p>
                </div>
                <div className="stat-card">
                    <h4>Bugün Onaylanan Çekim</h4>
                    <p className="value-negative">{formatCurrency(stats.todayApprovedWithdrawal)}</p>
                </div>
                <div className="stat-card">
                    <h4>En Yüksek Yatırım</h4>
                    <p>{formatCurrency(stats.highestInvestment)}</p>
                </div>
                <div className="stat-card">
                    <h4>En Karlı Site</h4>
                    <p>{stats.topCommissionSite.name}</p>
                </div>
                <div className="stat-card">
                    <h4>Dünden Devreden Kar</h4>
                    <p>{formatCurrency(stats.yesterdayCommission)}</p>
                </div>
                <div className="stat-card">
                    <h4>Toplam Banka Limiti</h4>
                    <p>{formatCurrency(stats.totalBankLimit)}</p>
                </div>
                <div className="stat-card">
                    <h4>Kalan Banka Limiti</h4>
                    <p className="value-info">{formatCurrency(stats.remainingBankLimit)}</p>
                </div>

                {/* Liste Kartları */}
                <div className="stat-card list-card">
                    <h4>En Çok Yatırım Alan Bankalar</h4>
                    <ul>
                        {stats.topInvestmentBanks.map((item, index) => (
                            <li key={index}><span>{item.name}</span> <span>{formatCurrency(item.total)}</span></li>
                        ))}
                    </ul>
                </div>
                 <div className="stat-card list-card">
                    <h4>En Çok Çekim Yapılan Yöntemler</h4>
                    <ul>
                        {stats.topWithdrawalBanks.map((item, index) => (
                            <li key={index}><span>{item.name}</span> <span>{formatCurrency(item.total)}</span></li>
                        ))}
                    </ul>
                </div>
                <div className="stat-card list-card">
                    <h4>En Çok Yatırım Alan Siteler</h4>
                    <ul>
                        {stats.topInvestmentSites.map((item, index) => (
                            <li key={index}><span>{item.name}</span> <span>{formatCurrency(item.total)}</span></li>
                        ))}
                    </ul>
                </div>
                 <div className="stat-card list-card">
                    <h4>En Çok Çekim Yapılan Siteler</h4>
                    <ul>
                        {stats.topWithdrawalSites.map((item, index) => (
                            <li key={index}><span>{item.name}</span> <span>{formatCurrency(item.total)}</span></li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default DashboardPage;
