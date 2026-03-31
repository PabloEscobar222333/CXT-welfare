import React, { useState } from 'react';
import { useData } from '../../context/DataContext';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Search, AlertCircle, Filter } from 'lucide-react';

export function AuditLog() {
  const { auditLog } = useData();
  const [search, setSearch] = useState('');
  const [userFilter, setUserFilter] = useState('All');
  const [actionFilter, setActionFilter] = useState('All');

  const filteredLogs = auditLog.filter(log => {
    const details = log.details || '';
    const matchSearch = details.toLowerCase().includes(search.toLowerCase());
    const matchUser = userFilter === 'All' || log.user === userFilter;
    const matchAction = actionFilter === 'All' || log.action === actionFilter;
    return matchSearch && matchUser && matchAction;
  });

  const uniqueUsers = [...new Set(auditLog.map(l => l.user))];
  const uniqueActions = [...new Set(auditLog.map(l => l.action))];

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '24px', color: 'var(--primary-dark)', marginBottom: '4px' }}>System Audit Log</h2>
        <p style={{ color: 'var(--text-mid)' }}>Track all critical system actions for compliance and debugging.</p>
      </div>

      <div style={{ backgroundColor: '#DBEAFE', color: '#1E40AF', padding: '16px', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
        <div style={{ fontSize: '14px', lineHeight: '1.5' }}>
          <strong>Read-Only Record:</strong> This log is immutable. System administrators and auditors can view these entries, but they cannot be edited or deleted.
        </div>
      </div>

      <Card style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', width: '250px' }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
            <input 
              type="text" 
              placeholder="Search details..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', height: '40px', paddingLeft: '32px', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }}
            />
          </div>
          <select value={userFilter} onChange={e => setUserFilter(e.target.value)} style={{ height: '40px', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '0 12px', outline: 'none' }}>
            <option value="All">All Users</option>
            {uniqueUsers.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
          <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} style={{ height: '40px', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '0 12px', outline: 'none' }}>
            <option value="All">All Action Types</option>
            {uniqueActions.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--light-blue)', color: 'var(--primary-dark)', fontSize: '12px', textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 24px', fontWeight: '600' }}>Timestamp</th>
                <th style={{ padding: '12px 24px', fontWeight: '600' }}>User</th>
                <th style={{ padding: '12px 24px', fontWeight: '600' }}>Role</th>
                <th style={{ padding: '12px 24px', fontWeight: '600' }}>Action</th>
                <th style={{ padding: '12px 24px', fontWeight: '600' }}>Details</th>
                <th style={{ padding: '12px 24px', fontWeight: '600' }}>IP / Device</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log, i) => (
                <tr key={log.id} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: i % 2 === 0 ? 'var(--white)' : 'var(--pale-blue)' }}>
                  <td style={{ padding: '16px 24px', fontSize: '13px', color: 'var(--text-mid)', whiteSpace: 'nowrap' }}>{log.timestamp}</td>
                  <td style={{ padding: '16px 24px', fontSize: '14px', fontWeight: '500' }}>{log.user}</td>
                  <td style={{ padding: '16px 24px' }}><Badge variant="neutral">{(log?.role || 'system').replace('_', ' ')}</Badge></td>
                  <td style={{ padding: '16px 24px', fontSize: '14px', fontWeight: '600' }}>{log.action}</td>
                  <td style={{ padding: '16px 24px', fontSize: '14px', color: 'var(--text-mid)' }}>{log.details}</td>
                  <td style={{ padding: '16px 24px', fontSize: '13px', color: 'var(--text-light)' }}>{log.ip}</td>
                </tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-mid)' }}>No audit logs found matching criteria.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
