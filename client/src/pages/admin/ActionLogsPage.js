import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './ActionLogsPage.css';

const ActionLogsPage = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isDownloading, setIsDownloading] = useState(false);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const token = localStorage.getItem('authToken');
                const response = await axios.get('http://localhost:5001/api/logs', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setLogs(response.data);
            } catch (err) {
                setError(err.response?.data?.message || 'Loglar yüklenirken bir hata oluştu. Bu sayfayı görmek için Süper Admin yetkisine sahip olmalısınız.');
            } finally {
                setLoading(false);
            }
        };

        fetchLogs();
    }, []);

    const handleBackup = async () => {
        setIsDownloading(true);
        try {
            const token = localStorage.getItem('authToken');
            const response = await axios.get('http://localhost:5001/api/backup/create', {
                headers: { Authorization: `Bearer ${token}` },
                responseType: 'blob', // Dosya indirmek için bu gerekli
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            const contentDisposition = response.headers['content-disposition'];
            let fileName = 'esbo-backup.zip';
            if (contentDisposition) {
                const fileNameMatch = contentDisposition.match(/filename="(.+)"/);
                if (fileNameMatch && fileNameMatch.length === 2)
                    fileName = fileNameMatch[1];
            }
            link.setAttribute('download', fileName);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            alert("Yedek indirilirken bir hata oluştu.");
            console.error("Yedekleme hatası:", error);
        } finally {
            setIsDownloading(false);
        }
    };

    const formatDate = (dateString) => {
        const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' };
        return new Date(dateString).toLocaleDateString('tr-TR', options);
    };

    if (loading) {
        return <div className="page-container"><p>Yükleniyor...</p></div>;
    }

    if (error) {
        return <div className="page-container"><p className="error-message">{error}</p></div>;
    }

    return (
        <div className="page-container">
            <div className="page-header">
                <h1>İşlem Logları</h1>
                <button onClick={handleBackup} className="backup-btn" disabled={isDownloading}>
                    {isDownloading ? 'Yedekleniyor...' : 'Veritabanı Yedeği İndir'}
                </button>
            </div>
            <p className="page-description">Sistemde adminler tarafından yapılan tüm önemli eylemlerin kaydı.</p>
            
            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Tarih</th>
                            <th>Admin</th>
                            <th>Eylem Tipi</th>
                            <th>Detay</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.map(log => (
                            <tr key={log.id}>
                                <td>{formatDate(log.timestamp)}</td>
                                <td>{log.adminUsername}</td>
                                <td><span className="log-action-type">{log.actionType}</span></td>
                                <td>{log.details}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ActionLogsPage;
