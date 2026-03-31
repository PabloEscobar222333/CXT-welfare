import React, { createContext, useContext, useState, useCallback } from 'react';

const STORAGE_KEY = 'cxt_platform_settings';

const DEFAULTS = {
  platformName:        'CXT Welfare Fund',
  currency:            'GHS',
  monthlyAmount:       '50',
  reminderDay:         '15',
  financialYearStart:  '1',
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULTS };
}

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(loadSettings);

  const updateSettings = useCallback((newValues) => {
    setSettings(prev => {
      const merged = { ...prev, ...newValues };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(merged)); } catch { /* ignore */ }
      return merged;
    });
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>');
  return ctx;
}
