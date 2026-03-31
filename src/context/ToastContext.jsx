import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext();

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div style={{ position: 'fixed', bottom: '24px', right: '24px', display: 'flex', flexDirection: 'column', gap: '8px', zIndex: 9999 }}>
        {toasts.map(toast => {
          let Icon = Info;
          let bgColor = 'var(--primary-mid)';
          if (toast.type === 'success') { Icon = CheckCircle; bgColor = 'var(--success)'; }
          if (toast.type === 'error') { Icon = AlertCircle; bgColor = 'var(--danger)'; }
          if (toast.type === 'warning') { Icon = AlertCircle; bgColor = 'var(--warning)'; }

          return (
            <div key={toast.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: 'var(--white)', color: 'var(--text-dark)', padding: '12px 16px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', borderLeft: `4px solid ${bgColor}`, minWidth: '300px', animation: 'slideIn 0.3s ease' }}>
              <Icon size={20} color={bgColor} />
              <div style={{ flex: 1, fontSize: '14px', fontWeight: '500' }}>{toast.message}</div>
              <button onClick={() => removeToast(toast.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)', padding: 0 }}><X size={16} /></button>
            </div>
          )
        })}
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      `}} />
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
