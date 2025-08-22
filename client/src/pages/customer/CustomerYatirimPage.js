import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';
import { useSocket } from '../../contexts/SocketContext';
import './CustomerYatirimPage.css';

const useQuery = () => {
    const { search } = useLocation();
    return useMemo(() => new URLSearchParams(search), [search]);
};

const CustomerYatirimPage = () => {
    const { siteId } = useParams();
    const query = useQuery();
    
    const [userInfo, setUserInfo] = useState({
        username: query.get('username') || 'Bilinmiyor',
        fullName: query.get('fullName') || 'Bilinmiyor'
    });

    const [siteInfo, setSiteInfo] = useState({ siteAdi: '', siteLogo: null });
    const [banks, setBanks] = useState([]);
    const [selectedBank, setSelectedBank] = useState(null);
    const [amount, setAmount] = useState('');
    const [status, setStatus] = useState({ loading: true, error: null, message: '' });
    const [copiedText, copy] = useCopyToClipboard();
    const [lockedBanks, setLockedBanks] = useState([]);
    const [isRequestPending, setIsRequestPending] = useState(false);
    const socket = useSocket();
    const [showQrModal, setShowQrModal] = useState(false);
    const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            if (!siteId) {
                setStatus({ loading: false, error: 'Site kimliği bulunamadı.', message: '' });
                return;
            }
            setStatus({ loading: true, error: null, message: '' });
            try {
                const siteInfoPromise = axios.get(`http://localhost:5001/api/gateway/site-info/${siteId}`);
                const pendingStatusPromise = axios.get(`http://localhost:5001/api/gateway/request-status/${userInfo.username}/${siteId}`);
                
                const [siteInfoRes, pendingStatusRes] = await Promise.all([siteInfoPromise, pendingStatusPromise]);
                
                setSiteInfo(siteInfoRes.data);

                if (pendingStatusRes.data.hasPendingInvestment) {
                    setIsRequestPending(true);
                    setStatus({ loading: false, error: null, message: '' });
                } else {
                    const banksRes = await axios.get(`http://localhost:5001/api/gateway/investment-banks/${siteId}`);
                    setBanks(banksRes.data);
                    const initiallyLocked = banksRes.data.filter(bank => bank.isLocked).map(bank => bank.id);
                    setLockedBanks(initiallyLocked);
                    setStatus({ loading: false, error: null, message: '' });
                }
            } catch (err) {
                console.error("!!! VERİ YÜKLENİRKEN HATA:", err.response ? err.response.data : err.message);
                setStatus({ loading: false, error: 'Veriler yüklenemedi. Lütfen site yöneticinizle iletişime geçin.', message: '' });
            }
        };
        
        fetchData();
    }, [siteId, userInfo.username]);

    useEffect(() => {
        if (socket == null) return;
        socket.emit('customer_active');
        const handleBankStatusUpdate = ({ bankId, isLocked }) => {
            setLockedBanks(prev => isLocked ? [...new Set([...prev, bankId])] : prev.filter(id => id !== bankId));
        };
        socket.on('bank_status_updated', handleBankStatusUpdate);
        return () => socket.off('bank_status_updated', handleBankStatusUpdate);
    }, [socket]);

    const generateQrCode = (iban) => {
        if (window.qrcode) {
            const qr = window.qrcode(0, 'M');
            qr.addData(iban);
            qr.make();
            setQrCodeDataUrl(qr.createDataURL(6, 10));
            setShowQrModal(true);
        } else {
            alert("QR kod kütüphanesi yüklenemedi.");
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedBank || !selectedBank.minYatirim) return;
        if (Number(amount) < selectedBank.minYatirim) {
            alert(`Minimum yatırım tutarı ${selectedBank.minYatirim} TL olmalıdır.`);
            return;
        }
        
        const talepData = {
            kullaniciAdi: userInfo.username,
            kullaniciIsimSoyisim: userInfo.fullName,
            banka: selectedBank.bankaAdi,
            iban: selectedBank.iban,
            tutar: amount,
            bankaHesapSahibi: selectedBank.hesapSahibi,
        };
        try {
            await axios.post(`http://localhost:5001/api/gateway/investment-requests/${siteId}`, talepData);
            setIsRequestPending(true);
        } catch (err) {
            const errorMessage = err.response?.data?.message || 'Talebiniz gönderilirken bir hata oluştu.';
            setStatus({ loading: false, error: errorMessage, message: '' });
        }
    };
    
    if (status.loading) return <div className="customer-container"><p>Yükleniyor...</p></div>;
    if (status.error) return <div className="customer-container"><p className="error">{status.error}</p></div>;

    if (isRequestPending) {
        return (
            <div className="customer-container" style={siteInfo.siteLogo ? { '--site-logo-url': `url(http://localhost:5001${siteInfo.siteLogo})` } : {}}>
                 <div className="site-header">
                    {siteInfo.siteLogo && <img src={`http://localhost:5001${siteInfo.siteLogo}`} alt={`${siteInfo.siteAdi} Logo`} />}
                    <h1>{siteInfo.siteAdi}</h1>
                </div>
                <div className="success-modal">
                    <h2>Bekleyen Bir Talebiniz Var</h2>
                    <p>Mevcut yatırım talebiniz sonuçlandığında bu sayfa otomatik olarak güncellenecektir.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="customer-container" style={siteInfo.siteLogo ? { '--site-logo-url': `url(http://localhost:5001${siteInfo.siteLogo})` } : {}}>
            <div className="site-header">
                {siteInfo.siteLogo && <img src={`http://localhost:5001${siteInfo.siteLogo}`} alt={`${siteInfo.siteAdi} Logo`} />}
                <h1>{siteInfo.siteAdi}</h1>
            </div>

            {!selectedBank ? (
                <div className="content-wrapper">
                    <h2>Yatırım Yapılacak Bankayı Seçin</h2>
                    <div className="bank-grid">
                        {banks.map((bank) => {
                            const isLocked = lockedBanks.includes(bank.id);
                            return (
                                <div 
                                    key={bank.id} 
                                    className={`bank-card-customer ${isLocked ? 'locked' : ''}`} 
                                    onClick={() => !isLocked && setSelectedBank(bank)}
                                >
                                    {isLocked && <div className="locked-overlay">Güncelleniyor</div>}
                                    <img src={`http://localhost:5001${bank.logo}`} alt={bank.bankaAdi} />
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <div className="content-wrapper">
                    <div className="deposit-form">
                        <button onClick={() => setSelectedBank(null)} className="back-button">← Geri</button>
                        <img src={`http://localhost:5001${selectedBank.logo}`} alt={selectedBank.bankaAdi} className="selected-bank-logo" />
                        <h2>Banka Bilgileri</h2>
                        <div className="info-row" onClick={() => copy(selectedBank.hesapSahibi)}>
                            <span>Hesap Sahibi</span>
                            <strong>{selectedBank.hesapSahibi}</strong>
                            <button>{copiedText === selectedBank.hesapSahibi ? 'Kopyalandı!' : 'Kopyala'}</button>
                        </div>
                        <div className="info-row" onClick={() => copy(selectedBank.iban)}>
                            <span>IBAN</span>
                            <strong>{selectedBank.iban}</strong>
                            <button>{copiedText === selectedBank.iban ? 'Kopyalandı!' : 'Kopyala'}</button>
                        </div>
                        <button className="qr-code-button" onClick={() => generateQrCode(selectedBank.iban)}>
                            QR Oluştur
                        </button>
                        <p className="min-deposit">Minimum Yatırım: <strong>{selectedBank.minYatirim} TL</strong></p>
                        <form onSubmit={handleSubmit}>
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="Yatırım Tutarınızı Girin"
                                required
                            />
                            <button type="submit" className="submit-button">Yatırımı Yaptım, Bildir</button>
                        </form>
                    </div>
                </div>
            )}

            {showQrModal && (
                <div className="modal-overlay" onClick={() => setShowQrModal(false)}>
                    <div className="modal-content qr-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>IBAN QR Kodu</h3>
                        <p>Kameranız ile okutarak IBAN'ı kopyalayabilirsiniz.</p>
                        <img src={qrCodeDataUrl} alt="IBAN QR Kodu" />
                        <button onClick={() => setShowQrModal(false)} className="cancel-btn">Kapat</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomerYatirimPage;
