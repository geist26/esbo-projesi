import React, { useState } from 'react';
import axios from 'axios';
import './PasswordModal.css'; // Stil dosyasını birazdan oluşturacağız

const PasswordModal = ({ userId, onClose }) => {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (newPassword !== confirmPassword) {
            setError('Yeni şifreler uyuşmuyor.');
            return;
        }
        if (newPassword.length < 6) {
            setError('Yeni şifre en az 6 karakter olmalıdır.');
            return;
        }

        setIsLoading(true);
        try {
            const response = await axios.put(`http://localhost:5001/api/users/update-own-password/${userId}`, {
                currentPassword,
                newPassword
            });
            setSuccess(response.data.message);
            // Başarılı olduktan 2 saniye sonra pencereyi kapat
            setTimeout(() => {
                onClose();
            }, 2000);
        } catch (err) {
            setError(err.response?.data?.message || 'Bir hata oluştu.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content password-modal">
                <h3>Şifre Değiştir</h3>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="currentPassword">Mevcut Şifre</label>
                        <input
                            type="password"
                            id="currentPassword"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="newPassword">Yeni Şifre</label>
                        <input
                            type="password"
                            id="newPassword"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="confirmPassword">Yeni Şifre (Tekrar)</label>
                        <input
                            type="password"
                            id="confirmPassword"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                        />
                    </div>

                    {error && <p className="modal-error">{error}</p>}
                    {success && <p className="modal-success">{success}</p>}

                    <div className="form-actions">
                        <button type="submit" className="save-btn" disabled={isLoading}>
                            {isLoading ? 'Güncelleniyor...' : 'Güncelle'}
                        </button>
                        <button type="button" onClick={onClose} className="cancel-btn" disabled={isLoading}>
                            Kapat
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PasswordModal;
