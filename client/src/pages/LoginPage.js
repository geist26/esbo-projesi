import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './LoginPage.css';

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const response = await axios.post('http://localhost:5001/api/auth/login', {
        username,
        password,
      });

      // Sunucudan gelen token ve kullanıcı bilgilerini al
      const { token, user } = response.data;
      
      // Token'ı tarayıcı hafızasında sakla
      localStorage.setItem('authToken', token);
      
      // GÜNCELLEME: Sadece ayarları değil, kullanıcının TÜM bilgilerini
      // (rol, profil resmi dahil) 'userSettings' olarak kaydet.
      localStorage.setItem('userSettings', JSON.stringify(user));

      // Giriş başarılı, dashboard'a yönlendir
      window.location.href = '/dashboard'; 

    } catch (err) {
      setError('Kullanıcı adı veya şifre hatalı!');
      console.error('Giriş hatası:', err.response?.data?.message || err.message);
    }
  };

  return (
    <div className="customer-container">
      <form className="login-form" onSubmit={handleLogin}>
        <h2>Esbo Admin Panel</h2>
        {error && <p className="error-message">{error}</p>}
        <div className="input-group">
          <label htmlFor="username">Kullanıcı Adı</label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div className="input-group">
          <label htmlFor="password">Şifre</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="login-button">Giriş Yap</button>
      </form>
    </div>
  );
};

export default LoginPage;
