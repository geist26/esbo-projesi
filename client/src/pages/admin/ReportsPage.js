import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import './ReportsPage.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const ReportsPage = () => {
  const [reportData, setReportData] = useState(null);
  const [sites, setSites] = useState([]);
  const [filters, setFilters] = useState({ site: '', dateRange: 'monthly' });
  
  // Resetleme modalı için state'ler
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetOptions, setResetOptions] = useState({
    site: 'all',
    deleteApproved: false,
    deleteRejected: false,
  });
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const fetchSites = async () => {
    try {
        const response = await axios.get('http://localhost:5001/api/sites');
        setSites(response.data);
    } catch (error) {
        console.error("Siteler çekilirken hata oluştu:", error);
    }
  };

  const fetchReport = useCallback(async () => {
    try {
      const response = await axios.get('http://localhost:5001/api/reports/summary', { params: filters });
      setReportData(response.data);
    } catch (error) {
      console.error("Rapor verisi çekilirken hata:", error);
    }
  }, [filters]);

  useEffect(() => {
    fetchSites();
    fetchReport();
  }, [fetchReport]);

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };
  
  const handleExport = () => {
      const queryString = new URLSearchParams(filters).toString();
      window.open(`http://localhost:5001/api/reports/export?${queryString}`, '_blank');
  };

  // Resetleme formunu yöneten fonksiyonlar
  const handleResetOptionsChange = (e) => {
    const { name, value, type, checked } = e.target;
    setResetOptions(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleResetTransactions = async () => {
    if (!password) {
        alert("Lütfen admin şifresini girin.");
        return;
    }
    if (window.confirm("Seçili işlemleri silmek istediğinizden emin misiniz? Bu işlem geri alınamaz!")) {
        setIsLoading(true);
        try {
            const token = localStorage.getItem('authToken');
            await axios.post('http://localhost:5001/api/system/reset-transactions', 
                { ...resetOptions, password },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            alert("İşlemler başarıyla sıfırlandı.");
            setShowResetModal(false);
            setPassword('');
            fetchReport(); // Raporu yenile
        } catch (error) {
            alert(error.response?.data?.message || "Bir hata oluştu.");
        } finally {
            setIsLoading(false);
        }
    }
  };

  const handleHardReset = async () => {
    if (!password) {
        alert("Lütfen admin şifresini girin.");
        return;
    }
    if (window.confirm("TÜM SİSTEMİ SIFIRLAMAK istediğinizden emin misiniz? Bu işlem 'admin' kullanıcısı hariç her şeyi siler ve geri alınamaz!")) {
        setIsLoading(true);
        try {
            const token = localStorage.getItem('authToken');
            await axios.post('http://localhost:5001/api/system/hard-reset', 
                { password },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            alert("Sistem başarıyla sıfırlandı.");
            // Sayfayı yenileyerek temizlenmiş durumu göster
            window.location.reload();
        } catch (error) {
            alert(error.response?.data?.message || "Bir hata oluştu.");
        } finally {
            setIsLoading(false);
        }
    }
  };

  const formatCurrency = (amount) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(amount || 0);

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: 'Yatırım ve Çekim Hacmi' },
    },
  };
  
  const chartData = {
    labels: ['Genel'],
    datasets: [
      {
        label: 'Toplam Yatırım',
        data: [reportData?.toplamYatirim || 0],
        backgroundColor: 'rgba(46, 164, 79, 0.7)',
      },
      {
        label: 'Toplam Çekim',
        data: [reportData?.toplamCekim || 0],
        backgroundColor: 'rgba(215, 58, 73, 0.7)',
      },
    ],
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Raporlar</h1>
        <div>
            <button onClick={() => setShowResetModal(true)} className="reset-btn">Reset</button>
            <button onClick={handleExport} className="export-btn">Excel'e Aktar</button>
        </div>
      </div>

      {/* Rapor kartları ve grafik */}
      {reportData && (
        <>
          <div className="stats-container">
            <div className="stat-card"><h4>Toplam Yatırım</h4><p className="yatirim">{formatCurrency(reportData.toplamYatirim)}</p></div>
            <div className="stat-card"><h4>Toplam Çekim</h4><p className="cekim">{formatCurrency(reportData.toplamCekim)}</p></div>
            <div className="stat-card"><h4>Net Fark</h4><p className={reportData.netFark >= 0 ? 'yatirim' : 'cekim'}>{formatCurrency(reportData.netFark)}</p></div>
            <div className="stat-card"><h4>Toplam Komisyon Kârı</h4><p>{formatCurrency(reportData.toplamKomisyonKari)}</p></div>
          </div>
          <div className="chart-container">
            <Bar options={chartOptions} data={chartData} />
          </div>
        </>
      )}

      {/* Resetleme Modal Penceresi */}
      {showResetModal && (
        <div className="modal-overlay">
            <div className="modal-content reset-modal">
                <h3>Sistem Sıfırlama</h3>
                
                <div className="reset-section">
                    <h4>İşlemleri Sıfırla</h4>
                    <select name="site" value={resetOptions.site} onChange={handleResetOptionsChange}>
                        <option value="all">Tüm Siteler</option>
                        {sites.map(site => <option key={site.id} value={site.siteAdi}>{site.siteAdi}</option>)}
                    </select>
                    <div className="checkbox-group">
                        <label><input type="checkbox" name="deleteApproved" checked={resetOptions.deleteApproved} onChange={handleResetOptionsChange} /> Onaylananları Sil</label>
                        <label><input type="checkbox" name="deleteRejected" checked={resetOptions.deleteRejected} onChange={handleResetOptionsChange} /> Reddedilenleri Sil</label>
                    </div>
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Onay için Admin Şifresi" />
                    <button onClick={handleResetTransactions} className="reset-action-btn" disabled={isLoading}>
                        {isLoading ? 'Sıfırlanıyor...' : 'Seçili İşlemleri Sıfırla'}
                    </button>
                </div>

                <div className="reset-section hard-reset">
                    <h4>Tüm Sistemi Sıfırla (Hard Reset)</h4>
                    <p>Bu işlem 'admin' kullanıcısı hariç tüm siteleri, bankaları, talepleri ve kullanıcıları kalıcı olarak siler.</p>
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Onay için Admin Şifresi" />
                    <button onClick={handleHardReset} className="hard-reset-btn" disabled={isLoading}>
                        {isLoading ? 'Sıfırlanıyor...' : 'Tüm Sistemi Sıfırla'}
                    </button>
                </div>

                <div className="form-actions">
                    <button onClick={() => setShowResetModal(false)} className="cancel-btn" disabled={isLoading}>Kapat</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default ReportsPage;
