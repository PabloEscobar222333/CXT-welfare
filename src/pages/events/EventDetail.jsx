import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ArrowLeft, Calendar, User, AlertTriangle, Eye, EyeOff, FileText, X } from 'lucide-react';

// ─── Receipt Viewer (inline preview or lightbox) ──────────────────────────────
function ReceiptPreview({ url, onClose }) {
  const isPdf = url && url.toLowerCase().includes('.pdf');
  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 100, padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--white)', borderRadius: '16px',
          overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
          maxWidth: '880px', width: '100%', maxHeight: '90vh',
          display: 'flex', flexDirection: 'column',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', borderBottom: '1px solid var(--border-color)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', color: 'var(--primary-dark)' }}>
            <FileText size={16} /> Receipt Preview
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              style={{
                fontSize: '13px', color: 'var(--primary-mid)', textDecoration: 'none',
                padding: '6px 14px', border: '1px solid var(--primary-mid)',
                borderRadius: '8px', fontWeight: '500',
              }}
            >
              Open in new tab ↗
            </a>
            <button
              onClick={onClose}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-mid)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', width: '32px', height: '32px',
                borderRadius: '8px', transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--pale-blue)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', backgroundColor: 'var(--pale-blue)' }}>
          {isPdf ? (
            <iframe
              src={url}
              title="Receipt PDF"
              style={{ width: '100%', height: '65vh', border: 'none', borderRadius: '8px' }}
            />
          ) : (
            <img
              src={url}
              alt="Receipt"
              style={{
                maxWidth: '100%', maxHeight: '65vh', objectFit: 'contain',
                borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export function EventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { events, expenses } = useData();
  const { user } = useAuth();
  const isMember = user?.role === 'member';
  const isAuditor = user?.role === 'auditor';
  const isReadOnly = isMember || isAuditor;

  // Track which expense's receipt is currently being previewed (null = none)
  const [previewUrl, setPreviewUrl] = useState(null);
  // Track per-row inline visibility toggle (Set of expense IDs)
  const [visibleReceipts, setVisibleReceipts] = useState(new Set());

  const toggleReceiptVisibility = (expenseId, receiptUrl) => {
    setVisibleReceipts(prev => {
      const next = new Set(prev);
      if (next.has(expenseId)) {
        next.delete(expenseId);
      } else {
        next.add(expenseId);
      }
      return next;
    });
  };

  const event = events.find(e => e.id === id);
  if (!event) return <div>Event not found</div>;

  const evExpenses = expenses.filter(ex => ex.eventId === event.id);
  const actualSpend = evExpenses.reduce((sum, ex) => sum + Number(ex.amount), 0);
  const receiptsAttached = evExpenses.filter(ex => ex.receipt).length;

  return (
    <div>
      {/* ── Lightbox Receipt Preview ── */}
      {previewUrl && <ReceiptPreview url={previewUrl} onClose={() => setPreviewUrl(null)} />}

      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2rem', gap: '1rem' }}>
        <button onClick={() => navigate('/events')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--white)' }}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 style={{ fontSize: '24px', color: 'var(--primary-dark)', margin: 0 }}>{event.name}</h2>
          <div style={{ fontSize: '14px', color: 'var(--text-mid)', display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
            <Badge variant="neutral">{event.type.replace(/_/g, ' ')}</Badge>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={14} /> {event.date}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><User size={14} /> {event.organiser}</span>
          </div>
        </div>
        <div style={{ flex: 1 }} />
        {!isReadOnly && (
          <Button onClick={() => navigate(`/expenses?event=${event.id}&action=new`)}>Add Expense</Button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '1.5rem' }}>
        <div style={{ flex: 1 }}>
          <Card style={{ padding: '24px', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '16px', marginBottom: '1rem' }}>Budget Overview</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
              <span>Total Spend: GHS {actualSpend}</span>
              <span style={{ color: 'var(--text-mid)' }}>Budget: GHS {event.budget || 'Not set'}</span>
            </div>
            {event.budget && (
              <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--pale-blue)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${Math.min((actualSpend / event.budget) * 100, 100)}%`, height: '100%', backgroundColor: actualSpend > event.budget ? 'var(--danger)' : 'var(--primary-mid)' }} />
              </div>
            )}
            <p style={{ fontSize: '14px', color: 'var(--text-mid)', marginTop: '16px', lineHeight: '1.5' }}>
              {event.description || 'No description provided.'}
            </p>
          </Card>

          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '16px', margin: 0 }}>Event Expenses ({evExpenses.length})</h3>
              <div style={{ fontSize: '13px', color: receiptsAttached < evExpenses.length ? 'var(--warning)' : 'var(--success)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {receiptsAttached < evExpenses.length && <AlertTriangle size={14} />}
                {receiptsAttached} of {evExpenses.length} receipts attached
              </div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--light-blue)', color: 'var(--primary-dark)', fontSize: '12px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 24px' }}>Date</th>
                  <th style={{ padding: '12px 24px' }}>Description</th>
                  <th style={{ padding: '12px 24px' }}>Amount</th>
                  <th style={{ padding: '12px 24px' }}>Receipt</th>
                  <th style={{ padding: '12px 24px', textAlign: 'center' }}>View</th>
                </tr>
              </thead>
              <tbody>
                {evExpenses.map((ex, i) => {
                  const hasReceipt = Boolean(ex.receipt);
                  const isVisible = visibleReceipts.has(ex.id);
                  const isPdf = hasReceipt && ex.receipt.toLowerCase().includes('.pdf');

                  return (
                    <React.Fragment key={ex.id}>
                      <tr style={{ borderBottom: isVisible && hasReceipt ? 'none' : '1px solid var(--border-color)', backgroundColor: i % 2 === 0 ? 'var(--white)' : 'var(--pale-blue)' }}>
                        <td style={{ padding: '16px 24px', fontSize: '14px' }}>{ex.date}</td>
                        <td style={{ padding: '16px 24px', fontSize: '14px' }}>{ex.description}</td>
                        <td style={{ padding: '16px 24px', fontSize: '14px', fontWeight: '500' }}>GHS {Number(ex.amount).toFixed(2)}</td>
                        <td style={{ padding: '16px 24px' }}>
                          {hasReceipt ? <Badge variant="success">Attached</Badge> : <Badge variant="warning">Missing</Badge>}
                        </td>
                        {/* View / toggle column */}
                        <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                          {hasReceipt ? (
                            <button
                              onClick={() => toggleReceiptVisibility(ex.id, ex.receipt)}
                              title={isVisible ? 'Hide receipt' : 'View receipt'}
                              style={{
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                gap: '5px', padding: '5px 12px', borderRadius: '20px', fontSize: '12px',
                                fontWeight: '600', cursor: 'pointer', transition: 'background-color 0.18s ease, color 0.18s ease, border-color 0.18s ease',
                                border: isVisible
                                  ? '1px solid var(--primary-mid)'
                                  : '1px solid var(--border-color)',
                                backgroundColor: isVisible ? 'var(--primary-mid)' : 'transparent',
                                color: isVisible ? 'var(--white)' : 'var(--text-mid)',
                              }}
                              onMouseEnter={e => {
                                if (!isVisible) {
                                  e.currentTarget.style.borderColor = 'var(--primary-mid)';
                                  e.currentTarget.style.color = 'var(--primary-mid)';
                                }
                              }}
                              onMouseLeave={e => {
                                if (!isVisible) {
                                  e.currentTarget.style.borderColor = 'var(--border-color)';
                                  e.currentTarget.style.color = 'var(--text-mid)';
                                }
                              }}
                            >
                              {isVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                              {isVisible ? 'Hide' : 'View'}
                            </button>
                          ) : (
                            <span style={{ fontSize: '12px', color: 'var(--border-color)', userSelect: 'none' }}>—</span>
                          )}
                        </td>
                      </tr>

                      {/* Inline receipt preview row */}
                      {hasReceipt && isVisible && (
                        <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: i % 2 === 0 ? 'var(--white)' : 'var(--pale-blue)' }}>
                          <td colSpan={5} style={{ padding: '0 24px 20px 24px' }}>
                            <div style={{
                              border: '1px solid var(--border-color)', borderRadius: '12px',
                              overflow: 'hidden', backgroundColor: 'var(--pale-blue)',
                              position: 'relative',
                            }}>
                              {/* Preview toolbar */}
                              <div style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '10px 16px', backgroundColor: 'var(--light-blue)',
                                borderBottom: '1px solid var(--border-color)',
                              }}>
                                <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--primary-dark)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <FileText size={13} /> {isPdf ? 'PDF Receipt' : 'Image Receipt'}
                                </span>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                  <a
                                    href={ex.receipt}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{
                                      fontSize: '12px', color: 'var(--primary-mid)', textDecoration: 'none',
                                      padding: '4px 10px', border: '1px solid var(--primary-mid)',
                                      borderRadius: '6px', fontWeight: '500',
                                    }}
                                  >
                                    Open full ↗
                                  </a>
                                  <button
                                    onClick={() => toggleReceiptVisibility(ex.id)}
                                    style={{
                                      background: 'none', border: 'none', cursor: 'pointer',
                                      color: 'var(--text-mid)', display: 'flex', padding: '4px',
                                      borderRadius: '4px',
                                    }}
                                    title="Close preview"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              </div>

                              {/* The receipt itself */}
                              <div style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', maxHeight: '420px', overflow: 'auto' }}>
                                {isPdf ? (
                                  <iframe
                                    src={ex.receipt}
                                    title="Receipt"
                                    style={{ width: '100%', height: '380px', border: 'none', borderRadius: '6px' }}
                                  />
                                ) : (
                                  <img
                                    src={ex.receipt}
                                    alt="Receipt"
                                    onClick={() => setPreviewUrl(ex.receipt)}
                                    style={{
                                      maxWidth: '100%', maxHeight: '380px', objectFit: 'contain',
                                      borderRadius: '8px', boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
                                      cursor: 'zoom-in',
                                    }}
                                    title="Click to enlarge"
                                  />
                                )}
                              </div>
                              {!isPdf && (
                                <div style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-light)', paddingBottom: '10px' }}>
                                  Click image to enlarge
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {evExpenses.length === 0 && (
                  <tr><td colSpan="5" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-mid)' }}>No expenses logged for this event yet.</td></tr>
                )}
              </tbody>
            </table>
          </Card>
        </div>
      </div>
    </div>
  );
}
