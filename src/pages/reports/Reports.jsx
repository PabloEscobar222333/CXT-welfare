import React, { useState } from 'react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { contributionService } from '../../services/api';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Download, FileText, TrendingUp, Building2, Calendar, ShieldCheck } from 'lucide-react';

export function Reports() {
  const { members, contributions, events, expenses } = useData();
  const { user } = useAuth();
  const isMember = user?.role === 'member';
  const [activeTab, setActiveTab] = useState('monthly');
  const [selectedMonth, setSelectedMonth] = useState(3);
  const [selectedYear, setSelectedYear] = useState(2026);
  const [selectedEventId, setSelectedEventId] = useState('All');
  const [selectedQuarter, setSelectedQuarter] = useState('Q1');
  const [csvExporting, setCsvExporting] = useState(false);

  // Income & Expenditure statement period state
  const [selectedIEMode, setSelectedIEMode] = useState('monthly');
  const [selectedIEMonth, setSelectedIEMonth] = useState(3);
  const [selectedIEYear, setSelectedIEYear] = useState(2026);
  const [selectedIEQuarter, setSelectedIEQuarter] = useState('Q1');

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const yearOptions = [];
  for (let y = 2026; y <= 2050; y++) yearOptions.push(y);

  const handleExport = (type) => {
    alert(`Exporting ${type} report... (Mock Action)`);
  };

  // ── Event Expenses: real PDF export (browser print) ──────────────
  const exportEventExpensesPDF = () => {
    const filteredExpenses = selectedEventId === 'All'
      ? expenses
      : expenses.filter(e => e.eventId === selectedEventId);

    const selectedEvent = events.find(e => e.id === selectedEventId);
    const eventTitle = selectedEventId === 'All' ? 'All Events' : (selectedEvent?.name || 'Selected Event');
    const totalSpend = filteredExpenses.reduce((s, e) => s + Number(e.amount), 0);

    const rows = filteredExpenses.map(ex => {
      const evName = events.find(e => e.id === (ex.eventId || ex.event_id))?.name || '-';
      const safeDesc = (ex.description || '-').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const safeVendor = (ex.vendor || '-').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `
        <tr>
          <td>${ex.date || ex.expense_date || '-'}</td>
          <td>${evName}</td>
          <td>${safeDesc}</td>
          <td>${safeVendor}</td>
          <td style="text-align:right;font-weight:600">GHS ${Number(ex.amount).toFixed(2)}</td>
        </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Event Expense Report – ${eventTitle}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 32px; color: #1e293b; }
    h1  { font-size: 22px; color: #1e3a5f; margin-bottom: 4px; }
    h2  { font-size: 16px; color: #64748b; font-weight: normal; margin-top: 0; }
    .summary { display:inline-block; margin:20px 0; padding:12px 24px; background:#f0f4ff; border-radius:8px; }
    .summary .label { font-size:11px; text-transform:uppercase; color:#64748b; }
    .summary .value { font-size:22px; font-weight:700; color:#1e3a5f; margin-top:4px; }
    table { width:100%; border-collapse:collapse; margin-top:16px; font-size:14px; }
    th { text-align:left; padding:10px 8px; border-bottom:2px solid #cbd5e1; color:#64748b; font-size:12px; text-transform:uppercase; }
    td { padding:10px 8px; border-bottom:1px solid #e2e8f0; vertical-align:top; }
    tfoot td { font-weight:700; border-top:2px solid #cbd5e1; padding-top:12px; }
    .footer { margin-top:40px; font-size:12px; color:#94a3b8; text-align:right; }
    @media print { body { margin:16px; } }
  </style>
</head>
<body>
  <h1>CXT WELFARE FUND</h1>
  <h2>Event Expense Report – ${eventTitle}</h2>
  <div class="summary">
    <div class="label">Total Spend</div>
    <div class="value">GHS ${totalSpend.toFixed(2)}</div>
  </div>
  <table>
    <thead><tr><th>Date</th><th>Event</th><th>Description</th><th>Vendor</th><th style="text-align:right">Amount (GHS)</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td colspan="4">TOTAL</td><td style="text-align:right">GHS ${totalSpend.toFixed(2)}</td></tr></tfoot>
  </table>
  <div class="footer">Generated on ${new Date().toLocaleDateString()} | CXT Welfare Management System</div>
</body>
</html>`;

    const printWindow = window.open('', '_blank', 'width=960,height=700');
    if (!printWindow) {
      alert('Please allow pop-ups for this site to export the PDF.');
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.onload = () => { printWindow.print(); };
  };

  // ── Monthly Contributions: CSV export – fetches fresh from Supabase ─
  const exportMonthlyCSV = async () => {
    if (csvExporting) return;
    setCsvExporting(true);
    try {
      // Fetch directly from the DB so we always get the live data
      // getContributionsByMonthYear joins the users table: row.users.full_name
      const { data: rows, error } = await contributionService.getContributionsByMonthYear(
        selectedMonth,
        selectedYear
      );

      if (error) {
        alert('Failed to fetch data: ' + error.message);
        return;
      }

      const monthData = rows || [];
      const header = ['Member Name', 'Expected (GHS)', 'Paid (GHS)', 'Date Paid', 'Status'];

      const csvRows = monthData.map(c => {
        // Name comes from the joined users table, or fall back to the context members list
        const joinedName = c.users?.full_name;
        const contextMember = members.find(m => m.id === (c.member_id || c.memberId));
        const rawName = joinedName || contextMember?.name || 'Unknown';
        const safeName = rawName.replace(/"/g, '""');
        const expected = Number(c.expected_amount ?? c.expected ?? 0);
        const paid     = Number(c.paid_amount    ?? c.paid    ?? 0);
        const datePaid = c.payment_date || c.date || '-';
        const status   = c.status || '';
        return [`"${safeName}"`, expected.toFixed(2), paid.toFixed(2), datePaid, status].join(',');
      });

      const totalExpected  = monthData.reduce((s, c) => s + Number(c.expected_amount ?? c.expected ?? 0), 0);
      const totalCollected = monthData.reduce((s, c) => s + Number(c.paid_amount    ?? c.paid    ?? 0), 0);
      csvRows.push('');
      csvRows.push(`"TOTAL",${totalExpected.toFixed(2)},${totalCollected.toFixed(2)},"",""`);

      // UTF-8 BOM ensures Excel / Numbers open the file correctly
      const BOM = '\uFEFF';
      const csvContent = BOM + [header.join(','), ...csvRows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url  = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href  = url;
      link.setAttribute('download', `Monthly_Contributions_${monthNames[selectedMonth - 1]}_${selectedYear}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Export failed: ' + err.message);
    } finally {
      setCsvExporting(false);
    }
  };

  // ── Monthly Contributions: real PDF export (browser print) ───────
  const exportMonthlyPDF = () => {
    const monthData = contributions.filter(
      c => Number(c.month) === selectedMonth && Number(c.year) === selectedYear
    );
    const totalExpected = monthData.reduce((s, c) => s + Number(c.expected), 0);
    const totalCollected = monthData.reduce((s, c) => s + Number(c.paid), 0);
    const outstanding = totalExpected - totalCollected;
    const compliance = totalExpected ? ((totalCollected / totalExpected) * 100).toFixed(1) : '0.0';

    const rows = monthData.map(c => {
      const mName = members.find(m => m.id === c.memberId)?.name || 'Unknown';
      const statusColor = c.status === 'paid' ? '#16a34a' : c.status === 'partial' ? '#d97706' : '#dc2626';
      return `
        <tr>
          <td>${mName}</td>
          <td>${Number(c.expected).toFixed(2)}</td>
          <td>${Number(c.paid).toFixed(2)}</td>
          <td>${c.date || '-'}</td>
          <td><span style="color:${statusColor};font-weight:600;text-transform:uppercase;font-size:12px">${c.status}</span></td>
        </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Monthly Contributions – ${monthNames[selectedMonth - 1]} ${selectedYear}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 32px; color: #1e293b; }
    h1 { font-size: 22px; color: #1e3a5f; margin-bottom: 4px; }
    h2 { font-size: 16px; color: #64748b; font-weight: normal; margin-top: 0; }
    .summary { display: flex; gap: 24px; margin: 24px 0; }
    .summary-box { flex: 1; padding: 12px 16px; background: #f0f4ff; border-radius: 8px; }
    .summary-box .label { font-size: 11px; text-transform: uppercase; color: #64748b; }
    .summary-box .value { font-size: 20px; font-weight: 700; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 24px; font-size: 14px; }
    th { text-align: left; padding: 10px 8px; border-bottom: 2px solid #cbd5e1; color: #64748b; font-size: 12px; text-transform: uppercase; }
    td { padding: 10px 8px; border-bottom: 1px solid #e2e8f0; }
    tfoot td { font-weight: 700; border-top: 2px solid #cbd5e1; padding-top: 12px; }
    .footer { margin-top: 40px; font-size: 12px; color: #94a3b8; text-align: right; }
    @media print { body { margin: 16px; } }
  </style>
</head>
<body>
  <h1>CXT WELFARE FUND</h1>
  <h2>Monthly Contribution Report – ${monthNames[selectedMonth - 1]} ${selectedYear}</h2>
  <div class="summary">
    <div class="summary-box"><div class="label">Total Expected</div><div class="value">GHS ${totalExpected.toFixed(2)}</div></div>
    <div class="summary-box"><div class="label">Total Collected</div><div class="value" style="color:#16a34a">GHS ${totalCollected.toFixed(2)}</div></div>
    <div class="summary-box"><div class="label">Outstanding</div><div class="value" style="color:#dc2626">GHS ${outstanding.toFixed(2)}</div></div>
    <div class="summary-box"><div class="label">Compliance Rate</div><div class="value">${compliance}%</div></div>
  </div>
  <table>
    <thead><tr><th>Member Name</th><th>Expected (GHS)</th><th>Paid (GHS)</th><th>Date Paid</th><th>Status</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td>TOTAL</td><td>${totalExpected.toFixed(2)}</td><td>${totalCollected.toFixed(2)}</td><td></td><td></td></tr></tfoot>
  </table>
  <div class="footer">Generated on ${new Date().toLocaleDateString()} | CXT Welfare Management System</div>
</body>
</html>`;

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      alert('Please allow pop-ups for this site to export PDF.');
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.onload = () => {
      printWindow.print();
    };
  };

  const renderTabs = () => {
    const tabs = [
      { id: 'monthly', label: 'Monthly Contributions', icon: Calendar },
      { id: 'event', label: 'Event Expenses', icon: FileText },
      { id: 'income_exp', label: 'Income vs Expenditure', icon: TrendingUp },
    ];

    return (
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', overflowX: 'auto', paddingBottom: '8px' }}>
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color)',
                backgroundColor: activeTab === tab.id ? 'var(--primary-dark)' : 'var(--white)',
                color: activeTab === tab.id ? 'var(--white)' : 'var(--text-dark)',
                cursor: 'pointer', fontWeight: '500', fontSize: '14px', whiteSpace: 'nowrap', transition: 'background-color 0.2s, color 0.2s, border-color 0.2s'
              }}
            >
              <Icon size={16} /> {tab.label}
            </button>
          )
        })}
      </div>
    );
  };

  const renderReport1 = () => {
    // Monthly Contribution Report
    const monthData = contributions.filter(c => c.month === selectedMonth && c.year === selectedYear);
    const totalExpected = monthData.reduce((s,c) => s + Number(c.expected), 0);
    const totalCollected = monthData.reduce((s,c) => s + Number(c.paid), 0);
    const compliance = totalExpected ? ((totalCollected / totalExpected) * 100).toFixed(1) : 0;

    return (
      <Card style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ fontSize: '18px', color: 'var(--primary-dark)', margin: '0 0 16px 0' }}>Monthly Contribution Report</h3>
            <div style={{ display: 'flex', gap: '12px' }}>
              <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} style={{ height: '36px', borderRadius: '6px', border: '1px solid var(--border-color)', padding: '0 12px' }}>
                {monthNames.map((m,i) => <option key={i} value={i+1}>{m}</option>)}
              </select>
              <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} style={{ height: '36px', borderRadius: '6px', border: '1px solid var(--border-color)', padding: '0 12px' }}>
                {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <Button variant="secondary" style={{ height: '36px' }}>Generate</Button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="secondary" onClick={exportMonthlyPDF} disabled={isMember}><Download size={16} style={{ marginRight: '6px' }} /> PDF</Button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)', gap: '16px', marginBottom: '24px' }}>
          <div style={{ padding: '16px', backgroundColor: 'var(--pale-blue)', borderRadius: '8px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-mid)', textTransform: 'uppercase' }}>Total Expected</div>
            <div style={{ fontSize: '20px', fontWeight: '700' }}>GHS {totalExpected.toFixed(2)}</div>
          </div>
          <div style={{ padding: '16px', backgroundColor: 'var(--pale-blue)', borderRadius: '8px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-mid)', textTransform: 'uppercase' }}>Total Collected</div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--success)' }}>GHS {totalCollected.toFixed(2)}</div>
          </div>
          <div style={{ padding: '16px', backgroundColor: 'var(--pale-blue)', borderRadius: '8px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-mid)', textTransform: 'uppercase' }}>Outstanding</div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--danger)' }}>GHS {(totalExpected - totalCollected).toFixed(2)}</div>
          </div>
          <div style={{ padding: '16px', backgroundColor: 'var(--pale-blue)', borderRadius: '8px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-mid)', textTransform: 'uppercase' }}>Compliance Rate</div>
            <div style={{ fontSize: '20px', fontWeight: '700' }}>{compliance}%</div>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-mid)' }}>
              <th style={{ padding: '12px 0' }}>Member Name</th>
              <th style={{ padding: '12px 0' }}>Expected</th>
              <th style={{ padding: '12px 0' }}>Paid</th>
              <th style={{ padding: '12px 0' }}>Date Paid</th>
              <th style={{ padding: '12px 0' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {monthData.map((c, i) => {
              const mName = members.find(m => m.id === c.memberId)?.name || 'Unknown';
              return (
                <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px 0', fontWeight: '500' }}>{mName}</td>
                  <td style={{ padding: '12px 0' }}>{Number(c.expected).toFixed(2)}</td>
                  <td style={{ padding: '12px 0' }}>{Number(c.paid).toFixed(2)}</td>
                  <td style={{ padding: '12px 0', color: 'var(--text-mid)' }}>{c.date || '-'}</td>
                  <td style={{ padding: '12px 0' }}>
                    <Badge variant={c.status === 'paid' ? 'success' : c.status === 'partial' ? 'warning' : 'danger'}>{c.status}</Badge>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>
    );
  };

  const renderReport2 = () => {
    // Event Expense
    const filteredExpenses = selectedEventId === 'All' ? expenses : expenses.filter(e => e.eventId === selectedEventId);
    const totalSpend = filteredExpenses.reduce((s,e) => s + Number(e.amount), 0);
    
    return (
      <Card style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <h3 style={{ fontSize: '18px', color: 'var(--primary-dark)', margin: '0 0 16px 0' }}>Event Expense Report</h3>
            <div style={{ display: 'flex', gap: '12px' }}>
              <select value={selectedEventId} onChange={e => setSelectedEventId(e.target.value)} style={{ height: '36px', borderRadius: '6px', border: '1px solid var(--border-color)', padding: '0 12px' }}>
                <option value="All">All Events</option>
                {events.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              <Button variant="secondary" style={{ height: '36px' }}>Generate</Button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="secondary" onClick={exportEventExpensesPDF} disabled={isMember}><Download size={16} style={{ marginRight: '6px' }} /> Export PDF</Button>
          </div>
        </div>

        <div style={{ padding: '16px', backgroundColor: 'var(--pale-blue)', borderRadius: '8px', marginBottom: '24px' }}>
          <div style={{ fontSize: '14px', color: 'var(--text-mid)' }}>Total Selected Event Spend</div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--primary-dark)' }}>GHS {totalSpend.toFixed(2)}</div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-mid)' }}>
              <th style={{ padding: '12px 0' }}>Date</th>
              <th style={{ padding: '12px 0' }}>Event</th>
              <th style={{ padding: '12px 0' }}>Description</th>
              <th style={{ padding: '12px 0' }}>Vendor</th>
              <th style={{ padding: '12px 0' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {filteredExpenses.map((ex, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '12px 0', color: 'var(--text-mid)' }}>{ex.date}</td>
                <td style={{ padding: '12px 0', fontWeight: '500' }}>{events.find(e => e.id === ex.eventId)?.name}</td>
                <td style={{ padding: '12px 0' }}>{ex.description}</td>
                <td style={{ padding: '12px 0', color: 'var(--text-mid)' }}>{ex.vendor}</td>
                <td style={{ padding: '12px 0', fontWeight: '600' }}>{Number(ex.amount).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    );
  };

  // ── Income vs Expenditure: real PDF export (browser print) ───────────
  const exportIEStatementPDF = ({
    periodLabel, openingBalance, periodIncome, periodExpTotal,
    closingBalance, expByEvent
  }) => {
    const isNeg = closingBalance < 0;

    // Build expenditure rows: event header + indented line items
    const expRows = Object.entries(expByEvent).map(([evName, { total, items }]) => {
      const safeEv = evName.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const lineRows = items.map(ex => {
        const safeDesc   = (ex.description || '-').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const safeVendor = (ex.vendor || '-').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `<tr class="line-item">
          <td style="padding-left:24px;color:#475569">${ex.date || ex.expense_date || '-'} &mdash; ${safeDesc}${safeVendor !== '-' ? ' (' + safeVendor + ')' : ''}</td>
          <td style="text-align:right;color:#475569">GHS ${Number(ex.amount).toFixed(2)}</td>
        </tr>`;
      }).join('');
      return `
        <tr class="event-row">
          <td><strong>${safeEv}</strong></td>
          <td style="text-align:right"><strong>GHS ${total.toFixed(2)}</strong></td>
        </tr>
        ${lineRows}`;
    }).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Income & Expenditure Statement – ${periodLabel}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 32px; color: #1e293b; font-size:14px; }
    h1   { font-size:22px; color:#1e3a5f; margin-bottom:4px; }
    h2   { font-size:16px; color:#64748b; font-weight:normal; margin-top:0; }
    p    { margin:4px 0 0 0; font-size:13px; color:#94a3b8; }
    .divider { border:none; border-top:2px solid #cbd5e1; margin:24px 0; }
    .bal-box { background:#f0f4ff; padding:12px 16px; border-radius:6px; display:flex; justify-content:space-between; margin-bottom:24px; }
    .section-title { font-size:15px; font-weight:700; color:#1e3a5f; border-bottom:2px solid #cbd5e1; padding-bottom:8px; margin:0 0 8px 0; }
    table { width:100%; border-collapse:collapse; }
    tr.event-row td { padding:10px 4px 4px 4px; }
    tr.line-item td { padding:4px 4px 4px 4px; font-size:13px; border-bottom:1px dashed #e2e8f0; }
    .total-row td { padding:12px 4px; font-weight:700; border-top:2px solid #cbd5e1; }
    .closing { display:flex; justify-content:space-between; padding:16px; border-radius:8px; font-weight:700; font-size:16px; margin-top:24px;
               background:${isNeg ? '#FEF2F2' : '#eff6ff'}; border:1px solid ${isNeg ? '#FCA5A5' : '#93c5fd'}; }
    .footer { margin-top:40px; font-size:12px; color:#94a3b8; text-align:right; }
    @media print { body { margin:16px; } }
  </style>
</head>
<body>
  <h1>CXT WELFARE FUND</h1>
  <h2>Income and Expenditure Statement</h2>
  <p>For the period: ${periodLabel}</p>
  <hr class="divider" />

  <div class="bal-box">
    <span>Opening Balance</span>
    <span style="color:${openingBalance < 0 ? '#dc2626' : '#1e3a5f'}">
      GHS ${Math.abs(openingBalance).toFixed(2)}${openingBalance < 0 ? ' (Deficit)' : ''}
    </span>
  </div>

  <p class="section-title">Add: Income</p>
  <table>
    <tr><td>Member Contributions</td><td style="text-align:right">GHS ${periodIncome.toFixed(2)}</td></tr>
    <tr class="total-row"><td>Total Income</td><td style="text-align:right;color:#16a34a">GHS ${periodIncome.toFixed(2)}</td></tr>
  </table>

  <br/>
  <p class="section-title">Less: Expenditure</p>
  <table>
    ${expRows || '<tr><td colspan="2" style="font-style:italic;color:#94a3b8;padding:8px 0">No expenses recorded for this period.</td></tr>'}
    <tr class="total-row"><td>Total Expenditure</td><td style="text-align:right;color:#dc2626">GHS ${periodExpTotal.toFixed(2)}</td></tr>
  </table>

  <div class="closing">
    <span style="color:${isNeg ? '#dc2626' : '#1e3a5f'}">Closing Balance</span>
    <span style="color:${isNeg ? '#dc2626' : '#16a34a'}">${isNeg ? '&#9888; ' : ''}GHS ${Math.abs(closingBalance).toFixed(2)}${isNeg ? ' (Deficit)' : ''}</span>
  </div>

  <div class="footer">Generated on ${new Date().toLocaleDateString()} | CXT Welfare Management System</div>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=960,height=700');
    if (!win) { alert('Please allow pop-ups for this site to export the PDF.'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    win.onload = () => { win.print(); };
  };

  const renderReport3 = () => {
    // ─── Period helpers ───────────────────────────────────────────────
    const ieMode    = selectedIEMode;   // 'monthly' | 'quarterly' | 'yearly'
    const ieMonth   = selectedIEMonth;
    const ieYear    = selectedIEYear;
    const ieQuarter = selectedIEQuarter;

    // Returns true if an expense date string falls in a given year+month (1-based)
    const expInMonth = (ex, yr, mo) => {
      const d = ex.date || ex.expense_date || '';
      const m = String(mo).padStart(2,'0');
      return d.startsWith(`${yr}-${m}`);
    };
    // Returns true if a contribution row matches a given year+month
    const contribInMonth = (c, yr, mo) => {
      return Number(c.year) === yr && Number(c.month) === mo;
    };

    // Quarter → month ranges
    const quarterRange = { Q1:[1,3], Q2:[4,6], Q3:[7,9], Q4:[10,12] };

    // ─── Compute period income & expenditure ─────────────────────────
    let periodIncome = 0;
    let periodExpenses = []; // raw expense rows for the period

    if (ieMode === 'monthly') {
      periodIncome = contributions
        .filter(c => contribInMonth(c, ieYear, ieMonth) && (c.status === 'paid' || c.status === 'partial'))
        .reduce((s,c) => s + Number(c.paid), 0);
      periodExpenses = expenses.filter(ex => expInMonth(ex, ieYear, ieMonth));

    } else if (ieMode === 'quarterly') {
      const [qStart, qEnd] = quarterRange[ieQuarter] || [1,3];
      periodIncome = contributions
        .filter(c => Number(c.year) === ieYear && Number(c.month) >= qStart && Number(c.month) <= qEnd && (c.status === 'paid' || c.status === 'partial'))
        .reduce((s,c) => s + Number(c.paid), 0);
      periodExpenses = expenses.filter(ex => {
        const d = ex.date || ex.expense_date || '';
        const parts = d.split('-');
        if (parts.length < 2) return false;
        const yr = Number(parts[0]); const mo = Number(parts[1]);
        return yr === ieYear && mo >= qStart && mo <= qEnd;
      });

    } else { // yearly
      periodIncome = contributions
        .filter(c => Number(c.year) === ieYear && (c.status === 'paid' || c.status === 'partial'))
        .reduce((s,c) => s + Number(c.paid), 0);
      periodExpenses = expenses.filter(ex => {
        const d = ex.date || ex.expense_date || '';
        return d.startsWith(`${ieYear}-`);
      });
    }

    const periodExpTotal = periodExpenses.reduce((s,e) => s + Number(e.amount), 0);

    // ─── Opening Balance (all activity strictly before the period) ────
    let openingBalance = 0;
    if (ieMode === 'monthly') {
      const priorIncome = contributions
        .filter(c => {
          const yr = Number(c.year); const mo = Number(c.month);
          return (yr < ieYear) || (yr === ieYear && mo < ieMonth);
        })
        .reduce((s,c) => s + Number(c.paid), 0);
      const priorExp = expenses
        .filter(ex => {
          const d = ex.date || ex.expense_date || '';
          const parts = d.split('-');
          if (parts.length < 2) return false;
          const yr = Number(parts[0]); const mo = Number(parts[1]);
          return (yr < ieYear) || (yr === ieYear && mo < ieMonth);
        })
        .reduce((s,e) => s + Number(e.amount), 0);
      openingBalance = priorIncome - priorExp;

    } else if (ieMode === 'quarterly') {
      const [qStart] = quarterRange[ieQuarter] || [1,3];
      const priorIncome = contributions
        .filter(c => {
          const yr = Number(c.year); const mo = Number(c.month);
          return (yr < ieYear) || (yr === ieYear && mo < qStart);
        })
        .reduce((s,c) => s + Number(c.paid), 0);
      const priorExp = expenses
        .filter(ex => {
          const d = ex.date || ex.expense_date || '';
          const parts = d.split('-');
          if (parts.length < 2) return false;
          const yr = Number(parts[0]); const mo = Number(parts[1]);
          return (yr < ieYear) || (yr === ieYear && mo < qStart);
        })
        .reduce((s,e) => s + Number(e.amount), 0);
      openingBalance = priorIncome - priorExp;

    } else {
      // Yearly: opening = everything before this year
      const priorIncome = contributions.filter(c => Number(c.year) < ieYear).reduce((s,c) => s + Number(c.paid), 0);
      const priorExp = expenses.filter(ex => (ex.date || ex.expense_date || '').startsWith(`${ieYear - 1}`) || Number((ex.date || ex.expense_date || '').split('-')[0]) < ieYear).reduce((s,e) => s + Number(e.amount), 0);
      openingBalance = priorIncome - priorExp;
    }

    const closingBalance = openingBalance + periodIncome - periodExpTotal;
    const isNegative = closingBalance < 0;

    // ── Group expenses by event: store total + individual items ──────
    const expByEvent = {};
    periodExpenses.forEach(ex => {
      const evName = events.find(e => e.id === (ex.eventId || ex.event_id))?.name || 'General';
      if (!expByEvent[evName]) expByEvent[evName] = { total: 0, items: [] };
      expByEvent[evName].total += Number(ex.amount);
      expByEvent[evName].items.push(ex);
    });

    // ─── Period label ─────────────────────────────────────────────────
    // monthNames is available from the outer scope
    let periodLabel = '';
    if (ieMode === 'monthly') periodLabel = `${monthNames[ieMonth-1]} ${ieYear}`;
    else if (ieMode === 'quarterly') periodLabel = `${ieQuarter} ${ieYear} (${monthNames[quarterRange[ieQuarter][0]-1]} – ${monthNames[quarterRange[ieQuarter][1]-1]})`;
    else periodLabel = `Year ${ieYear}`;

    const hasActivity = periodIncome > 0 || periodExpenses.length > 0;

    return (
      <Card style={{ padding: '24px', maxWidth: '860px', margin: '0 auto' }}>
        {/* ─── Controls ─────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '24px', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-mid)', textTransform: 'uppercase' }}>Period Type</label>
            <select value={ieMode} onChange={e => setSelectedIEMode(e.target.value)} style={{ height: '36px', borderRadius: '6px', border: '1px solid var(--border-color)', padding: '0 12px', outline: 'none', minWidth: '120px' }}>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>

          {ieMode === 'monthly' && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-mid)', textTransform: 'uppercase' }}>Month</label>
                <select value={ieMonth} onChange={e => setSelectedIEMonth(Number(e.target.value))} style={{ height: '36px', borderRadius: '6px', border: '1px solid var(--border-color)', padding: '0 12px', outline: 'none' }}>
                  {monthNames.map((m,i) => <option key={i} value={i+1}>{m}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-mid)', textTransform: 'uppercase' }}>Year</label>
                <select value={ieYear} onChange={e => setSelectedIEYear(Number(e.target.value))} style={{ height: '36px', borderRadius: '6px', border: '1px solid var(--border-color)', padding: '0 12px', outline: 'none' }}>
                  {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </>
          )}

          {ieMode === 'quarterly' && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-mid)', textTransform: 'uppercase' }}>Quarter</label>
                <select value={ieQuarter} onChange={e => setSelectedIEQuarter(e.target.value)} style={{ height: '36px', borderRadius: '6px', border: '1px solid var(--border-color)', padding: '0 12px', outline: 'none' }}>
                  <option value="Q1">Q1 (Jan–Mar)</option>
                  <option value="Q2">Q2 (Apr–Jun)</option>
                  <option value="Q3">Q3 (Jul–Sep)</option>
                  <option value="Q4">Q4 (Oct–Dec)</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-mid)', textTransform: 'uppercase' }}>Year</label>
                <select value={ieYear} onChange={e => setSelectedIEYear(Number(e.target.value))} style={{ height: '36px', borderRadius: '6px', border: '1px solid var(--border-color)', padding: '0 12px', outline: 'none' }}>
                  {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </>
          )}

          {ieMode === 'yearly' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-mid)', textTransform: 'uppercase' }}>Year</label>
              <select value={ieYear} onChange={e => setSelectedIEYear(Number(e.target.value))} style={{ height: '36px', borderRadius: '6px', border: '1px solid var(--border-color)', padding: '0 12px', outline: 'none' }}>
                {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
            <Button variant="secondary" onClick={() => exportIEStatementPDF({ periodLabel, openingBalance, periodIncome, periodExpTotal, closingBalance, expByEvent })} disabled={isMember}><Download size={16} style={{ marginRight: '6px' }} /> PDF</Button>
          </div>
        </div>

        {/* ─── Statement Header ────────────────────────────────────── */}
        <div style={{ textAlign: 'center', marginBottom: '32px', borderBottom: '2px solid var(--border-color)', paddingBottom: '24px' }}>
          <h2 style={{ margin: '0 0 6px 0', color: 'var(--primary-dark)' }}>CXT WELFARE FUND</h2>
          <h3 style={{ margin: 0, color: 'var(--text-mid)', fontWeight: '500' }}>Income and Expenditure Statement</h3>
          <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: 'var(--text-light)' }}>For the period: {periodLabel}</p>
        </div>

        {/* ─── Empty State ─────────────────────────────────────────── */}
        {!hasActivity ? (
          <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-mid)', backgroundColor: 'var(--pale-blue)', borderRadius: '8px' }}>
            <FileText size={40} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
            <p style={{ fontSize: '15px', fontWeight: '500' }}>No financial activity recorded for this period.</p>
            <p style={{ fontSize: '13px', marginTop: '6px', color: 'var(--text-light)' }}>Try selecting a different month, quarter, or year.</p>
          </div>
        ) : (
          <>
            {/* Opening Balance */}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', backgroundColor: 'var(--pale-blue)', borderRadius: '6px', marginBottom: '24px' }}>
              <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-dark)' }}>Opening Balance</span>
              <span style={{ fontSize: '14px', fontWeight: '700', color: openingBalance < 0 ? 'var(--danger)' : 'var(--primary-dark)' }}>
                GHS {Math.abs(openingBalance).toFixed(2)}{openingBalance < 0 ? ' (Deficit)' : ''}
              </span>
            </div>

            {/* Income */}
            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ borderBottom: '2px solid var(--border-color)', paddingBottom: '8px', color: 'var(--primary-dark)', marginBottom: '8px' }}>Add: Income</h4>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px dashed var(--border-color)' }}>
                <span style={{ fontSize: '14px' }}>Member Contributions</span>
                <span style={{ fontWeight: '500', fontSize: '14px' }}>GHS {periodIncome.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', fontWeight: '700' }}>
                <span>Total Income</span>
                <span style={{ color: 'var(--success)' }}>GHS {periodIncome.toFixed(2)}</span>
              </div>
            </div>

            {/* Expenditure */}
            <div style={{ marginBottom: '32px' }}>
              <h4 style={{ borderBottom: '2px solid var(--border-color)', paddingBottom: '8px', color: 'var(--primary-dark)', marginBottom: '8px' }}>Less: Expenditure</h4>
              {Object.entries(expByEvent).map(([evName, { total, items }], i) => (
                <div key={i} style={{ marginBottom: '8px' }}>
                  {/* Event header row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 4px 0', borderBottom: '1px solid var(--border-color)', fontSize: '14px', fontWeight: '600' }}>
                    <span>{evName}</span>
                    <span>GHS {total.toFixed(2)}</span>
                  </div>
                  {/* Individual line items */}
                  {items.map((ex, j) => (
                    <div key={j} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0 5px 20px', borderBottom: '1px dashed var(--border-color)', fontSize: '13px', color: 'var(--text-mid)' }}>
                      <span>
                        {ex.date || ex.expense_date || '-'} &mdash; {ex.description || '-'}
                        {ex.vendor ? <span style={{ color: 'var(--text-light)', marginLeft: '6px' }}>({ex.vendor})</span> : null}
                      </span>
                      <span>GHS {Number(ex.amount).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              ))}
              {Object.keys(expByEvent).length === 0 && (
                <div style={{ padding: '12px 0', fontSize: '14px', color: 'var(--text-mid)', fontStyle: 'italic' }}>No expenses recorded for this period.</div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', fontWeight: '700' }}>
                <span>Total Expenditure</span>
                <span style={{ color: 'var(--danger)' }}>GHS {periodExpTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Closing Balance */}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '18px', backgroundColor: isNegative ? '#FEF2F2' : 'var(--light-blue)', borderRadius: '8px', fontWeight: '700', fontSize: '18px', border: isNegative ? '1px solid #FCA5A5' : '1px solid var(--accent-blue)' }}>
              <span style={{ color: isNegative ? 'var(--danger)' : 'var(--primary-dark)' }}>Closing Balance</span>
              <span style={{ color: isNegative ? 'var(--danger)' : 'var(--success)' }}>
                {isNegative ? '⚠ ' : ''}GHS {Math.abs(closingBalance).toFixed(2)}{isNegative ? ' (Deficit)' : ''}
              </span>
            </div>
          </>
        )}

        <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'flex-end' }}>
          <Button onClick={() => exportIEStatementPDF({ periodLabel, openingBalance, periodIncome, periodExpTotal, closingBalance, expByEvent })} disabled={isMember}><Download size={16} style={{ marginRight: '8px' }} /> Download Statement</Button>
        </div>
      </Card>
    );
  };



  const renderReport5 = () => {
    // Audit Support
    return (
      <Card style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <h3 style={{ fontSize: '18px', color: 'var(--primary-dark)', margin: '0 0 16px 0' }}>Audit Support Report</h3>
            <p style={{ fontSize: '14px', color: 'var(--text-mid)', margin: 0 }}>Line-by-line financial history combining contributions and expenses for external or internal auditing.</p>
          </div>
          <Button variant="secondary" onClick={() => handleExport('CSV')}><Download size={16} style={{ marginRight: '8px' }} /> Export CSV</Button>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-mid)' }}>
              <th style={{ padding: '12px 0' }}>Date</th>
              <th style={{ padding: '12px 0' }}>Type</th>
              <th style={{ padding: '12px 0' }}>Reference</th>
              <th style={{ padding: '12px 0' }}>Amount (GHS)</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              <td style={{ padding: '12px 0' }}>2026-03-15</td>
              <td style={{ padding: '12px 0' }}><Badge variant="success">INCOME</Badge></td>
              <td style={{ padding: '12px 0' }}>Contribution: Kwame Mensah (Mar 2026)</td>
              <td style={{ padding: '12px 0', fontWeight: '500' }}>50.00</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              <td style={{ padding: '12px 0' }}>2025-12-10</td>
              <td style={{ padding: '12px 0' }}><Badge variant="danger">EXPENSE</Badge></td>
              <td style={{ padding: '12px 0' }}>End of Year Party: Jollof King (Food Drinks)</td>
              <td style={{ padding: '12px 0', fontWeight: '500' }}>1500.00</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              <td style={{ padding: '12px 0' }}>2025-12-05</td>
              <td style={{ padding: '12px 0' }}><Badge variant="danger">EXPENSE</Badge></td>
              <td style={{ padding: '12px 0' }}>End of Year Party: Grand Hall (Venue)</td>
              <td style={{ padding: '12px 0', fontWeight: '500' }}>800.00</td>
            </tr>
          </tbody>
        </table>
      </Card>
    );
  };

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '24px', color: 'var(--primary-dark)', marginBottom: '4px' }}>Generated Reports</h2>
        <p style={{ color: 'var(--text-mid)' }}>View, configure, and export official welfare reports.</p>
      </div>

      {renderTabs()}

      <div style={{ marginTop: '24px' }}>
        {activeTab === 'monthly' && renderReport1()}
        {activeTab === 'event' && renderReport2()}
        {activeTab === 'income_exp' && renderReport3()}

        {activeTab === 'audit' && renderReport5()}
      </div>
    </div>
  );
}
