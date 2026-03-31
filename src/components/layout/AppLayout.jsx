import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export function AppLayout({ children }) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => { if (window.innerWidth > 768) setIsMobileOpen(false); };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          onClick={() => setIsMobileOpen(false)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 40 }} 
        />
      )}

      {/* Sidebar Wrapper */}
      <div className={`sidebar-wrapper ${isMobileOpen ? 'open' : ''}`}>
        <Sidebar onClose={() => setIsMobileOpen(false)} />
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--pale-blue)', overflow: 'hidden', minWidth: 0 }}>
        <Header onMenuClick={() => setIsMobileOpen(true)} />
        <main className="app-main" style={{ flex: 1, overflowY: 'auto', padding: '2rem' }}>
          {children}
        </main>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .sidebar-wrapper {
          position: fixed;
          top: 0; left: -240px; bottom: 0;
          z-index: 50;
          transition: left 0.3s ease;
        }
        .sidebar-wrapper.open { left: 0; }
        @media (min-width: 769px) {
          .sidebar-wrapper { position: relative; left: 0; }
        }
        @media (max-width: 768px) {
          .app-main { padding: 1rem !important; }
        }
      `}} />
    </div>
  );
}
