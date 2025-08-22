import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import './Sidebar.css';

const Sidebar = () => {
  const [bankaSubmenuOpen, setBankaSubmenuOpen] = useState(false);
  const [talepSubmenuOpen, setTalepSubmenuOpen] = useState(false);
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    const userSettings = JSON.parse(localStorage.getItem('userSettings'));
    if (userSettings && userSettings.role) {
      setUserRole(userSettings.role);
    }
  }, []);

  const menuItems = [
    { name: 'Dashboard', path: '/dashboard' },
    { 
      name: 'Banka İşlemleri', 
      isOpen: bankaSubmenuOpen,
      toggle: () => setBankaSubmenuOpen(!bankaSubmenuOpen),
      submenu: [
        { name: 'Yatırım Bankaları', path: '/investment-banks' },
        { name: 'Çekim Bankaları', path: '/withdrawal-banks' },
      ]
    },
    { 
      name: 'Talepler', 
      isOpen: talepSubmenuOpen,
      toggle: () => setTalepSubmenuOpen(!talepSubmenuOpen),
      submenu: [
        { name: 'Yatırım Talepleri', path: '/investment-requests' },
        { name: 'Çekim Talepleri', path: '/withdrawal-requests' },
      ]
    },
    { name: 'Kullanıcılar', path: '/users' },
    { name: 'Siteler', path: '/sites' },
    { name: 'Raporlar', path: '/reports' },
    { name: 'Hesap', path: '/account' },
  ];

  if (userRole === 'super_admin') {
    menuItems.push({ name: 'İşlem Logları', path: '/action-logs' });
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h3>Esbo Panel</h3>
      </div>
      <nav className="sidebar-nav">
        <ul>
          {menuItems.map((item, index) => (
            <li key={index} className={item.submenu ? 'has-submenu' : ''}>
              {item.submenu ? (
                <>
                  <div className="menu-item" onClick={item.toggle}>
                    <span>{item.name}</span>
                    <span className={`arrow ${item.isOpen ? 'open' : ''}`}>›</span>
                  </div>
                  <ul className={`submenu ${item.isOpen ? 'open' : ''}`}>
                    {item.submenu.map((subItem, subIndex) => (
                      <li key={subIndex}>
                        <NavLink to={subItem.path}>{subItem.name}</NavLink>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <NavLink to={item.path} className="menu-item">
                  {item.name}
                </NavLink>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
};

export default Sidebar;
