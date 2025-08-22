import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './AccountPage.css';

const AccountPage = () => {
    const [sites, setSites] = useState([]);
    const [ledger, setLedger] = useState([]);
    const [summary, setSummary] = useState(null);
    const [options, setOptions] = useState({
        siteName: 'all',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
    });
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const token = localStorage.getItem('authToken');
                const headers = { Authorization: `Bearer ${token}` };
                const sitesRes = await axios.get('http://localhost:5001/api/sites');
                const ledgerRes = await axios.get('http://localhost:5001/api/account/ledger', { headers });
                setSites(sitesRes.data);
                setLedger(ledgerRes.data);
            } catch (error) {
                console.error("Veriler çekilirken hata oluştu:", error);
            }
        };
        fetchData();
    }, []);

    const handleOptionsChange = (e) => {
        setOptions(prev => ({ ...prev, [e.target.name]: e.target.value }));
        setSummary(null);
    };

    const handleCalculate = async () => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem('authToken');
            const response = await axios.post('http://localhost:5001/api/account/calculate', options, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSummary(response.data);
        } catch (error) {
            alert(error.response?.data?.message || "Hesaplama sırasında bir hata oluştu.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleCloseAccount = async () => {
        if (!summary) {
            alert("Lütfen önce 'Hesapla' butonuna basarak bir özet oluşturun.");
            return;
        }
        if (!password) {
            alert("Lütfen admin şifresini girin.");
            return;
        }
        if (window.confirm("Hesabı kapatmak istediğinizden emin misiniz? Seçili tarih aralığındaki onaylı ve reddedilmiş tüm işlemler silinecektir! Bu işlem geri alınamaz!")) {
            setIsLoading(true);
            try {
                const token = localStorage.getItem('authToken');
                await axios.post('http://localhost:5001/api/account/close', 
                    { ...options, password },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                alert("Hesap başarıyla kapatıldı ve deftere işlendi.");
                window.location.reload();
            } catch (error) {
                alert(error.response?.data?.message || "Hesap kapatılırken bir hata oluştu.");
            } finally {
                setIsLoading(false);
            }
        }
    };
    
    const handleDeleteLedgerEntry = async (id) => {
        if (window.confirm("Bu defter kaydını silmek istediğinizden emin misiniz?")) {
            try {
                const token = localStorage.getItem('authToken');
                await axios.delete(`http://localhost:5001/api/account/ledger/${id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setLedger(prev => prev.filter(entry => entry.id !== id));
            } catch (error) {
                alert(error.response?.data?.message || "Kayıt silinirken bir hata oluştu.");
            }
        }
    };

    const formatCurrency = (amount) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(amount || 0);

    return (
        <div className="page-container">
            <h1>Hesap Yönetimi</h1>
            <div className="account-grid">
                {/* Hesap Kapatma Kartı */}
                <div className="form-card account-card">
                    <h3>Hesap Kapat</h3>
                    <div className="form-row">
                        <select name="siteName" value={options.siteName} onChange={handleOptionsChange}>
                            <option value="all">Tüm Siteler</option>
                            {sites.map(site => <option key={site.id} value={site.siteAdi}>{site.siteAdi}</option>)}
                        </select>
                    </div>
                    <div className="form-row">
                        <input type="date" name="startDate" value={options.startDate} onChange={handleOptionsChange} />
                        <input type="date" name="endDate" value={options.endDate} onChange={handleOptionsChange} />
                    </div>
                    <button onClick={handleCalculate} className="calculate-btn" disabled={isLoading}>
                        {isLoading ? 'Hesaplanıyor...' : 'Hesapla'}
                    </button>

                    {summary && (
                        <div className="summary-section">
                            <h4>Hesap Özeti</h4>
                            <p><strong>Toplam Yatırım:</strong> {formatCurrency(summary.totalInvestment)}</p>
                            <p><strong>Toplam Çekim:</strong> {formatCurrency(summary.totalWithdrawal)}</p>
                            <p><strong>Komisyon Karı:</strong> {formatCurrency(summary.commissionProfit)}</p>
                            {/* YENİ: Siteye ödenecek tutar gösteriliyor */}
                            <p className="amount-to-pay"><strong>Siteye Ödenecek:</strong> {formatCurrency(summary.amountToPay)}</p>
                            <hr />
                            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Onay için Admin Şifresi" />
                            <button onClick={handleCloseAccount} className="close-account-btn" disabled={isLoading}>
                                {isLoading ? 'Kapatılıyor...' : 'Hesabı Kapat ve Deftere İşle'}
                            </button>
                        </div>
                    )}
                </div>

                {/* Hesap Defteri Kartı */}
                <div className="form-card ledger-card">
                    <h3>Hesap Defteri</h3>
                    <div className="ledger-list">
                        {ledger.length > 0 ? ledger.map(entry => (
                            <div key={entry.id} className="ledger-entry">
                                <div className="ledger-info">
                                    <strong>{entry.siteName === 'all' ? 'Tüm Siteler' : entry.siteName}</strong>
                                    <span>{entry.period}</span>
                                    <small>Kapatan: {entry.closedBy}</small>
                                </div>
                                <div className="ledger-summary">
                                    <p><strong>Yatırım:</strong> {formatCurrency(entry.totalInvestment)}</p>
                                    <p><strong>Çekim:</strong> {formatCurrency(entry.totalWithdrawal)}</p>
                                    <p><strong>Kar:</strong> {formatCurrency(entry.commissionProfit)}</p>
                                    {/* YENİ: Siteye ödenecek tutar gösteriliyor */}
                                    <p className="amount-to-pay"><strong>Ödenecek:</strong> {formatCurrency(entry.amountToPay)}</p>
                                </div>
                                <button onClick={() => handleDeleteLedgerEntry(entry.id)} className="delete-ledger-btn">Sil</button>
                            </div>
                        )) : <p>Hesap defterinde kayıt bulunmuyor.</p>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AccountPage;
