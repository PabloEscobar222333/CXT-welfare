import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { memberService, contributionService, eventService, expenseService, auditService } from '../services/api';

const DataContext = createContext();

export function DataProvider({ children }) {
  const { user } = useAuth();
  
  const [members, setMembers] = useState([]);
  const [contributions, setContributions] = useState([]);
  const [events, setEvents] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAllData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [mRes, cRes, evRes, exRes, aRes] = await Promise.all([
        memberService.getAllMembers(),
        contributionService.getAllContributions(),
        eventService.getAllEvents(),
        expenseService.getAllExpenses(),
        auditService.getLogs()
      ]);

      setMembers(mRes.data || []);
      setContributions(cRes.data || []);
      setEvents(evRes.data || []);
      setExpenses(exRes.data || []);
      
      const logs = (aRes.data || []).map(l => ({
        id: l.id,
        user: l.users?.full_name || 'System',
        role: l.users?.role || 'system',
        action: l.action_type,
        details: l.description,
        timestamp: new Date(l.created_at).toLocaleString(),
        ip: l.ip_address || 'Unknown'
      }));
      setAuditLog(logs);
    } catch (error) {
      console.error("Error fetching data from Supabase:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [user]);

  return (
    <DataContext.Provider value={{ 
      members, setMembers, 
      contributions, setContributions, 
      events, setEvents, 
      expenses, setExpenses, 
      auditLog, setAuditLog,
      refreshData: fetchAllData
    }}>
      {children}
    </DataContext.Provider>
  );
}

export const useData = () => useContext(DataContext);
