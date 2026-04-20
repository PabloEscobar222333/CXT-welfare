import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { eventService } from '../../services/api';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import {
  Search, Plus, Calendar, AlertTriangle, Paperclip,
  Receipt, Edit2, Trash2, Eye, LayoutGrid, List, User,
} from 'lucide-react';

// ─── Modal ────────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children, footer }) {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
      <div style={{ backgroundColor: 'var(--white)', borderRadius: '16px', width: '100%', maxWidth: '520px', overflow: 'hidden', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
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
          >
            ✕
          </button>
        </div>
        <div style={{ padding: '24px', maxHeight: '70vh', overflowY: 'auto' }}>{children}</div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--pale-blue)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          {footer}
        </div>
      </div>
    </div>
  );
}

// ─── Field error label ────────────────────────────────────────────────────────
function FieldError({ msg }) {
  if (!msg) return null;
  return <div style={{ color: 'var(--danger)', fontSize: '12px', marginTop: '4px' }}>{msg}</div>;
}

const SEL_STYLE = {
  height: '40px', borderRadius: '8px', border: '1px solid var(--border-color)',
  padding: '0 12px', outline: 'none', backgroundColor: 'var(--pale-blue)',
  width: '100%',
};

const REQUIRED_FIELDS = ['name', 'type', 'date'];

function validate(data) {
  const errs = {};
  if (!data.name?.trim())  errs.name  = 'Event name is required.';
  if (!data.type)          errs.type  = 'Event type is required.';
  if (!data.date)          errs.date  = 'Event date is required.';
  return errs;
}

