import React, { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';
import { jwtDecode } from 'jwt-decode'; // YENİ: Token'ı çözmek için import et

const SocketContext = createContext();
export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);

    const playNotificationSound = () => {
        try {
            const userSettings = JSON.parse(localStorage.getItem('userSettings'));
            if (userSettings && userSettings.soundEnabled && userSettings.selectedSound) {
                const sound = new Audio(`http://localhost:5001${userSettings.selectedSound}`);
                sound.play().catch(() => {}); // Kullanıcı etkileşimi olmadan çalma hatasını yoksay
            }
        } catch (error) {
            console.error("Bildirim sesi çalınırken hata:", error);
        }
    };

    useEffect(() => {
        const newSocket = io('http://localhost:5001');
        setSocket(newSocket);

        // YENİ: Sunucuya başarıyla bağlandığımızda...
        newSocket.on('connect', () => {
            console.log('Sunucuya başarıyla bağlanıldı. Kimlik gönderiliyor...');
            const token = localStorage.getItem('authToken');
            if (token) {
                try {
                    const decodedToken = jwtDecode(token);
                    // Sunucuya "ben online oldum" mesajı gönder
                    newSocket.emit('admin_online', {
                        userId: decodedToken.id,
                        username: decodedToken.username
                    });
                } catch (error) {
                    console.error("Token çözümlenirken hata:", error);
                }
            }
        });

        newSocket.on('new_investment_request', playNotificationSound);
        newSocket.on('new_withdrawal_request', playNotificationSound);

        return () => {
            newSocket.off('new_investment_request');
            newSocket.off('new_withdrawal_request');
            newSocket.off('connect');
            newSocket.close();
        };
    }, []);

    return (
        <SocketContext.Provider value={socket}>
            {children}
        </SocketContext.Provider>
    );
};
