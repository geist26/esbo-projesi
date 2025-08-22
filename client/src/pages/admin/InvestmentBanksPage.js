import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './InvestmentBanksPage.css';

// IBAN formatlama fonksiyonu
const formatIBAN = (value) => {
    let cleanValue = value.startsWith('TR') ? value.substring(2) : value;
    let input = cleanValue.replace(/[^0-9]/g, '');
    input = input.substring(0, 24);
    let formatted = 'TR';
    for (let i = 0; i < input.length; i++) {
        if (i === 2 || (i > 2 && (i - 2) % 4 === 0)) {
            formatted += ' ';
        }
        formatted += input[i];
    }
    return formatted;
};

// GÜNCELLEME: Para formatlama fonksiyonu eski, sorunsuz haline geri döndürüldü.
const formatCurrency = (value) => {
    if (value === null || value === undefined) return '';
    const stringValue = String(value);
    // Değerin içindeki rakam olmayan her şeyi (noktalar dahil) temizle
    const number = parseInt(stringValue.replace(/[^0-9]/g, ''), 10);
    // Eğer geçerli bir sayı değilse boş string döndür, aksi halde binlik ayraçlarla formatla
    return isNaN(number) ? '' : number.toLocaleString('tr-TR');
};

const InvestmentBanksPage = () => {
  const [banks, setBanks] = useState([]);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [editingBank, setEditingBank] = useState(null);
  const [formData, setFormData] = useState({
    bankaAdi: '',
    iban: '',
    hesapSahibi: '',
    minYatirim: '',
    maxYatirim: '',
    islemAdedi: ''
  });
  const [logoFile, setLogoFile] = useState(null);

  useEffect(() => { fetchBanks(); }, []);

  const fetchBanks = async () => {
    try {
      const response = await axios.get('http://localhost:5001/api/banks/investment');
      setBanks(response.data);
    } catch (error) {
      console.error("Bankalar çekilirken hata oluştu:", error);
    }
  };
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let processedValue = value;

    if (name === 'bankaAdi') {
        processedValue = value.toUpperCase();
    }
    if (name === 'iban') {
        processedValue = formatIBAN(value);
    }
    if (name === 'minYatirim' || name === 'maxYatirim') {
        processedValue = formatCurrency(value);
    }

    setFormData({ ...formData, [name]: processedValue });
  };

  const handleFileChange = (e) => {
    setLogoFile(e.target.files[0]);
  };

  const sendLockStatus = async (bankId, isLocked) => {
    try {
      await axios.post('http://localhost:5001/api/banks/investment/lock', { bankId, isLocked });
    } catch (error) {
      console.error("Banka kilit durumu gönderilirken hata:", error);
    }
  };

  const resetForm = () => {
    if (editingBank) {
      sendLockStatus(editingBank.id, false);
    }
    setIsFormVisible(false);
    setEditingBank(null);
    setFormData({ bankaAdi: '', iban: '', hesapSahibi: '', minYatirim: '', maxYatirim: '', islemAdedi: '' });
    setLogoFile(null);
  };

  const handleAddNewBank = () => {
    setEditingBank(null);
    setFormData({
      bankaAdi: '',
      iban: '',
      hesapSahibi: '',
      minYatirim: '',
      maxYatirim: '',
      islemAdedi: ''
    });
    setLogoFile(null);
    setIsFormVisible(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const bankData = new FormData();
    // GÜNCELLEME: Sunucuya göndermeden önce binlik ayraçlarını temizle
    const cleanFormData = {
        ...formData,
        iban: 'TR' + formData.iban.replace(/[^0-9]/g, ''),
        minYatirim: formData.minYatirim.replace(/\./g, ''),
        maxYatirim: formData.maxYatirim.replace(/\./g, ''),
    };

    if (logoFile) {
        bankData.append('logo', logoFile);
    }
    for (const key in cleanFormData) {
        bankData.append(key, cleanFormData[key]);
    }

    try {
        if (editingBank) {
            await axios.put(`http://localhost:5001/api/banks/investment/${editingBank.id}`, bankData);
        } else {
            await axios.post('http://localhost:5001/api/banks/investment', bankData);
        }
        fetchBanks();
        resetForm();
    } catch (error) {
        console.error("Banka kaydedilirken hata:", error);
        if (editingBank) {
            sendLockStatus(editingBank.id, false);
        }
    }
  };

  const handleEdit = (bank) => {
    sendLockStatus(bank.id, true);
    setEditingBank(bank);
    setFormData({
        bankaAdi: bank.bankaAdi,
        iban: formatIBAN(bank.iban),
        hesapSahibi: bank.hesapSahibi,
        minYatirim: formatCurrency(bank.minYatirim),
        maxYatirim: formatCurrency(bank.maxYatirim),
        islemAdedi: bank.islemAdedi
    });
    setIsFormVisible(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Bu bankayı silmek istediğinizden emin misiniz?')) {
      try {
        await axios.delete(`http://localhost:5001/api/banks/investment/${id}`);
        fetchBanks();
      } catch (error) {
        console.error("Banka silinirken hata:", error);
      }
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Yatırım Bankaları</h1>
        <button onClick={handleAddNewBank} className="add-btn">Yeni Banka Ekle</button>
      </div>

      {isFormVisible && (
        <div className="form-card">
          <h3>{editingBank ? 'Banka Düzenle' : 'Yeni Banka Ekle'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
                <input type="text" name="bankaAdi" value={formData.bankaAdi} onChange={handleInputChange} placeholder="Banka Adı" required />
                <input type="text" name="hesapSahibi" value={formData.hesapSahibi} onChange={handleInputChange} placeholder="Hesap Sahibi Adı Soyadı" required />
            </div>
            <div className="form-row">
                <input type="text" name="iban" value={formData.iban} onChange={handleInputChange} placeholder="TR" required maxLength="32" />
            </div>
            <div className="form-row">
                <div className="currency-input">
                    <input type="text" name="minYatirim" value={formData.minYatirim} onChange={handleInputChange} placeholder="Min. Yatırım Tutarı" required />
                    <span>TL</span>
                </div>
                <div className="currency-input">
                    <input type="text" name="maxYatirim" value={formData.maxYatirim} onChange={handleInputChange} placeholder="Max. Yatırım Tutarı" required />
                    <span>TL</span>
                </div>
            </div>
            <div className="form-row">
                <input type="number" name="islemAdedi" value={formData.islemAdedi} onChange={handleInputChange} placeholder="İşlem Adedi" required />
                <div className="file-input-wrapper">
                    <label>Banka Logosu (PNG)</label>
                    <input type="file" name="logo" onChange={handleFileChange} accept="image/png" />
                </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="save-btn">{editingBank ? 'Güncelle' : 'Kaydet'}</button>
              <button type="button" onClick={resetForm} className="cancel-btn">İptal</button>
            </div>
          </form>
        </div>
      )}

      <div className="bank-cards-container">
        {banks.map(bank => (
          <div key={bank.id} className="bank-card">
            <img src={`http://localhost:5001${bank.logo}`} onError={(e) => { e.target.style.display = 'none' }} alt={bank.bankaAdi} className="bank-logo" />
            <div className="bank-info">
                <p><strong>Banka:</strong> {bank.bankaAdi}</p>
                <p><strong>IBAN:</strong> {formatIBAN(bank.iban)}</p>
                <p><strong>Hesap Sahibi:</strong> {bank.hesapSahibi}</p>
                <p><strong>Limit:</strong> {formatCurrency(bank.minYatirim)} - {formatCurrency(bank.maxYatirim)} TL</p>
                <p><strong>İşlem Adedi:</strong> {bank.islemAdedi}</p>
            </div>
            <div className="card-actions">
                <button onClick={() => handleEdit(bank)} className="edit-btn">Güncelle</button>
                <button onClick={() => handleDelete(bank.id)} className="delete-btn">Sil</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default InvestmentBanksPage;