export function Events() {
  const { events, refreshData, expenses } = useData();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMember = user?.role === 'member';
  const isAuditor = user?.role === 'auditor';
  const isReadOnly = isMember || isAuditor;

  // ── Filters ──
  const [search,       setSearch]       = useState('');
  const [typeFilter,   setTypeFilter]   = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [viewMode,     setViewMode]     = useState('card'); // 'card' | 'table'

  // ── Modal / form ──
  const [isModalOpen,  setIsModalOpen]  = useState(false);
  const [formData,     setFormData]     = useState({});
  const [formErrors,   setFormErrors]   = useState({});
  const [editingId,    setEditingId]    = useState(null);
  const [saving,       setSaving]       = useState(false);

  // ── Delete confirmation ──
  const [deleteTarget, setDeleteTarget] = useState(null); // event object to confirm deletion of
  const [deleting,     setDeleting]     = useState(false);

  // ── Filter logic ──
  const filteredEvents = events.filter(e => {
    if (!e) return false;
    const matchSearch = (e.name || '').toLowerCase().includes(search.toLowerCase());
    const matchType   = typeFilter === 'All'   || e.type   === typeFilter;
    const matchStatus = statusFilter === 'All' || e.status === statusFilter;
    return matchSearch && matchType && matchStatus;
  });

  // ── Badge colours ──
  const getBadgeVariant = (type) => {
    switch (type) {
      case 'birthday':       return 'primary';
      case 'bereavement':    return 'gray';
      case 'meetup':         return 'success';
      case 'end_of_year':    return 'warning';
      case 'hospital_support': return 'neutral';
      default:               return 'neutral';
    }
  };

  // ── Open add ──
  const handleOpenAdd = () => {
    setFormData({ name: '', type: 'meetup', date: '', description: '', organiser: '', budget: '', status: 'upcoming' });
    setFormErrors({});
    setEditingId(null);
    setIsModalOpen(true);
  };

  // ── Open edit ──
  const handleOpenEdit = (e) => {
    setFormData({ ...e, date: e.date || e.event_date, budget: e.budget || e.budget_limit || '' });
    setFormErrors({});
    setEditingId(e.id);
    setIsModalOpen(true);
  };

  // ── Save (create or update) ──
  const handleSave = async () => {
    const errs = validate(formData);
    if (Object.keys(errs).length > 0) { setFormErrors(errs); return; }
    setSaving(true);
    try {
      if (editingId) {
        await eventService.updateEvent(editingId, formData);
      } else {
        await eventService.createEvent({ ...formData, status: formData.status || 'upcoming' });
      }
      refreshData();
      setIsModalOpen(false);
    } catch (err) {
      console.error('Save event error:', err);
    }
    setSaving(false);
  };

  // ── Delete flow ──
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await eventService.deleteEvent(deleteTarget.id);
      refreshData();
    } catch (err) {
      console.error('Delete event error:', err);
    }
    setDeleting(false);
    setDeleteTarget(null);
  };

  // ── Field updater ──
  const setField = (key, val) => {
    setFormData(prev => ({ ...prev, [key]: val }));
    if (formErrors[key]) setFormErrors(prev => ({ ...prev, [key]: undefined }));
  };

  // ── Shared card data ──
  const enrichEvent = (e) => {
    const evExpenses       = expenses.filter(ex => ex.eventId === e.id);
    const actualSpend      = evExpenses.reduce((s, ex) => s + Number(ex.amount || 0), 0);
    const receiptsAttached = evExpenses.filter(ex => ex.receipt).length;
    let budgetStatus = 'none';
    if (e.budget) budgetStatus = actualSpend > e.budget ? 'over' : 'under';
    return { evExpenses, actualSpend, receiptsAttached, budgetStatus };
  };

  // ── Helpers ──
  const fmtGHS = (n) => 'GHS ' + Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 });
  const typeName = (t) => (t || '').replace(/_/g, ' ');

  // ─── Action bar (shared for both views) ────────────────────────────────────
  const ActionBar = (
    <div style={{ display: 'flex', gap: '12px', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
      {/* Search */}
      <div style={{ position: 'relative', width: '250px' }}>
        <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
        <input
          type="text" placeholder="Search events..." value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', height: '40px', paddingLeft: '32px', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', boxSizing: 'border-box' }}
        />
      </div>
      {/* Type filter */}
      <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ height: '40px', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '0 12px', outline: 'none' }}>
        <option value="All">All Types</option>
        <option value="birthday">Birthday</option>
        <option value="bereavement">Bereavement</option>
        <option value="meetup">Meetup</option>
        <option value="end_of_year">End of Year</option>
        <option value="hospital_support">Hospital Support</option>
        <option value="other">Other</option>
      </select>
      {/* Status filter */}
      <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ height: '40px', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '0 12px', outline: 'none' }}>
        <option value="All">All Status</option>
        <option value="upcoming">Upcoming</option>
        <option value="in_progress">In Progress</option>
        <option value="completed">Completed</option>
      </select>
      <div style={{ flex: 1 }} />
      {/* View toggle */}
      <div style={{ display: 'flex', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
        <button
          onClick={() => setViewMode('card')}
          title="Card view"
          style={{ width: '40px', height: '40px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: viewMode === 'card' ? 'var(--primary-mid)' : 'var(--white)', color: viewMode === 'card' ? 'var(--white)' : 'var(--text-mid)' }}
        ><LayoutGrid size={16} /></button>
        <button
          onClick={() => setViewMode('table')}
          title="Table view"
          style={{ width: '40px', height: '40px', border: 'none', borderLeft: '1px solid var(--border-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: viewMode === 'table' ? 'var(--primary-mid)' : 'var(--white)', color: viewMode === 'table' ? 'var(--white)' : 'var(--text-mid)' }}
        ><List size={16} /></button>
      </div>
      {/* Create button — hidden for members and auditors */}
      {!isReadOnly && (
        <Button onClick={handleOpenAdd}><Plus size={16} style={{ marginRight: '8px' }} /> Create Event</Button>
      )}
    </div>
  );

  // ─── Card grid view ─────────────────────────────────────────────────────────
  const CardGrid = (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
      {filteredEvents.map(e => {
        const { evExpenses, actualSpend, receiptsAttached, budgetStatus } = enrichEvent(e);
        const hasExpenses = evExpenses.length > 0;
        return (
          <Card key={e.id} style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: '700', color: 'var(--primary-dark)', margin: 0, flex: 1, paddingRight: '12px' }}>{e.name}</h3>
              <Badge variant={getBadgeVariant(e.type)}>{typeName(e.type)}</Badge>
            </div>

            <div style={{ color: 'var(--text-mid)', fontSize: '13px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Calendar size={13} /> {e.date}</span>
              {e.organiser && <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><User size={13} /> {e.organiser}</span>}
            </div>

            {/* Budget / spend */}
            <div style={{ backgroundColor: 'var(--pale-blue)', padding: '14px 16px', borderRadius: '8px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-mid)' }}>Budget: {e.budget ? fmtGHS(e.budget) : <em style={{ color: 'var(--text-light)' }}>None</em>}</span>
                <span style={{ fontWeight: '600', color: budgetStatus === 'over' ? 'var(--danger)' : budgetStatus === 'under' ? 'var(--success)' : 'var(--text-dark)' }}>
                  Spend: {fmtGHS(actualSpend)}
                </span>
              </div>
              {e.budget && (
                <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--white)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min((actualSpend / e.budget) * 100, 100)}%`, height: '100%', backgroundColor: budgetStatus === 'over' ? 'var(--danger)' : 'var(--success)', transition: 'width 0.3s ease' }} />
                </div>
              )}
              {e.budget && (
                <div style={{ fontSize: '11px', marginTop: '6px', color: budgetStatus === 'over' ? 'var(--danger)' : 'var(--success)', fontWeight: '600' }}>
                  {budgetStatus === 'over' ? '⚠ Over budget' : budgetStatus === 'under' ? '✓ Under budget' : ''}
                </div>
              )}
            </div>

            {/* Counters */}
            <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--text-mid)', marginBottom: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Receipt size={13} /> {evExpenses.length} expense{evExpenses.length !== 1 ? 's' : ''} logged
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: receiptsAttached < evExpenses.length && evExpenses.length > 0 ? 'var(--warning)' : 'inherit' }}>
                <Paperclip size={13} /> {receiptsAttached}/{evExpenses.length} receipts
                {receiptsAttached < evExpenses.length && evExpenses.length > 0 && <AlertTriangle size={13} style={{ marginLeft: '2px' }} />}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <Button variant="secondary" style={{ flex: 1, padding: 0 }} onClick={() => navigate(`/events/${e.id}`)}>
                <Eye size={15} style={{ marginRight: '5px' }} /> View
              </Button>
              {!isReadOnly && (
                <Button variant="secondary" style={{ flex: 1, padding: 0 }} onClick={() => navigate(`/expenses?event=${e.id}&action=new`)}>
                  <Plus size={15} style={{ marginRight: '5px' }} /> Expense
                </Button>
              )}
              {!isReadOnly && (
                <button onClick={() => handleOpenEdit(e)}
                  style={{ width: '38px', height: '38px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'none', cursor: 'pointer', color: 'var(--text-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Edit2 size={15} />
                </button>
              )}
              <button
                disabled={hasExpenses}
                onClick={() => !hasExpenses && setDeleteTarget(e)}
                title={hasExpenses ? 'Cannot delete — event has expenses' : 'Delete event'}
                style={{ width: '38px', height: '38px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'none', cursor: hasExpenses ? 'not-allowed' : 'pointer', color: hasExpenses ? 'var(--border-color)' : 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: hasExpenses ? 0.4 : 1 }}>
                <Trash2 size={15} />
              </button>
            </div>
          </Card>
        );
      })}
      {filteredEvents.length === 0 && (
        <div style={{ gridColumn: '1/-1', padding: '64px', textAlign: 'center', color: 'var(--text-mid)' }}>
          <Calendar size={40} style={{ opacity: 0.2, marginBottom: '12px' }} />
          <p style={{ fontSize: '15px' }}>No events match your current filters.</p>
        </div>
      )}
    </div>
  );

  // ─── Table view ─────────────────────────────────────────────────────────────
  const TableView = (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--light-blue)', color: 'var(--primary-dark)', fontSize: '12px', textTransform: 'uppercase' }}>
              {['Event Name', 'Type', 'Date', 'Organiser', 'Budget', 'Actual Spend', 'Status', 'Expenses', 'Receipts', 'Actions'].map(h => (
                <th key={h} style={{ padding: '13px 20px', fontWeight: '600', whiteSpace: 'nowrap', textAlign: h === 'Actions' ? 'right' : 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredEvents.map((e, i) => {
              const { evExpenses, actualSpend, receiptsAttached, budgetStatus } = enrichEvent(e);
              const hasExpenses = evExpenses.length > 0;
              return (
                <tr key={e.id} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: i % 2 === 0 ? 'var(--white)' : 'var(--pale-blue)' }}>
                  <td style={{ padding: '14px 20px', fontWeight: '600', color: 'var(--primary-dark)', fontSize: '14px' }}>{e.name}</td>
                  <td style={{ padding: '14px 20px' }}><Badge variant={getBadgeVariant(e.type)}>{typeName(e.type)}</Badge></td>
                  <td style={{ padding: '14px 20px', fontSize: '13px', color: 'var(--text-mid)' }}>{e.date}</td>
                  <td style={{ padding: '14px 20px', fontSize: '13px', color: 'var(--text-mid)' }}>{e.organiser || '—'}</td>
                  <td style={{ padding: '14px 20px', fontSize: '13px' }}>{e.budget ? fmtGHS(e.budget) : '—'}</td>
                  <td style={{ padding: '14px 20px', fontSize: '13px', fontWeight: '600', color: budgetStatus === 'over' ? 'var(--danger)' : budgetStatus === 'under' ? 'var(--success)' : 'var(--text-dark)' }}>{fmtGHS(actualSpend)}</td>
                  <td style={{ padding: '14px 20px' }}>
                    <Badge variant={e.status === 'completed' ? 'success' : e.status === 'in_progress' ? 'warning' : 'neutral'}>{(e.status || '').replace(/_/g, ' ')}</Badge>
                  </td>
                  <td style={{ padding: '14px 20px', fontSize: '13px', color: 'var(--text-mid)' }}>{evExpenses.length}</td>
                  <td style={{ padding: '14px 20px', fontSize: '13px', color: receiptsAttached < evExpenses.length && evExpenses.length > 0 ? 'var(--warning)' : 'var(--text-mid)' }}>
                    {receiptsAttached}/{evExpenses.length}
                  </td>
                  <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                      <button onClick={() => navigate(`/events/${e.id}`)} title="View" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--primary-mid)', display: 'flex' }}><Eye size={16} /></button>
                      {!isReadOnly && (
                        <button onClick={() => handleOpenEdit(e)} title="Edit" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-mid)', display: 'flex' }}><Edit2 size={16} /></button>
                      )}
                      <button
                        disabled={hasExpenses}
                        onClick={() => !hasExpenses && setDeleteTarget(e)}
                        title={hasExpenses ? 'Cannot delete — event has expenses' : 'Delete'}
                        style={{ border: 'none', background: 'none', cursor: hasExpenses ? 'not-allowed' : 'pointer', color: hasExpenses ? 'var(--border-color)' : 'var(--danger)', opacity: hasExpenses ? 0.4 : 1, display: 'flex' }}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredEvents.length === 0 && (
              <tr><td colSpan={10} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-mid)' }}>No events match your current filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '24px', color: 'var(--primary-dark)', marginBottom: '4px' }}>Welfare Events</h2>
        <p style={{ color: 'var(--text-mid)' }}>Create and manage welfare activities.</p>
      </div>

      {ActionBar}

      {viewMode === 'card' ? CardGrid : TableView}

      {/* ── Create / Edit Modal ─────────────────────────────────────────── */}
      {isModalOpen && (
        <Modal
          title={editingId ? 'Edit Event' : 'Create Event'}
          onClose={() => setIsModalOpen(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setIsModalOpen(false)} disabled={saving}>Cancel</Button>
              <Button onClick={handleSave} loading={saving}>Save Event</Button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Event Name */}
            <div>
              <Input
                label="Event Name *"
                value={formData.name || ''}
                onChange={e => setField('name', e.target.value)}
                style={{ borderColor: formErrors.name ? 'var(--danger)' : undefined }}
              />
              <FieldError msg={formErrors.name} />
            </div>

            {/* Type + Date */}
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ flex: 1 }}>
                <label className="input-label">Event Type *</label>
                <select value={formData.type || 'meetup'} onChange={e => setField('type', e.target.value)}
                  style={{ ...SEL_STYLE, borderColor: formErrors.type ? 'var(--danger)' : 'var(--border-color)' }}>
                  <option value="birthday">Birthday</option>
                  <option value="bereavement">Bereavement</option>
                  <option value="meetup">Meetup</option>
                  <option value="end_of_year">End of Year</option>
                  <option value="hospital_support">Hospital Support</option>
                  <option value="team_bonding">Team Bonding</option>
                  <option value="other">Other</option>
                </select>
                <FieldError msg={formErrors.type} />
              </div>
              <div style={{ flex: 1 }}>
                <Input
                  label="Event Date *"
                  type="date"
                  value={formData.date || ''}
                  onChange={e => setField('date', e.target.value)}
                  style={{ borderColor: formErrors.date ? 'var(--danger)' : undefined }}
                />
                <FieldError msg={formErrors.date} />
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="input-label">Status</label>
              <select value={formData.status || 'upcoming'} onChange={e => setField('status', e.target.value)} style={SEL_STYLE}>
                <option value="upcoming">Upcoming</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            {/* Organiser */}
            <Input label="Organiser" value={formData.organiser || ''} onChange={e => setField('organiser', e.target.value)} />

            {/* Description */}
            <div>
              <label className="input-label">Description</label>
              <textarea
                value={formData.description || ''}
                onChange={e => setField('description', e.target.value)}
                style={{ width: '100%', minHeight: '80px', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '12px', outline: 'none', backgroundColor: 'var(--pale-blue)', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', fontSize: '14px' }}
              />
            </div>

            {/* Budget */}
            <Input label="Expected Budget (GHS)" type="number" value={formData.budget || ''} onChange={e => setField('budget', e.target.value)} />
          </div>
        </Modal>
      )}

      {/* ── Delete Confirmation Modal ───────────────────────────────────── */}
      {deleteTarget && (
        <Modal
          title="Delete Event"
          onClose={deleting ? undefined : () => setDeleteTarget(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
              <Button
                variant="danger"
                onClick={handleDeleteConfirm}
                loading={deleting}
                disabled={deleting}
              >
                Yes, Delete
              </Button>
            </>
          }
        >
          <p style={{ color: 'var(--text-mid)', fontSize: '14px', lineHeight: '1.6', margin: 0 }}>
            Are you sure you want to permanently delete <strong>"{deleteTarget.name}"</strong>?
            This action cannot be undone.
          </p>
        </Modal>
      )}
    </div>
  );
}
