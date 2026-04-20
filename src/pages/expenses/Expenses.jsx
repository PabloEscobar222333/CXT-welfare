import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { expenseService } from '../../services/api';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Paperclip, AlertTriangle, Plus, Eye, X, Upload, CheckCircle, Edit2 } from 'lucide-react';

// ─── Modal ────────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children, footer }) {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
      <div style={{ backgroundColor: 'var(--white)', borderRadius: '16px', width: '100%', maxWidth: '500px', overflow: 'hidden', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '18px', margin: 0 }}>{title}</h2>
          <button
            onClick={onClose}
            disabled={!onClose}
            style={{
              background: 'none', border: 'none',
              cursor: onClose ? 'pointer' : 'not-allowed',
              color: 'var(--text-mid)',
              opacity: onClose ? 1 : 0.3,
            }}
          ><X size={20} /></button>
        </div>
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>{children}</div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--pale-blue)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          {footer}
        </div>
      </div>
    </div>
  );
}

// ─── Slide-in Panel ───────────────────────────────────────────────────────────
function SlideInPanel({ title, onClose, children }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <>
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 40 }} onClick={onClose} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '420px', backgroundColor: 'var(--white)', zIndex: 50, boxShadow: '-4px 0 20px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column', animation: 'slideIn 0.2s ease' }}>
        <style>{`@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border-color)' }}>
          <h2 style={{ fontSize: '18px', margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-mid)' }}><X size={20} /></button>
        </div>
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>{children}</div>
      </div>
    </>
  );
}

// ─── Field error ──────────────────────────────────────────────────────────────
function FieldError({ msg }) {
  if (!msg) return null;
  return <div style={{ color: 'var(--danger)', fontSize: '12px', marginTop: '4px' }}>{msg}</div>;
}

const SEL_STYLE = {
  height: '40px', borderRadius: '8px', border: '1px solid var(--border-color)',
  padding: '0 12px', outline: 'none', backgroundColor: 'var(--pale-blue)', width: '100%',
};

const CATEGORIES = [
  { value: 'food_drinks',       label: 'Food & Drinks' },
  { value: 'cake',              label: 'Cake' },
  { value: 'decoration',        label: 'Decoration' },
  { value: 'venue',             label: 'Venue' },
  { value: 'logistics',         label: 'Logistics' },
  { value: 'emergency_support', label: 'Emergency Support' },
  { value: 'other',             label: 'Other' },
];

function catLabel(v) {
  return CATEGORIES.find(c => c.value === v)?.label || (v || '').replace(/_/g, ' ');
}

function fmtGHS(n) {
  return 'GHS ' + Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function validateExpense(data) {
  const errs = {};
  if (!data.eventId)            errs.eventId     = 'Please select an event.';
  if (!data.amount || Number(data.amount) <= 0) errs.amount = 'Enter a valid amount.';
  if (!data.date)               errs.date        = 'Date is required.';
  if (!data.vendor?.trim())     errs.vendor      = 'Vendor / Payee is required.';
  if (!data.description?.trim()) errs.description = 'Description is required.';
  return errs;
}

export function Expenses() {
  const { expenses, refreshData, events, members } = useData();
  const { user } = useAuth();
  const location = useLocation();
  const isMember = user?.role === 'member';
  const isAuditor = user?.role === 'auditor';
  const isReadOnly = isMember || isAuditor;

  // ── Filters ──
  const [eventFilter,    setEventFilter]    = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [receiptFilter,  setReceiptFilter]  = useState('All');
  const [dateFrom,       setDateFrom]       = useState('');
  const [dateTo,         setDateTo]         = useState('');

  // ── Log expense modal ──
  const [isModalOpen,       setIsModalOpen]       = useState(false);
  const [formData,          setFormData]          = useState({});
  const [formErrors,        setFormErrors]        = useState({});
  const [saving,            setSaving]            = useState(false);
  const [saveError,         setSaveError]         = useState('');
  const [editingExpenseId,  setEditingExpenseId]  = useState(null);  // null = new, id = editing

  // ── Slide-in panel ──
  const [activeExpense, setActiveExpense] = useState(null);
  const [panelOpen,     setPanelOpen]     = useState(false);

  // ── Upload receipt modal ──
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadTarget,    setUploadTarget]    = useState(null);
  const [uploadFile,      setUploadFile]      = useState(null);
  const [uploadPreview,   setUploadPreview]   = useState(null);
  const [uploadError,     setUploadError]     = useState('');
  const [uploading,       setUploading]       = useState(false);
  const fileInputRef     = useRef(null);
  const editReceiptRef   = useRef(null);

  // ── Inline receipt replacement (inside edit modal) ──
  const [editReceiptFile,    setEditReceiptFile]    = useState(null);
  const [editReceiptPreview, setEditReceiptPreview] = useState(null);
  const [editReceiptError,   setEditReceiptError]   = useState('');

  // ── Deep-link from /events ──
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const prefillEvent = params.get('event');
    const action = params.get('action');
    if (prefillEvent) setEventFilter(prefillEvent);
    if (action === 'new') handleOpenLog(prefillEvent);
  }, [location.search]);

  // ── Filtering ──
  const filteredExpenses = expenses.filter(ex => {
    const matchEvent   = eventFilter === 'All' || ex.eventId === eventFilter;
    const matchCat     = categoryFilter === 'All' || ex.category === categoryFilter;
    let   matchReceipt = true;
    if (receiptFilter === 'attached') matchReceipt = !!ex.receipt;
    if (receiptFilter === 'missing')  matchReceipt = !ex.receipt;
    let matchDate = true;
    if (dateFrom && ex.date) matchDate = ex.date >= dateFrom;
    if (dateTo   && ex.date) matchDate = matchDate && (ex.date <= dateTo);
    return matchEvent && matchCat && matchReceipt && matchDate;
  });

  const getEventName = (id) => events.find(e => e.id === id)?.name || 'Unknown Event';
  const getMemberName = (id) => {
    const m = members.find(m => m.id === id);
    return m ? (m.full_name || m.name) : (id || 'Unknown');
  };

  const handleOpenLog = (presetEventId = null) => {
    setEditingExpenseId(null);
    setFormData({ eventId: presetEventId || '', category: 'food_drinks', amount: '', date: '', vendor: '', description: '', paidBy: '' });
    setFormErrors({});
    setSaveError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (ex, e) => {
    e.stopPropagation();
    setEditingExpenseId(ex.id);
    setFormData({
      eventId:     ex.eventId     || ex.event_id || '',
      category:    ex.category    || 'food_drinks',
      amount:      ex.amount      || '',
      date:        ex.date        || ex.expense_date || '',
      vendor:      ex.vendor      || '',
      description: ex.description || '',
      paidBy:      ex.paidBy      || ex.paid_by || '',
      // keep track of the existing receipt URL so we can display it
      currentReceipt: ex.receipt  || null,
    });
    // Reset inline receipt replacement state
    setEditReceiptFile(null);
    setEditReceiptPreview(null);
    setEditReceiptError('');
    setFormErrors({});
    setSaveError('');
    setIsModalOpen(true);
  };

  const setField = (key, val) => {
    setFormData(prev => ({ ...prev, [key]: val }));
    if (formErrors[key]) setFormErrors(prev => ({ ...prev, [key]: undefined }));
  };

  // ── Handle receipt file selection inside edit modal ──
  const handleEditFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const MAX = 5 * 1024 * 1024;
    const OK  = ['image/jpeg', 'image/png', 'application/pdf'];
    if (file.size > MAX)        { setEditReceiptError('File too large. Max 5MB.'); return; }
    if (!OK.includes(file.type)) { setEditReceiptError('Only JPG, PNG or PDF accepted.'); return; }
    setEditReceiptError('');
    setEditReceiptFile(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => setEditReceiptPreview(ev.target.result);
      reader.readAsDataURL(file);
    } else {
      setEditReceiptPreview('pdf');
    }
  };

  // ── Save expense (create or update) ──
  const handleSave = async () => {
    const errs = validateExpense(formData);
    if (Object.keys(errs).length > 0) { setFormErrors(errs); return; }
    setSaving(true);
    setSaveError('');
    try {
      if (editingExpenseId) {
        // ── Edit existing expense ──
        // If the user chose a replacement receipt, upload it first
        let newReceiptUrl = undefined; // undefined = don't touch receipt_url
        if (editReceiptFile) {
          const { publicUrl, error: upErr } = await expenseService.uploadReceiptOnly(editingExpenseId, editReceiptFile);
          if (upErr) { setSaveError(upErr); setSaving(false); return; }
          newReceiptUrl = publicUrl;
        }
        const payload = { ...formData };
        if (newReceiptUrl !== undefined) payload.receipt_url = newReceiptUrl;
        const { error } = await expenseService.updateExpense(editingExpenseId, payload);
        if (error) {
          setSaveError(error.message || JSON.stringify(error));
          console.error('updateExpense DB error:', error);
          setSaving(false);
          return;
        }
      } else {
        // ── Log new expense ──
        const { data, error } = await expenseService.logExpense({ ...formData, logged_by_id: user?.id });
        if (error) {
          setSaveError(error.message || JSON.stringify(error));
          console.error('logExpense DB error:', error);
          setSaving(false);
          return;
        }
      }
      await refreshData();
      setIsModalOpen(false);
    } catch (err) {
      setSaveError(err?.message || 'Unexpected error — please try again.');
      console.error('Save expense error:', err);
    }
    setSaving(false);
  };

  // ── Open slide-in panel ──
  const handleOpenPanel = (ex) => {
    setActiveExpense(ex);
    setPanelOpen(true);
  };

  // ── Open upload modal ──
  const handleOpenUpload = (ex, e) => {
    e.stopPropagation();
    setUploadTarget(ex);
    setUploadFile(null);
    setUploadPreview(null);
    setUploadError('');
    setUploadModalOpen(true);
  };

  // ── File selection + validation + preview ──
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const MAX = 5 * 1024 * 1024;
    const OK  = ['image/jpeg', 'image/png', 'application/pdf'];
    if (file.size > MAX)        { setUploadError('File too large. Maximum size is 5MB.'); setUploadFile(null); setUploadPreview(null); return; }
    if (!OK.includes(file.type)) { setUploadError('Invalid file type. Only JPG, PNG, and PDF are accepted.'); setUploadFile(null); setUploadPreview(null); return; }
    setUploadError('');
    setUploadFile(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => setUploadPreview(ev.target.result);
      reader.readAsDataURL(file);
    } else {
      setUploadPreview('pdf');
    }
  };

  // ── Upload to Supabase Storage ──
  const handleUpload = async () => {
    if (!uploadFile || !uploadTarget) return;
    setUploading(true);
    setUploadError('');
    const { publicUrl, error } = await expenseService.uploadReceipt(uploadTarget.id, uploadFile);
    if (error) {
      setUploadError(typeof error === 'string' ? error : (error.message || JSON.stringify(error)));
      console.error('uploadReceipt error:', error);
      setUploading(false);
      return;
    }
    await refreshData();
    // Update panel state if open for this expense
    if (panelOpen && activeExpense?.id === uploadTarget.id) {
      setActiveExpense(prev => ({ ...prev, receipt: publicUrl, receipt_url: publicUrl }));
    }
    setUploadModalOpen(false);
    setUploading(false);
  };

  // ── Clear all filters ──
  const clearFilters = () => {
    setEventFilter('All');
    setCategoryFilter('All');
    setReceiptFilter('All');
    setDateFrom('');
    setDateTo('');
  };
  const hasFilters = eventFilter !== 'All' || categoryFilter !== 'All' || receiptFilter !== 'All' || dateFrom || dateTo;

  // ── Export filtered expenses to CSV ──
  const handleExportCSV = () => {
    const headers = ['Date', 'Event', 'Category', 'Description', 'Vendor / Payee', 'Amount (GHS)', 'Paid By', 'Receipt', 'Logged By'];
    const escape = (v) => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = filteredExpenses.map(ex => [
      ex.date || '',
      getEventName(ex.eventId),
      catLabel(ex.category),
      ex.description || '',
      ex.vendor || '',
      Number(ex.amount || 0).toFixed(2),
      ex.paidBy || '',
      ex.receipt ? 'Attached' : 'Missing',
      getMemberName(ex.loggedBy),
    ].map(escape).join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `expenses-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '24px', color: 'var(--primary-dark)', marginBottom: '4px' }}>Expenses & Receipts</h2>
        <p style={{ color: 'var(--text-mid)' }}>Log event costs and attach supporting evidence.</p>
      </div>

      {/* ── Filter bar ── */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Event filter */}
        <select value={eventFilter} onChange={e => setEventFilter(e.target.value)} style={{ height: '40px', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '0 12px', outline: 'none', maxWidth: '200px' }}>
          <option value="All">All Events</option>
          {events.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        {/* Category filter */}
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={{ height: '40px', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '0 12px', outline: 'none' }}>
          <option value="All">All Categories</option>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        {/* Receipt filter */}
        <select value={receiptFilter} onChange={e => setReceiptFilter(e.target.value)} style={{ height: '40px', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '0 12px', outline: 'none' }}>
          <option value="All">All Receipts</option>
          <option value="attached">Has Receipt</option>
          <option value="missing">Missing Receipt</option>
        </select>
        {/* Date range */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} placeholder="From"
            style={{ height: '40px', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '0 10px', outline: 'none', fontSize: '13px' }} />
          <span style={{ fontSize: '13px', color: 'var(--text-mid)' }}>to</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} placeholder="To"
            style={{ height: '40px', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '0 10px', outline: 'none', fontSize: '13px' }} />
        </div>
        {hasFilters && (
          <button onClick={clearFilters} style={{ height: '40px', padding: '0 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'none', cursor: 'pointer', color: 'var(--text-mid)', fontSize: '13px' }}>
            Clear filters
          </button>
        )}
        <div style={{ flex: 1 }} />
        <Button variant="secondary" onClick={handleExportCSV} disabled={filteredExpenses.length === 0 || isMember}>
          ↓ Export CSV
        </Button>
        {!isReadOnly && (
          <Button onClick={() => handleOpenLog()}><Plus size={16} style={{ marginRight: '8px' }} /> Log Expense</Button>
        )}
      </div>

      {/* ── Table ── */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--light-blue)', color: 'var(--primary-dark)', fontSize: '12px', textTransform: 'uppercase' }}>
                {['Date', 'Event', 'Category', 'Description', 'Vendor / Payee', 'Amount (GHS)', 'Paid By', 'Receipt', 'Logged By', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', fontWeight: '600', whiteSpace: 'nowrap', textAlign: h === 'Actions' ? 'right' : 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.map((ex, i) => (
                <tr
                  key={ex.id}
                  style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: i % 2 === 0 ? 'var(--white)' : 'var(--pale-blue)', cursor: 'pointer' }}
                  onClick={() => handleOpenPanel(ex)}
                >
                  <td style={{ padding: '12px 12px', fontSize: '13px', color: 'var(--text-mid)', whiteSpace: 'nowrap' }}>{ex.date}</td>
                  <td style={{ padding: '12px 12px', fontSize: '13px', fontWeight: '500', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getEventName(ex.eventId)}</td>
                  <td style={{ padding: '12px 12px', fontSize: '13px', color: 'var(--text-mid)', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>{catLabel(ex.category)}</td>
                  <td style={{ padding: '12px 12px', fontSize: '13px', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ex.description}>{ex.description}</td>
                  <td style={{ padding: '12px 12px', fontSize: '13px', color: 'var(--text-mid)', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ex.vendor}>{ex.vendor || '—'}</td>
                  <td style={{ padding: '12px 12px', fontSize: '13px', fontWeight: '600', whiteSpace: 'nowrap' }}>{fmtGHS(ex.amount)}</td>
                  <td style={{ padding: '12px 12px', fontSize: '13px', color: 'var(--text-mid)', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.paidBy || '—'}</td>
                  <td style={{ padding: '12px 12px' }}>
                    {ex.receipt
                      ? <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}><Paperclip size={14} /> Attached</span>
                      : <span style={{ color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}><AlertTriangle size={14} /> Missing</span>
                    }
                  </td>
                  <td style={{ padding: '12px 12px', fontSize: '13px', color: 'var(--text-mid)', maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getMemberName(ex.loggedBy)}</td>
                  <td style={{ padding: '12px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }} onClick={e => e.stopPropagation()}>
                      {!ex.receipt && (
                        <Button variant="secondary" style={{ padding: '0 8px', height: '30px', fontSize: '12px' }} onClick={(e) => handleOpenUpload(ex, e)}>
                          <Upload size={13} style={{ marginRight: '4px' }} /> Attach
                        </Button>
                      )}
                      {!isReadOnly && (
                        <button
                          title="Edit expense"
                          style={{ border: 'none', background: 'none', color: 'var(--primary-mid)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                          onClick={(e) => handleOpenEdit(ex, e)}
                        >
                          <Edit2 size={16} />
                        </button>
                      )}
                      <button style={{ border: 'none', background: 'none', color: 'var(--text-mid)', cursor: 'pointer', display: 'flex' }} onClick={() => handleOpenPanel(ex)}>
                        <Eye size={17} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredExpenses.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-mid)', fontSize: '14px' }}>
                    No expenses found matching the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Log Expense Modal ── */}
      {isModalOpen && (
        <Modal
          title={editingExpenseId ? 'Edit Expense' : 'Log Expense'}
          onClose={saving ? undefined : () => setIsModalOpen(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setIsModalOpen(false)} disabled={saving}>Cancel</Button>
              <Button onClick={handleSave} loading={saving} disabled={saving}>{editingExpenseId ? 'Save Changes' : 'Save Expense'}</Button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Event */}
            <div>
              <label className="input-label">Event *</label>
              <select
                value={formData.eventId || ''}
                onChange={e => setField('eventId', e.target.value)}
                style={{ ...SEL_STYLE, borderColor: formErrors.eventId ? 'var(--danger)' : 'var(--border-color)' }}
              >
                <option value="" disabled>Select an Event</option>
                {events.map(e => <option key={e.id} value={e.id}>{e.name} ({e.date})</option>)}
              </select>
              <FieldError msg={formErrors.eventId} />
            </div>

            {/* Amount + Category */}
            <div style={{ display: 'flex', gap: '14px' }}>
              <div style={{ flex: 1 }}>
                <Input
                  label="Amount (GHS) *"
                  type="number"
                  value={formData.amount}
                  onChange={e => setField('amount', e.target.value)}
                  style={{ borderColor: formErrors.amount ? 'var(--danger)' : undefined }}
                />
                <FieldError msg={formErrors.amount} />
              </div>
              <div style={{ flex: 1 }}>
                <label className="input-label">Category</label>
                <select value={formData.category || 'food_drinks'} onChange={e => setField('category', e.target.value)} style={SEL_STYLE}>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            </div>

            {/* Date + Vendor */}
            <div style={{ display: 'flex', gap: '14px' }}>
              <div style={{ flex: 1 }}>
                <Input
                  label="Date of Expense *"
                  type="date"
                  value={formData.date}
                  onChange={e => setField('date', e.target.value)}
                  style={{ borderColor: formErrors.date ? 'var(--danger)' : undefined }}
                />
                <FieldError msg={formErrors.date} />
              </div>
              <div style={{ flex: 1 }}>
                <Input
                  label="Vendor / Payee *"
                  value={formData.vendor}
                  onChange={e => setField('vendor', e.target.value)}
                  style={{ borderColor: formErrors.vendor ? 'var(--danger)' : undefined }}
                />
                <FieldError msg={formErrors.vendor} />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="input-label">Description *</label>
              <textarea
                value={formData.description}
                onChange={e => setField('description', e.target.value)}
                style={{ width: '100%', minHeight: '64px', borderRadius: '8px', border: `1px solid ${formErrors.description ? 'var(--danger)' : 'var(--border-color)'}`, padding: '10px 12px', outline: 'none', backgroundColor: 'var(--pale-blue)', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', fontSize: '14px' }}
              />
              <FieldError msg={formErrors.description} />
            </div>

            {/* Paid By */}
            <Input label="Paid By (Optional)" value={formData.paidBy} onChange={e => setField('paidBy', e.target.value)} />

            {/* Receipt (edit mode only) */}
            {editingExpenseId && (
              <div>
                <label className="input-label">Receipt</label>
                {/* Current receipt */}
                {formData.currentReceipt && !editReceiptFile && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'var(--pale-blue)', borderRadius: '8px', padding: '10px 12px', border: '1px solid var(--border-color)', marginBottom: '8px' }}>
                    <Paperclip size={15} style={{ color: 'var(--success)', flexShrink: 0 }} />
                    <a
                      href={formData.currentReceipt}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: '13px', color: 'var(--primary-mid)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {formData.currentReceipt.split('/').pop() || 'View current receipt'}
                    </a>
                    <button
                      type="button"
                      onClick={() => editReceiptRef.current?.click()}
                      style={{ border: 'none', background: 'none', color: 'var(--primary-mid)', cursor: 'pointer', fontSize: '12px', fontWeight: '600', flexShrink: 0 }}
                    >
                      Replace
                    </button>
                  </div>
                )}
                {/* New file chosen */}
                {editReceiptFile && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--success)', fontSize: '13px', marginBottom: '8px' }}>
                    <CheckCircle size={15} />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{editReceiptFile.name} — ready to replace</span>
                    <button type="button" onClick={() => { setEditReceiptFile(null); setEditReceiptPreview(null); setEditReceiptError(''); }} style={{ border: 'none', background: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '12px', fontWeight: '600', flexShrink: 0 }}>Undo</button>
                  </div>
                )}
                {/* No receipt yet in edit mode */}
                {!formData.currentReceipt && !editReceiptFile && (
                  <div
                    style={{ border: '2px dashed var(--border-color)', borderRadius: '8px', padding: '14px', textAlign: 'center', cursor: 'pointer', backgroundColor: 'var(--pale-blue)', fontSize: '13px', color: 'var(--text-mid)' }}
                    onClick={() => editReceiptRef.current?.click()}
                  >
                    <Upload size={16} style={{ marginBottom: '4px', display: 'block', margin: '0 auto 4px' }} />
                    Click to attach a receipt
                  </div>
                )}
                {/* Hidden file input */}
                <input
                  type="file"
                  ref={editReceiptRef}
                  style={{ display: 'none' }}
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={handleEditFileChange}
                />
                {/* Replace-receipt button visible when there is a current receipt already */}
                {formData.currentReceipt && !editReceiptFile && (
                  <button
                    type="button"
                    onClick={() => editReceiptRef.current?.click()}
                    style={{ display: 'none' }}
                  />
                )}
                {editReceiptError && <div style={{ color: 'var(--danger)', fontSize: '12px', marginTop: '4px' }}>⚠ {editReceiptError}</div>}
              </div>
            )}

            {/* Save error banner */}
            {saveError && (
              <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '8px', padding: '12px 14px', fontSize: '13px', color: '#DC2626', lineHeight: '1.5' }}>
                ⚠ Could not save: {saveError}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ── Attach Receipt Modal ── */}
      {uploadModalOpen && (
        <Modal
          title="Attach Receipt"
          onClose={uploading ? undefined : () => setUploadModalOpen(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setUploadModalOpen(false)} disabled={uploading}>Cancel</Button>
              <Button onClick={handleUpload} disabled={!uploadFile || uploading} loading={uploading}>Upload Receipt</Button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ color: 'var(--text-mid)', fontSize: '14px', margin: 0 }}>
              Attaching receipt for: <strong>{uploadTarget?.description}</strong>
            </p>

            {/* Drop zone / file input */}
            <div
              style={{ border: `2px dashed ${uploadError ? 'var(--danger)' : 'var(--border-color)'}`, borderRadius: '10px', padding: '28px 16px', textAlign: 'center', backgroundColor: 'var(--pale-blue)', cursor: 'pointer' }}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept=".jpg,.jpeg,.png,.pdf"
                onChange={handleFileChange}
              />
              {uploadPreview && uploadPreview !== 'pdf' ? (
                <img src={uploadPreview} alt="Preview" style={{ maxHeight: '160px', maxWidth: '100%', borderRadius: '6px', objectFit: 'contain', marginBottom: '8px' }} />
              ) : uploadPreview === 'pdf' ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: 'var(--primary-mid)' }}>
                  <Paperclip size={32} />
                  <span style={{ fontSize: '14px', fontWeight: '500' }}>{uploadFile?.name}</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: 'var(--text-mid)' }}>
                  <Upload size={28} />
                  <span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--primary-mid)' }}>Click to browse files</span>
                  <span style={{ fontSize: '12px' }}>JPG, PNG, or PDF — max 5MB</span>
                </div>
              )}
            </div>

            {uploadFile && !uploadError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--success)', fontSize: '13px' }}>
                <CheckCircle size={15} /> {uploadFile.name} ready to upload
              </div>
            )}
            {uploadError && (
              <div style={{ color: 'var(--danger)', fontSize: '13px', fontWeight: '500' }}>⚠ {uploadError}</div>
            )}
          </div>
        </Modal>
      )}

      {/* ── Expense Detail Slide-in Panel ── */}
      {panelOpen && activeExpense && (
        <SlideInPanel title="Expense Details" onClose={() => setPanelOpen(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Status */}
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-light)', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.5px' }}>Receipt Status</div>
              {activeExpense.receipt
                ? <Badge variant="success"><Paperclip size={13} style={{ marginRight: '5px' }} /> Receipt Attached</Badge>
                : <Badge variant="warning"><AlertTriangle size={13} style={{ marginRight: '5px' }} /> Missing Receipt</Badge>
              }
            </div>

            {/* Amount + Date */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-light)', textTransform: 'uppercase', marginBottom: '4px' }}>Amount</div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--primary-dark)' }}>{fmtGHS(activeExpense.amount)}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-light)', textTransform: 'uppercase', marginBottom: '4px' }}>Date</div>
                <div style={{ fontSize: '14px', fontWeight: '500' }}>{activeExpense.date}</div>
              </div>
            </div>

            {/* Event */}
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-light)', textTransform: 'uppercase', marginBottom: '4px' }}>Event</div>
              <div style={{ fontSize: '14px', fontWeight: '500' }}>{getEventName(activeExpense.eventId)}</div>
            </div>

            {/* Category + Vendor */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-light)', textTransform: 'uppercase', marginBottom: '4px' }}>Category</div>
                <div style={{ fontSize: '14px', textTransform: 'capitalize' }}>{catLabel(activeExpense.category)}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-light)', textTransform: 'uppercase', marginBottom: '4px' }}>Vendor / Payee</div>
                <div style={{ fontSize: '14px' }}>{activeExpense.vendor || '—'}</div>
              </div>
            </div>

            {/* Description */}
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-light)', textTransform: 'uppercase', marginBottom: '4px' }}>Description</div>
              <div style={{ fontSize: '14px', lineHeight: '1.6', color: 'var(--text-dark)' }}>{activeExpense.description}</div>
            </div>

            {/* Paid By */}
            {activeExpense.paidBy && (
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-light)', textTransform: 'uppercase', marginBottom: '4px' }}>Paid By</div>
                <div style={{ fontSize: '14px' }}>{activeExpense.paidBy}</div>
              </div>
            )}

            {/* Receipt viewer */}
            {activeExpense.receipt && (
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-light)', textTransform: 'uppercase', marginBottom: '8px' }}>Receipt</div>
                {/\.(jpg|jpeg|png|gif|webp)$/i.test(activeExpense.receipt) || activeExpense.receipt.startsWith('data:image') ? (
                  <a href={activeExpense.receipt} target="_blank" rel="noopener noreferrer">
                    <img
                      src={activeExpense.receipt}
                      alt="Receipt"
                      style={{ maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border-color)', cursor: 'zoom-in', display: 'block' }}
                    />
                  </a>
                ) : (
                  <div style={{ backgroundColor: 'var(--pale-blue)', borderRadius: '8px', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary-dark)', fontSize: '14px', fontWeight: '500' }}>
                      <Paperclip size={16} /> {activeExpense.receipt.split('/').pop() || 'Receipt'}
                    </div>
                    <a href={activeExpense.receipt} target="_blank" rel="noopener noreferrer">
                      <Button variant="secondary" style={{ height: '32px', fontSize: '12px', padding: '0 12px' }}>View PDF</Button>
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Logged by */}
            <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid var(--border-color)', fontSize: '12px', color: 'var(--text-mid)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div>Logged by: <strong>{getMemberName(activeExpense.loggedBy)}</strong></div>
              {activeExpense.date && <div>Date: {activeExpense.date}</div>}
            </div>
          </div>
        </SlideInPanel>
      )}
    </div>
  );
}
