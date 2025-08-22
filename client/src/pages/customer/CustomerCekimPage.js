import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useSocket } from '../../contexts/SocketContext';
import './CustomerCekimPage.css';

const useQuery = () => {
    const { search } = useLocation();
    return useMemo(() => new URLSearchParams(search), [search]);
};

const CustomerCekimPage = () => {
    const { siteId } = useParams();
    const query = useQuery();
    
    const [userInfo, setUserInfo] = useState({
        username: query.get('username') || 'Bilinmiyor',
        fullName: query.get('fullName') || 'Bilinmiyor'
    });

    const [siteInfo, setSiteInfo] = useState({ siteAdi: '', siteLogo: null });
    const [methods, setMethods] = useState([]);
    const [selectedMethod, setSelectedMethod] = useState(null);
    const [formData, setFormData] = useState({});
    const [amount, setAmount] = useState('');
    const [status, setStatus] = useState({ loading: true, error: null, message: '' });
    const [isRequestPending, setIsRequestPending] = useState(false);
    const [lockedBanks, setLockedBanks] = useState([]);
    const socket = useSocket();

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

                if (pendingStatusRes.data.hasPendingWithdrawal) {
                    setIsRequestPending(true);
                    setStatus({ loading: false, error: null, message: '' });
                } else {
                    const methodsRes = await axios.get(`http://localhost:5001/api/gateway/withdrawal-methods/${siteId}`);
                    setMethods(methodsRes.data);
                    const initiallyLocked = methodsRes.data.filter(method => method.isLocked).map(method => method.id);
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

    const handleFormChange = (label, value) => {
        setFormData(prev => ({ ...prev, [label]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const cekimBilgileri = Object.entries(formData).map(([label, value]) => ({ label, value }));

        if (selectedMethod.requiredFields.length > 0 && cekimBilgileri.length !== selectedMethod.requiredFields.length) {
            alert("Lütfen tüm gerekli alanları doldurun.");
            return;
        }

        const talepData = {
            kullaniciAdi: userInfo.username,
            kullaniciIsimSoyisim: userInfo.fullName,
            yontemAdi: selectedMethod.bankaAdi,
            tutar: amount,
            cekimBilgileri,
        };

        try {
            await axios.post(`http://localhost:5001/api/gateway/withdrawal-requests/${siteId}`, talepData);
            setIsRequestPending(true);
        } catch (err) {
            const errorMessage = err.response?.data?.message || 'Talebiniz gönderilirken bir hata oluştu.';
            setStatus({ loading: false, error: errorMessage, message: '' });
        }
    };
    
    const handleImageError = (e) => {
        e.target.onerror = null;
        e.target.src = "https://placehold.co/120x60/f0f0f0/777?text=Logo+Yok";
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
                    <p>Mevcut çekim talebiniz sonuçlandığında bu sayfa otomatik olarak güncellenecektir.</p>
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

            {!selectedMethod ? (
                <div className="content-wrapper">
                    <h2>Çekim Yöntemini Seçin</h2>
                    <div className="bank-grid">
                        {methods.map((method) => {
                            const isLocked = lockedBanks.includes(method.id);
                            return (
                                <div 
                                    key={method.id} 
                                    className={`bank-card-customer ${isLocked ? 'locked' : ''}`} 
                                    onClick={() => !isLocked && setSelectedMethod(method)}
                                >
                                    {isLocked && <div className="locked-overlay">Güncelleniyor</div>}
                                    <div className="logo-wrapper">
                                        {method.logo ? (
                                            <img 
                                                src={`http://localhost:5001${method.logo}`} 
                                                alt={method.bankaAdi} 
                                                onError={handleImageError}
                                            />
                                        ) : null}
                                    </div>
                                    <span className="bank-name">{method.bankaAdi}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <div className="content-wrapper">
                    <div className="deposit-form">
                        <button onClick={() => setSelectedMethod(null)} className="back-button">← Geri</button>
                        {selectedMethod.logo && (
                            <img 
                                src={`http://localhost:5001${selectedMethod.logo}`} 
                                alt={selectedMethod.bankaAdi} 
                                className="selected-bank-logo"
                                onError={handleImageError}
                            />
                        )}
                        <h2>{selectedMethod.bankaAdi} - Çekim Bilgileri</h2>
                        <form onSubmit={handleSubmit}>
                            {selectedMethod.requiredFields.map((field, index) => (
                                <div className="form-group" key={index}>
                                    <label htmlFor={field.label}>{field.label}</label>
                                    <input
                                        id={field.label}
                                        type={field.type || 'text'}
                                        placeholder={field.placeholder}
                                        onChange={(e) => handleFormChange(field.label, e.target.value)}
                                        required
                                    />
                                </div>
                            ))}
                            <div className="form-group">
                                <label htmlFor="amount">Çekim Tutarı</label>
                                <input
                                    id="amount"
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder="Çekim Tutarını Girin"
                                    required
                                />
                            </div>
                            <button type="submit" className="submit-button">Çekim Talebi Gönder</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomerCekimPage;
