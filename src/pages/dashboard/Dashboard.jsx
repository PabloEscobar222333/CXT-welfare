import React, { useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Wallet, Users, Calendar, Receipt, AlertTriangle, FileText, CheckCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useNavigate } from 'react-router-dom';

const StatCard = ({ title, value, subtext, icon: Icon, valueColor = 'var(--primary-dark)' }) => (
  <Card style={{ flex: 1, minWidth: '180px' }}>
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
      <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: 'var(--light-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-mid)' }}>
        <Icon size={20} />
      </div>
    </div>
    <div style={{ fontSize: '28px', fontWeight: '700', color: valueColor, marginBottom: '4px' }}>
      {value}
    </div>
    <div style={{ fontSize: '14px', color: 'var(--text-mid)', fontWeight: '500' }}>
      {title}
    </div>
    {subtext && <div style={{ fontSize: '12px', color: 'var(--text-light)', marginTop: '8px' }}>{subtext}</div>}
  </Card>
);

const LiveChart = ({ contributions, expenses }) => {
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const chartData = useMemo(() => {
    const map = {};
    contributions.forEach(c => {
      const key = `${c.year}-${String(c.month).padStart(2,'0')}`;
      if (!map[key]) map[key] = { name: monthNames[(c.month||1)-1], income: 0, expense: 0 };
      map[key].income += Number(c.paid || 0);
    });
    expenses.forEach(ex => {
      const d = ex.date || ex.expense_date || '';
      const parts = d.split('-');
      if (parts.length >= 2) {
        const key = `${parts[0]}-${parts[1]}`;
        if (!map[key]) map[key] = { name: monthNames[Number(parts[1])-1], income: 0, expense: 0 };
        map[key].expense += Number(ex.amount || 0);
      }
    });
    // Only keep months that have at least some income or expense data
    return Object.entries(map)
      .filter(([, v]) => v.income > 0 || v.expense > 0)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12)
      .map(([, v]) => v);
  }, [contributions, expenses]);

  return (
    <Card style={{ height: '300px', display: 'flex', flexDirection: 'column' }}>
      <h3 style={{ fontSize: '16px', marginBottom: '1rem' }}>Income vs Expenditure</h3>
      <div style={{ flex: 1, width: '100%', minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'var(--text-light)', fontSize: 12}} />
            <YAxis axisLine={false} tickLine={false} tick={{fill: 'var(--text-light)', fontSize: 12}} width={50} />
            <Tooltip cursor={{fill: 'var(--pale-blue)'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-sm)'}} />
            <Bar dataKey="income" name="Income" fill="var(--primary-mid)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expense" name="Expense" fill="var(--accent-blue)" radius={[4, 4, 0, 0]} opacity={0.6} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};

const ActivityFeed = ({ auditLog }) => {
  const recent = (auditLog || []).slice(0, 5);
  return (
    <Card style={{ marginTop: '1.5rem' }}>
      <h3 style={{ fontSize: '16px', marginBottom: '1rem' }}>Recent Activity</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {recent.length === 0 && <div style={{ fontSize: '14px', color: 'var(--text-mid)', textAlign: 'center', padding: '1rem 0' }}>No recent activity.</div>}
        {recent.map((log, i) => (
          <div key={log.id || i} style={{ display: 'flex', paddingBottom: '1rem', borderBottom: i !== recent.length-1 ? '1px solid var(--border-color)' : 'none' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--primary-mid)', marginTop: '6px', marginRight: '12px', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '14px', color: 'var(--text-dark)', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{log.details}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-light)', marginTop: '4px' }}>by {log.user} • {log.timestamp}</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

const QuickActions = ({ actions }) => {
  const navigate = useNavigate();
  return (
    <Card>
      <h3 style={{ fontSize: '16px', marginBottom: '1rem' }}>Quick Actions</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {actions.map((act, i) => (
          <Button key={i} variant="secondary" onClick={() => navigate(act.path)} style={{ justifyContent: 'flex-start', padding: '0 1.5rem' }}>
            <act.icon size={18} style={{ marginRight: '12px' }} />
            {act.label}
          </Button>
        ))}
      </div>
    </Card>
  );
};

export function Dashboard() {
  const { user } = useAuth();
  const { members, contributions, expenses, events, auditLog } = useData();

  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();

  // Live calculations
  const totalContributionsPaid = contributions.reduce((s, c) => s + Number(c.paid || 0), 0);
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const balance = totalContributionsPaid - totalExpenses;
  const isNegativeBalance = balance < 0;

  const thisMonthContribs = contributions.filter(c => c.month === currentMonth && c.year === currentYear);
  const thisMonthPaid = thisMonthContribs.filter(c => c.status === 'paid' || c.status === 'partial').length;
  const activeMembers = members.filter(m => m.status === 'active');
  const unpaidCount = activeMembers.length - thisMonthPaid;

  const thisMonthExpenses = expenses.filter(ex => {
    const d = ex.date || ex.expense_date || '';
    return d.startsWith(`${currentYear}-${String(currentMonth).padStart(2,'0')}`);
  });
  const thisMonthExpenseTotal = thisMonthExpenses.reduce((s,e) => s + Number(e.amount||0), 0);

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const renderDashboardContent = () => {
    switch(user?.role) {
      case 'admin':
      case 'treasurer':
      case 'super_admin':
        return (
          <>
            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
              <StatCard
                title="Welfare Balance"
                value={`GHS ${Math.abs(balance).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`}
                icon={Wallet}
                valueColor={isNegativeBalance ? 'var(--danger)' : 'var(--primary-dark)'}
                subtext={isNegativeBalance ? '⚠ Balance is negative.' : undefined}
              />
              <StatCard title="Contributions This Month" value={`GHS ${thisMonthContribs.reduce((s,c)=>s+Number(c.paid||0),0).toFixed(2)}`} subtext={`${thisMonthPaid} of ${activeMembers.length} members paid`} icon={Users} />
              <StatCard title="Expenses This Month" value={`GHS ${thisMonthExpenseTotal.toFixed(2)}`} icon={Receipt} />
              <StatCard title="Unpaid Members" value={String(unpaidCount < 0 ? 0 : unpaidCount)} subtext="This month" icon={AlertTriangle} valueColor="var(--warning)" />
            </div>
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
              <div style={{ flex: '3', minWidth: '300px' }}>
                <LiveChart contributions={contributions} expenses={expenses} />
                <ActivityFeed auditLog={auditLog} />
              </div>
              <div style={{ flex: '2', minWidth: '240px' }}>
                <QuickActions actions={[
                  { label: 'Record Contributions', icon: Wallet, path: '/contributions' },
                  { label: 'Create Event', icon: Calendar, path: '/events' },
                  { label: 'Log Expense', icon: Receipt, path: '/expenses' },
                ]} />
              </div>
            </div>
          </>
        );

      case 'chairman':
        return (
          <>
            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
              <StatCard title="Welfare Balance" value={`GHS ${Math.abs(balance).toFixed(2)}`} icon={Wallet} valueColor={isNegativeBalance ? 'var(--danger)' : 'var(--primary-dark)'} subtext={isNegativeBalance ? '⚠ Balance is negative.' : undefined} />
              <StatCard title="Total Members" value={String(members.length)} icon={Users} />
              <StatCard title="Total Events" value={String(events.length)} icon={Calendar} />
            </div>
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
              <div style={{ flex: '3', minWidth: '300px' }}>
                <LiveChart contributions={contributions} expenses={expenses} />
                <ActivityFeed auditLog={auditLog} />
              </div>
              <div style={{ flex: '2', minWidth: '240px' }}>
                <Card>
                  <h3 style={{ fontSize: '16px', marginBottom: '1rem' }}>Members Overview</h3>
                  <div style={{ fontSize: '14px', color: 'var(--text-mid)', lineHeight: '1.8' }}>
                    <div>Active Members: <strong>{activeMembers.length}</strong></div>
                    <div>Disabled: <strong>{members.filter(m => m.status !== 'active').length}</strong></div>
                  </div>
                </Card>
              </div>
            </div>
          </>
        );

      case 'secretary':
        return (
          <>
            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
              <StatCard title="Contributions This Month" value={`${thisMonthPaid} / ${activeMembers.length}`} subtext="Members paid" icon={Users} />
              <StatCard title="Total Events" value={String(events.length)} icon={Calendar} />
              <StatCard title="Unpaid Members" value={String(unpaidCount < 0 ? 0 : unpaidCount)} subtext="This month" icon={AlertTriangle} valueColor="var(--warning)" />
            </div>
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
              <div style={{ flex: '3', minWidth: '300px' }}>
                <ActivityFeed auditLog={auditLog} />
              </div>
              <div style={{ flex: '2', minWidth: '240px' }}>
                <QuickActions actions={[
                  { label: 'Record Contributions', icon: Wallet, path: '/contributions' },
                  { label: 'Create Event', icon: Calendar, path: '/events' },
                ]} />
              </div>
            </div>
          </>
        );

      case 'auditor':
        return (
          <>
            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
              <StatCard
                title="Welfare Balance"
                value={`GHS ${Math.abs(balance).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`}
                icon={Wallet}
                valueColor={isNegativeBalance ? 'var(--danger)' : 'var(--primary-dark)'}
                subtext={isNegativeBalance ? '⚠ Balance is negative.' : undefined}
              />
              <StatCard title="Contributions This Month" value={`GHS ${thisMonthContribs.reduce((s,c)=>s+Number(c.paid||0),0).toFixed(2)}`} subtext={`${thisMonthPaid} of ${activeMembers.length} members paid`} icon={Users} />
              <StatCard title="Expenses This Month" value={`GHS ${thisMonthExpenseTotal.toFixed(2)}`} icon={Receipt} />
              <StatCard title="Unpaid Members" value={String(unpaidCount < 0 ? 0 : unpaidCount)} subtext="This month" icon={AlertTriangle} valueColor="var(--warning)" />
            </div>
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
              <div style={{ flex: '3', minWidth: '300px' }}>
                <LiveChart contributions={contributions} expenses={expenses} />
                <ActivityFeed auditLog={auditLog} />
              </div>
            </div>
          </>
        );

      case 'member':
        return (
          <>
            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
              <StatCard
                title="Welfare Balance"
                value={`GHS ${Math.abs(balance).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`}
                icon={Wallet}
                valueColor={isNegativeBalance ? 'var(--danger)' : 'var(--primary-dark)'}
                subtext={isNegativeBalance ? '⚠ Balance is negative.' : undefined}
              />
              <StatCard title="Contributions This Month" value={`GHS ${thisMonthContribs.reduce((s,c)=>s+Number(c.paid||0),0).toFixed(2)}`} subtext={`${thisMonthPaid} of ${activeMembers.length} members paid`} icon={Users} />
              <StatCard title="Expenses This Month" value={`GHS ${thisMonthExpenseTotal.toFixed(2)}`} icon={Receipt} />
              <StatCard title="Unpaid Members" value={String(unpaidCount < 0 ? 0 : unpaidCount)} subtext="This month" icon={AlertTriangle} valueColor="var(--warning)" />
            </div>
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
              <div style={{ flex: '3', minWidth: '300px' }}>
                <LiveChart contributions={contributions} expenses={expenses} />
                <ActivityFeed auditLog={auditLog} />
              </div>
            </div>
          </>
        );

      default:
        return (
          <Card>
            <p style={{ color: 'var(--text-mid)' }}>Welcome! Your role is being set up. Please contact an administrator.</p>
          </Card>
        );
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '24px', color: 'var(--primary-dark)', marginBottom: '4px' }}>
          Good {today.getHours() < 12 ? 'morning' : today.getHours() < 17 ? 'afternoon' : 'evening'}, {user?.full_name?.split(' ')[0] || 'User'}.
        </h2>
        <p style={{ color: 'var(--text-mid)' }}>
          Here is your welfare summary for {monthNames[today.getMonth()]} {today.getFullYear()}.
        </p>
      </div>

      {renderDashboardContent()}
    </div>
  );
}
