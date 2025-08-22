import React, { useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import { useSocket } from '../../contexts/SocketContext';
import SettingsModal from '../common/SettingsModal';
import PasswordModal from '../common/PasswordModal';
import './Navbar.css';

const Navbar = () => {
  const [username, setUsername] = useState('');
  const [userId, setUserId] = useState(null);
  const [profilePicture, setProfilePicture] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [activeAdmins, setActiveAdmins] = useState([]);
  const socket = useSocket();

  const loadUserData = () => {
    const token = localStorage.getItem('authToken');
    const userSettings = JSON.parse(localStorage.getItem('userSettings'));
    if (token) {
      try {
        const decodedToken = jwtDecode(token);
        setUsername(decodedToken.username);
        setUserId(decodedToken.id);
        if (userSettings && userSettings.profilePicture) {
            setProfilePicture(userSettings.profilePicture);
        } else {
            setProfilePicture(null);
        }
      } catch (error) {
        console.error("Geçersiz token:", error);
        handleLogout();
      }
    }
  };

  useEffect(() => {
    loadUserData();
  }, []);

  useEffect(() => {
    if (socket == null) return;
    socket.on('update_active_admins', (admins) => {
      setActiveAdmins(admins);
    });
    return () => {
      socket.off('update_active_admins');
    };
  }, [socket]);

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userSettings');
    window.location.href = '/login';
  };

  return (
    <>
      <header className="navbar">
        <div className="navbar-left">
          <div className="active-admins">
            <span className="active-dot"></span>
            <span>Aktif Adminler: {activeAdmins.map(admin => admin.username).join(', ')}</span>
          </div>
        </div>
        <div className="navbar-right">
          <div className="user-menu" onClick={() => setDropdownOpen(!dropdownOpen)}>
            <img 
              src={profilePicture ? `http://localhost:5001${profilePicture}` : `https://placehold.co/40x40/f0f0f0/777?text=${username.charAt(0).toUpperCase()}`} 
              alt="Profil" 
              className="navbar-avatar"
              key={profilePicture}
            />
            <span>{username}</span>
            <div className={`dropdown-menu ${dropdownOpen ? 'show' : ''}`}>
              <a href="#settings" onClick={(e) => { e.preventDefault(); setShowSettingsModal(true); setDropdownOpen(false); }}>Ayarlar</a>
              <a href="#password" onClick={(e) => { e.preventDefault(); setShowPasswordModal(true); setDropdownOpen(false); }}>Şifre Güncelle</a>
              <a href="#logout" onClick={handleLogout}>Çıkış Yap</a>
            </div>
          </div>
        </div>
      </header>
      
      {showSettingsModal && (
        <SettingsModal 
            userId={userId} 
            onClose={() => setShowSettingsModal(false)} 
            onSettingsSave={loadUserData}
        />
      )}

      {showPasswordModal && (
        <PasswordModal userId={userId} onClose={() => setShowPasswordModal(false)} />
      )}
    </>
  );
};

export default Navbar;
