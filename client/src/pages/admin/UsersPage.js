// Dosya: client/src/pages/admin/UsersPage.js
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import './UsersPage.css';

const UsersPage = () => {
  const [users, setUsers] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  
  const [currentUserId, setCurrentUserId] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token) {
      const decoded = jwtDecode(token);
      setCurrentUserId(decoded.id);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await axios.get('http://localhost:5001/api/users');
      setUsers(response.data);
    } catch (error) {
      console.error("Kullanıcılar getirilirken hata:", error);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (newPassword !== newPasswordConfirm) {
      alert("Şifreler uyuşmuyor!");
      return;
    }
    try {
      await axios.post('http://localhost:5001/api/users', { username: newUsername, password: newPassword });
      setShowAddForm(false);
      setNewUsername('');
      setNewPassword('');
      setNewPasswordConfirm('');
      fetchUsers();
    } catch (error) {
      alert(error.response?.data?.message || 'Kullanıcı eklenemedi.');
    }
  };

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
     if (newPassword !== newPasswordConfirm) {
      alert("Şifreler uyuşmuyor!");
      return;
    }
    try {
      await axios.put(`http://localhost:5001/api/users/${selectedUser.id}/password`, { password: newPassword });
      setShowPasswordModal(false);
      setSelectedUser(null);
      setNewPassword('');
      setNewPasswordConfirm('');
    } catch (error) {
       alert(error.response?.data?.message || 'Şifre güncellenemedi.');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (userId === currentUserId) {
      alert("Kendi hesabınızı silemezsiniz!");
      return;
    }
    if (window.confirm("Bu kullanıcıyı silmek istediğinizden emin misiniz?")) {
      try {
        await axios.delete(`http://localhost:5001/api/users/${userId}`);
        fetchUsers();
      } catch (error) {
        alert("Kullanıcı silinirken bir hata oluştu.");
      }
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Yönetici Kullanıcıları</h1>
        <button onClick={() => setShowAddForm(!showAddForm)} className="add-btn">
          {showAddForm ? 'Formu Kapat' : 'Yeni Kullanıcı Ekle'}
        </button>
      </div>

      {showAddForm && (
        <div className="form-card">
          <form onSubmit={handleAddUser}>
            <h3>Yeni Yönetici Ekle</h3>
            <input type="text" placeholder="Kullanıcı Adı" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} required />
            <input type="password" placeholder="Şifre" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
            <input type="password" placeholder="Şifre Tekrar" value={newPasswordConfirm} onChange={(e) => setNewPasswordConfirm(e.target.value)} required />
            <div className="form-actions">
              <button type="submit" className="save-btn">Ekle</button>
            </div>
          </form>
        </div>
      )}

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Kullanıcı Adı</th>
              <th>Oluşturma Tarihi</th>
              <th>İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id}>
                <td>{user.username}</td>
                <td>{new Date(user.createdAt).toLocaleDateString('tr-TR')}</td>
                <td>
                  <div className="action-buttons">
                    <button className="edit-btn" onClick={() => { setSelectedUser(user); setShowPasswordModal(true); }}>Şifre Güncelle</button>
                    <button className="delete-btn" onClick={() => handleDeleteUser(user.id)}>Sil</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showPasswordModal && selectedUser && (
        <div className="modal-overlay">
          <div className="modal-content">
            <form onSubmit={handlePasswordUpdate}>
              <h3>{selectedUser.username} için Şifre Güncelle</h3>
              <input type="password" placeholder="Yeni Şifre" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
              <input type="password" placeholder="Yeni Şifre Tekrar" value={newPasswordConfirm} onChange={(e) => setNewPasswordConfirm(e.target.value)} required />
              <div className="form-actions">
                <button type="submit" className="save-btn">Güncelle</button>
                <button type="button" className="cancel-btn" onClick={() => { setShowPasswordModal(false); setSelectedUser(null); }}>İptal</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersPage;