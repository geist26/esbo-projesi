import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useSocket } from '../../contexts/SocketContext';
import { jwtDecode } from 'jwt-decode';
import './InvestmentRequestsPage.css';

const InvestmentRequestsPage = () => {
  const [requests, setRequests] = useState([]);
  const [filters, setFilters] = useState({
    site: '',
    kullaniciAdi: '',
    banka: '',
    durum: ''
  });
  const [currentAdmin, setCurrentAdmin] = useState('');
  const socket = useSocket();

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token) {
        try {
            const decoded = jwtDecode(token);
            setCurrentAdmin(decoded.username);
        } catch (error) {
            console.error("Token okunamadı:", error);
        }
    }
  }, []);

  const fetchRequests = useCallback(async () => {
    try {
      const response = await axios.get('http://localhost:5001/api/requests/investment', { params: filters });
      setRequests(response.data);
    } catch (error) {
      console.error("Talepler çekilirken hata oluştu:", error);
    }
  }, [filters]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    if (socket == null) return;

    const handleNewRequest = (newRequest) => {
      if (filters.durum === '' || filters.durum === 'Beklemede') {
        setRequests(prevRequests => [newRequest, ...prevRequests]);
      }
    };
    socket.on('new_investment_request', handleNewRequest);

    const handleStatusUpdate = ({ type, requestId, newStatus, operator }) => {
      if (type === 'investment') {
        setRequests(prevRequests => 
          prevRequests.map(req => 
            req.id === requestId ? { ...req, durum: newStatus, operator: operator } : req
          )
        );
      }
    };
    socket.on('request_status_updated', handleStatusUpdate);

    return () => {
      socket.off('new_investment_request', handleNewRequest);
      socket.off('request_status_updated', handleStatusUpdate);
    };
  }, [socket, filters.durum]);

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const handleStatusUpdateFromWeb = async (id, status) => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
          alert('Lütfen tekrar giriş yapın.');
          return;
      }

      await axios.put(`http://localhost:5001/api/requests/investment/${id}/status`, 
        { status },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setRequests(prevRequests => 
        prevRequests.map(req => 
          req.id === id ? { ...req, durum: status, operator: currentAdmin } : req
        )
      );
    } catch (error) {
      console.error("Durum güncellenirken hata:", error.response ? error.response.data : error.message);
      alert("İşlem sırasında bir hata oluştu.");
    }
  };

  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString('tr-TR', options);
  };

  const getStatusClass = (status) => {
    if (status === 'Onaylandı') return 'status-approved';
    if (status === 'Reddedildi') return 'status-rejected';
    return 'status-pending';
  };

  return (
    <div className="page-container">
      <h1>Yatırım Talepleri</h1>
      <div className="filter-card">
        <input type="text" name="site" placeholder="Site Adı" value={filters.site} onChange={handleFilterChange} />
        <input type="text" name="kullaniciAdi" placeholder="Kullanıcı Adı" value={filters.kullaniciAdi} onChange={handleFilterChange} />
        <input type="text" name="banka" placeholder="Banka Adı" value={filters.banka} onChange={handleFilterChange} />
        <select name="durum" value={filters.durum} onChange={handleFilterChange}>
          <option value="">Tüm Durumlar</option>
          <option value="Beklemede">Beklemede</option>
          <option value="Onaylandı">Onaylandı</option>
          <option value="Reddedildi">Reddedildi</option>
        </select>
      </div>
      
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Site</th>
              <th>Kullanıcı Bilgileri</th>
              <th>Banka Bilgileri</th>
              <th>Tutar</th>
              <th>Talep Tarihi</th>
              <th>IP Adresi</th>
              <th>Durum</th>
              <th>Operatör</th>
            </tr>
          </thead>
          <tbody>
            {requests.map(req => (
              <tr key={req.id} className={req.isSuspicious ? 'suspicious-row' : ''}>
                <td>{req.site}</td>
                <td>
                  {req.kullaniciIsimSoyisim} ({req.kullaniciAdi})
                  {req.isSuspicious === 1 && (
                    <span className="suspicious-icon" title={req.suspicionReason}>⚠️</span>
                  )}
                </td>
                <td>{req.banka} ({req.bankaHesapSahibi})</td>
                <td>{req.tutar.toLocaleString('tr-TR')} TL</td>
                <td>{formatDate(req.talepTarihi)}</td>
                <td>{req.ipAddress}</td>
                <td><span className={`status-badge ${getStatusClass(req.durum)}`}>{req.durum}</span></td>
                <td>
                  {req.durum === 'Beklemede' ? (
                    <div className="action-buttons">
                      <button onClick={() => handleStatusUpdateFromWeb(req.id, 'Onaylandı')} className="approve-btn">Onayla</button>
                      <button onClick={() => handleStatusUpdateFromWeb(req.id, 'Reddedildi')} className="reject-btn">Reddet</button>
                    </div>
                  ) : (
                    <span className="operator-name">{req.operator}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default InvestmentRequestsPage;
