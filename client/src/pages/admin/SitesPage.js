import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './SitesPage.css';

const SitesPage = () => {
  const [sites, setSites] = useState([]);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [editingSite, setEditingSite] = useState(null);
  const [formData, setFormData] = useState({
    siteAdi: '',
    telegramBotToken: '',
    telegramGrupId: '',
    yatirimKomisyonu: '',
    cekimKomisyonu: '',
    sitedenAlinanApi: '',
    bizimApimiz: '',
    bakiyeApiAdresi: ''
  });
  const [siteLogoFile, setSiteLogoFile] = useState(null);

  useEffect(() => {
    fetchSites();
  }, []);

  const fetchSites = async () => {
    const response = await axios.get('http://localhost:5001/api/sites');
    setSites(response.data);
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleLogoFileChange = (e) => {
    setSiteLogoFile(e.target.files[0]);
  };
  
  const handleGenerateApiKey = () => {
    const newApiKey = 'ESBO-' + crypto.randomUUID();
    setFormData({ ...formData, bizimApimiz: newApiKey });
  };

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text).then(() => {
      alert(`${type} kopyalandı!`);
    });
  };

  const resetForm = () => {
    setIsFormVisible(false);
    setEditingSite(null);
    setFormData({ siteAdi: '', telegramBotToken: '', telegramGrupId: '', yatirimKomisyonu: '', cekimKomisyonu: '', sitedenAlinanApi: '', bizimApimiz: '', bakiyeApiAdresi: '' });
    setSiteLogoFile(null);
  };

  const handleAddNewSite = () => {
    setEditingSite(null);
    setFormData({
      siteAdi: '', telegramBotToken: '', telegramGrupId: '', yatirimKomisyonu: '', cekimKomisyonu: '', sitedenAlinanApi: '', bizimApimiz: '', bakiyeApiAdresi: ''
    });
    setSiteLogoFile(null);
    setIsFormVisible(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('authToken');

    const submissionData = new FormData();
    for (const key in formData) {
        submissionData.append(key, formData[key]);
    }
    if (siteLogoFile) {
        submissionData.append('siteLogoFile', siteLogoFile);
    }

    try {
      if (editingSite) {
        await axios.put(`http://localhost:5001/api/sites/${editingSite.id}`, submissionData, {
            headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post('http://localhost:5001/api/sites', submissionData, {
            headers: { Authorization: `Bearer ${token}` }
        });
      }
      fetchSites();
      resetForm();
    } catch (error) {
      console.error("Site kaydedilirken hata:", error);
      alert(error.response?.data?.message || "Site kaydedilirken bir hata oluştu.");
    }
  };

  const handleEdit = (site) => {
    setEditingSite(site);
    setFormData({ ...site, bakiyeApiAdresi: site.bakiyeApiAdresi || '' });
    setSiteLogoFile(null);
    setIsFormVisible(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Bu siteyi silmek istediğinizden emin misiniz?')) {
        const token = localStorage.getItem('authToken');
        await axios.delete(`http://localhost:5001/api/sites/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        fetchSites();
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Entegre Siteler</h1>
        <button onClick={handleAddNewSite} className="add-btn">Yeni Site Ekle</button>
      </div>

      {isFormVisible && (
        <div className="form-card">
          <h3>{editingSite ? 'Site Düzenle' : 'Yeni Site Ekle'}</h3>
          <form onSubmit={handleSubmit}>
            <input type="text" name="siteAdi" value={formData.siteAdi} onChange={handleInputChange} placeholder="Site Adı" required />
            <div className="form-row">
                <div className="file-input-wrapper">
                    <label>Site Logosu (PNG, JPG)</label>
                    <input type="file" name="siteLogoFile" onChange={handleLogoFileChange} accept="image/png, image/jpeg" />
                </div>
            </div>
            <input type="text" name="bakiyeApiAdresi" value={formData.bakiyeApiAdresi} onChange={handleInputChange} placeholder="Bakiye Güncelleme API Adresi (Callback URL)" />
            <input type="text" name="telegramBotToken" value={formData.telegramBotToken} onChange={handleInputChange} placeholder="Telegram Bot Token" />
            <input type="text" name="telegramGrupId" value={formData.telegramGrupId} onChange={handleInputChange} placeholder="Telegram Grup ID" />
            <div className="form-row">
                <input type="number" name="yatirimKomisyonu" value={formData.yatirimKomisyonu} onChange={handleInputChange} placeholder="Yatırım Komisyonu (%)" />
                <input type="number" name="cekimKomisyonu" value={formData.cekimKomisyonu} onChange={handleInputChange} placeholder="Çekim Komisyonu (%)" />
            </div>
            <textarea name="sitedenAlinanApi" value={formData.sitedenAlinanApi} onChange={handleInputChange} placeholder="Müşteri Sitesinden Alınan API Anahtarı (varsa)"></textarea>
            <div className="api-generator">
                <input type="text" name="bizimApimiz" value={formData.bizimApimiz} onChange={handleInputChange} placeholder="Müşteri Sitesine Verilecek API Anahtarı" readOnly />
                <button type="button" onClick={handleGenerateApiKey}>Anahtar Oluştur</button>
            </div>
            <div className="form-actions">
              <button type="submit" className="save-btn">{editingSite ? 'Güncelle' : 'Kaydet'}</button>
              <button type="button" onClick={resetForm} className="cancel-btn">İptal</button>
            </div>
          </form>
        </div>
      )}

      <div className="site-cards-container">
        {sites.map(site => {
          const baseUrl = `http://localhost:3000/musteri`;
          const queryParams = `?username=SITENIZDEKI_KULLANICI_ADI&fullName=SITENIZDEKI_ISIM_SOYISIM`;
          const investmentLink = `${baseUrl}/yatirim/${site.id}${queryParams}`;
          const withdrawalLink = `${baseUrl}/cekim/${site.id}${queryParams}`;

          return (
            <div key={site.id} className="site-card">
              <div className="site-card-header">
                {site.siteLogo && <img src={`http://localhost:5001${site.siteLogo}`} alt={`${site.siteAdi} Logo`} className="site-card-logo" />}
                <h3>{site.siteAdi}</h3>
              </div>
              <div className="site-info">
                <p><strong>Callback URL:</strong> {site.bakiyeApiAdresi || 'Tanımlanmamış'}</p>
                <div className="api-key-display">
                  <strong>Gizli API Anahtarı:</strong>
                  <span>{site.bizimApimiz}</span>
                  <button onClick={() => copyToClipboard(site.bizimApimiz, 'API Anahtarı')}>Kopyala</button>
                </div>
                
                <div className="public-links">
                  <strong>Müşteri Linkleri (Örnek Entegrasyon):</strong>
                  <div className="link-row">
                    <span>Yatırım:</span>
                    <input type="text" readOnly value={investmentLink} />
                    <button onClick={() => copyToClipboard(investmentLink, 'Yatırım Linki')}>Kopyala</button>
                  </div>
                  <div className="link-row">
                    <span>Çekim:</span>
                    <input type="text" readOnly value={withdrawalLink} />
                    <button onClick={() => copyToClipboard(withdrawalLink, 'Çekim Linki')}>Kopyala</button>
                  </div>
                </div>
              </div>
              <div className="card-actions">
                <button onClick={() => handleEdit(site)} className="edit-btn">Düzenle</button>
                <button onClick={() => handleDelete(site.id)} className="delete-btn">Sil</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SitesPage;
