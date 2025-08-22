import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './SettingsModal.css';

const defaultSounds = [
    { name: 'Varsayılan', url: '/sounds/default.mp3' },
    { name: 'Zil Sesi', url: '/sounds/bell.mp3' },
    { name: 'Melodi', url: '/sounds/melody.mp3' },
];

const SettingsModal = ({ userId, onClose, onSettingsSave }) => {
    const [settings, setSettings] = useState({ soundEnabled: true, selectedSound: '', profilePicture: null });
    const [customSoundFile, setCustomSoundFile] = useState(null);
    const [pictureFile, setPictureFile] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [currentSound, setCurrentSound] = useState(null);

    useEffect(() => {
        const currentSettings = JSON.parse(localStorage.getItem('userSettings'));
        if (currentSettings) {
            setSettings(currentSettings);
        }
    }, []);

    const handlePreviewSound = () => {
        if (currentSound) {
            currentSound.pause();
            currentSound.currentTime = 0;
        }
        if (settings.selectedSound) {
            const soundToPlay = new Audio(`http://localhost:5001${settings.selectedSound}`);
            soundToPlay.play().catch(() => {});
            setCurrentSound(soundToPlay);
        }
    };

    const handleToggle = () => {
        setSettings(prev => ({ ...prev, soundEnabled: !prev.soundEnabled }));
    };

    const handleSoundChange = (e) => {
        setSettings(prev => ({ ...prev, selectedSound: e.target.value }));
    };

    const handleCustomSoundFileChange = (e) => {
        setCustomSoundFile(e.target.files[0]);
    };

    const handlePictureFileChange = (e) => {
        setPictureFile(e.target.files[0]);
    };

    const handleSave = async () => {
        setIsLoading(true);
        let finalSettings = { ...settings };
        const token = localStorage.getItem('authToken');

        if (pictureFile) {
            const pictureFormData = new FormData();
            pictureFormData.append('pictureFile', pictureFile);
            try {
                const response = await axios.post(`http://localhost:5001/api/users/upload-picture/${userId}`, pictureFormData, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                finalSettings.profilePicture = response.data.pictureUrl;
            } catch (error) {
                alert("Profil resmi yüklenirken hata oluştu.");
                setIsLoading(false);
                return;
            }
        }

        if (customSoundFile) {
            const soundFormData = new FormData();
            soundFormData.append('soundFile', customSoundFile);
            try {
                const response = await axios.post(`http://localhost:5001/api/users/upload-sound/${userId}`, soundFormData, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                finalSettings.selectedSound = response.data.soundUrl;
            } catch (error) {
                alert("Ses dosyası yüklenirken hata oluştu.");
                setIsLoading(false);
                return;
            }
        }
        
        try {
            const response = await axios.put(`http://localhost:5001/api/users/${userId}/settings`, { settings: finalSettings }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            localStorage.setItem('userSettings', JSON.stringify(response.data.settings));
            
            if (onSettingsSave) {
                onSettingsSave();
            }

            alert("Ayarlar kaydedildi!");
            onClose();
        } catch (error) {
            alert("Ayarlar kaydedilirken hata oluştu.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <h3>Ayarlar</h3>
                
                <div className="setting-row">
                    <label htmlFor="picture-upload">Profil Resmi</label>
                    <input type="file" id="picture-upload" accept="image/png, image/jpeg" onChange={handlePictureFileChange} />
                </div>

                <div className="setting-row">
                    <label>Sesli Bildirimler</label>
                    <label className="switch">
                        <input type="checkbox" checked={settings.soundEnabled} onChange={handleToggle} />
                        <span className="slider round"></span>
                    </label>
                </div>

                <div className="setting-row sound-select-row">
                    <label htmlFor="sound-select">Bildirim Sesi</label>
                    <div className="sound-controls">
                        <select id="sound-select" value={settings.selectedSound} onChange={handleSoundChange} disabled={!settings.soundEnabled}>
                            {defaultSounds.map(sound => (
                                <option key={sound.url} value={sound.url}>{sound.name}</option>
                            ))}
                        </select>
                        <button className="preview-btn" onClick={handlePreviewSound} disabled={!settings.soundEnabled}>Önizle</button>
                    </div>
                </div>
                
                <div className="setting-row">
                    <label htmlFor="custom-sound">Özel Ses Yükle (MP3)</label>
                    <input type="file" id="custom-sound" accept=".mp3" onChange={handleCustomSoundFileChange} disabled={!settings.soundEnabled} />
                </div>

                <div className="form-actions">
                    <button onClick={handleSave} className="save-btn" disabled={isLoading}>
                        {isLoading ? 'Kaydediliyor...' : 'Kaydet'}
                    </button>
                    <button onClick={onClose} className="cancel-btn" disabled={isLoading}>Kapat</button>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
