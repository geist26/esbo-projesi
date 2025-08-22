import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './WithdrawalBanksPage.css';

const WithdrawalBanksPage = () => {
  const [banks, setBanks] = useState([]);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [editingBank, setEditingBank] = useState(null);
  
  const [bankaAdi, setBankaAdi] = useState('');
  const [logoFile, setLogoFile] = useState(null);
  const [fields, setFields] = useState([{ label: '', placeholder: '' }]);

  useEffect(() => {
    fetchBanks();
  }, []);

  const fetchBanks = async () => {
    const response = await axios.get('http://localhost:5001/api/banks/withdrawal');
    setBanks(response.data);
  };

  const handleFieldChange = (index, event) => {
    const values = [...fields];
    values[index][event.target.name] = event.target.value;
    setFields(values);
  };

  const handleAddField = () => setFields([...fields, { label: '', placeholder: '' }]);
  const handleRemoveField = (index) => {
    const values = [...fields];
    values.splice(index, 1);
    setFields(values);
  };
  
  // YENİ: Çekim yönteminin kilit durumunu sunucuya bildiren fonksiyon
  const sendLockStatus = async (bankId, isLocked) => {
    try {
      // Yatırım bankalarıyla aynı sinyali kullanıyoruz, bu sinyal genel amaçlı.
      await axios.post('http://localhost:5001/api/banks/investment/lock', { bankId, isLocked });
    } catch (error) {
      console.error("Banka kilit durumu gönderilirken hata:", error);
    }
  };

  const resetForm = () => {
    // Eğer bir yöntem düzenleniyorsa, iptal edildiğinde kilidini aç
    if (editingBank) {
      sendLockStatus(editingBank.id, false);
    }
    setIsFormVisible(false);
    setEditingBank(null);
    setBankaAdi('');
    setLogoFile(null);
    setFields([{ label: '', placeholder: '' }]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const bankData = new FormData();
    bankData.append('bankaAdi', bankaAdi);
    if (logoFile) {
        bankData.append('logo', logoFile);
    }
    bankData.append('requiredFields', JSON.stringify(fields));

    try {
        if (editingBank) {
            await axios.put(`http://localhost:5001/api/banks/withdrawal/${editingBank.id}`, bankData);
        } else {
            await axios.post('http://localhost:5001/api/banks/withdrawal', bankData);
        }
        fetchBanks();
        // Formu sıfırla (bu, editingBank'i null yapar ve kilit açma sinyali göndermez)
        setIsFormVisible(false);
        setEditingBank(null);
        setBankaAdi('');
        setLogoFile(null);
        setFields([{ label: '', placeholder: '' }]);
    } catch (error) {
        console.error("Çekim bankası kaydedilirken hata:", error);
        // Hata durumunda kilidi aç
        if (editingBank) {
            sendLockStatus(editingBank.id, false);
        }
    }
  };

  const handleEdit = (bank) => {
    // YENİ: Düzenlemeye başlamadan önce yöntemi kilitlemek için sinyal gönder
    sendLockStatus(bank.id, true);
    
    setEditingBank(bank);
    setBankaAdi(bank.bankaAdi);
    setFields(bank.requiredFields);
    setIsFormVisible(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Bu yöntemi silmek istediğinizden emin misiniz?')) {
        await axios.delete(`http://localhost:5001/api/banks/withdrawal/${id}`);
        fetchBanks();
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Çekim Bankaları</h1>
        <button onClick={() => setIsFormVisible(true)} className="add-btn">Yeni Çekim Yöntemi Ekle</button>
      </div>

      {isFormVisible && (
        <div className="form-card">
          <h3>{editingBank ? 'Yöntem Düzenle' : 'Yeni Çekim Yöntemi Ekle'}</h3>
          <form onSubmit={handleSubmit}>
            <input type="text" value={bankaAdi} onChange={(e) => setBankaAdi(e.target.value)} placeholder="Banka / Yöntem Adı" required />
            <label>Logo (PNG)</label>
            <input type="file" onChange={(e) => setLogoFile(e.target.files[0])} accept="image/png" />
            
            <hr />
            <h4>Müşteriden İstenilecek Bilgiler</h4>
            {fields.map((field, index) => (
              <div key={index} className="dynamic-field-row">
                <input type="text" name="label" placeholder="Alan Başlığı (örn: Papara No)" value={field.label} onChange={e => handleFieldChange(index, e)} required/>
                <input type="text" name="placeholder" placeholder="Placeholder (örn: 1234567890)" value={field.placeholder} onChange={e => handleFieldChange(index, e)} />
                <button type="button" onClick={() => handleRemoveField(index)} className="remove-field-btn">Sil</button>
              </div>
            ))}
            <button type="button" onClick={handleAddField} className="add-field-btn">Yeni Alan Ekle</button>
            
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
            <img src={`http://localhost:5001${bank.logo}`} alt={bank.bankaAdi} className="bank-logo" />
            <div className="bank-info">
              <p><strong>Yöntem:</strong> {bank.bankaAdi}</p>
              <strong>İstenen Bilgiler:</strong>
              <ul>
                {bank.requiredFields.map((field, i) => <li key={i}>{field.label}</li>)}
              </ul>
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

export default WithdrawalBanksPage;
