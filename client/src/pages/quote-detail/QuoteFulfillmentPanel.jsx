import React, { useMemo, useState } from 'react';

export default function QuoteFulfillmentPanel({
  fulfillment,
  canModify = false,
  onCheckIn,
  onAddNote,
}) {
  const [noteBody, setNoteBody] = useState('');
  const [pendingItemId, setPendingItemId] = useState(null);
  const [draftQuantities, setDraftQuantities] = useState({});
  const items = fulfillment?.items || [];
  const notes = fulfillment?.notes || [];
  const sections = useMemo(() => {
    const map = new Map();
    items.forEach((item) => {
      const key = item.section_title || 'Quote Items';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    });
    return Array.from(map.entries());
  }, [items]);

  async function handleCheckIn(item) {
    setPendingItemId(item.id);
    try {
      await onCheckIn(item.id, { quantity: Number(draftQuantities[item.id] || 1) || 1 });
      setDraftQuantities((current) => ({ ...current, [item.id]: 1 }));
    } finally {
      setPendingItemId(null);
    }
  }

  async function handleAddNote(e) {
    e.preventDefault();
    const body = noteBody.trim();
    if (!body) return;
    await onAddNote({ body });
    setNoteBody('');
  }

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--color-text-muted)' }}>
              Fulfillment
            </div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>Check-In Status</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(110px, 1fr))', gap: 10, width: 'min(100%, 420px)' }}>
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 14, padding: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Total qty</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{fulfillment?.summary?.total_qty || 0}</div>
            </div>
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 14, padding: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Returned</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{fulfillment?.summary?.checked_in_qty || 0}</div>
            </div>
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 14, padding: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Still out</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{fulfillment?.summary?.outstanding_qty || 0}</div>
            </div>
          </div>
        </div>

        {sections.length === 0 ? (
          <div style={{ color: 'var(--color-text-muted)' }}>No fulfillment items yet.</div>
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            {sections.map(([title, sectionItems]) => (
              <section key={title} style={{ border: '1px solid var(--color-border)', borderRadius: 16, overflow: 'hidden' }}>
                <div style={{ padding: '12px 14px', background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)', fontWeight: 700 }}>
                  {title}
                </div>
                <div style={{ display: 'grid', gap: 1, background: 'var(--color-border)' }}>
                  {sectionItems.map((item) => (
                    <div key={item.id} style={{ display: 'grid', gridTemplateColumns: canModify ? 'minmax(0, 1fr) auto auto auto' : 'minmax(0, 1fr) auto auto', gap: 12, alignItems: 'center', background: 'var(--color-surface)', padding: 14 }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{item.item_title}</div>
                        <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                          {item.range_start && item.range_end ? `${item.range_start} - ${item.range_end}` : 'No rental range'}
                        </div>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Out {item.outstanding_qty}/{item.quantity}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: item.status === 'returned' ? 'var(--color-primary)' : 'var(--color-text)' }}>
                        {item.status === 'returned' ? 'Returned' : item.status === 'partial' ? 'Partial' : 'Out'}
                      </div>
                      {canModify && (
                        <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                          <input
                            type="number"
                            min="1"
                            max={Math.max(1, item.outstanding_qty)}
                            value={draftQuantities[item.id] || 1}
                            onChange={(e) => setDraftQuantities((current) => ({ ...current, [item.id]: e.target.value }))}
                            style={{ width: 72 }}
                            disabled={item.outstanding_qty <= 0 || pendingItemId === item.id}
                          />
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            disabled={item.outstanding_qty <= 0 || pendingItemId === item.id}
                            onClick={() => handleCheckIn(item)}
                          >
                            {pendingItemId === item.id ? 'Saving…' : 'Check in'}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>Internal fulfillment notes</div>
        {canModify && (
          <form onSubmit={handleAddNote} style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
            <textarea
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
              placeholder="Add an internal handoff, return, or warehouse note…"
              rows={3}
            />
            <div>
              <button type="submit" className="btn btn-primary btn-sm">Add note</button>
            </div>
          </form>
        )}
        {notes.length === 0 ? (
          <div style={{ color: 'var(--color-text-muted)' }}>No internal notes yet.</div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {notes.map((note) => (
              <div key={note.id} style={{ border: '1px solid var(--color-border)', borderRadius: 14, padding: 14 }}>
                <div style={{ whiteSpace: 'pre-wrap' }}>{note.body}</div>
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--color-text-muted)' }}>
                  {note.first_name || note.last_name
                    ? [note.first_name, note.last_name].filter(Boolean).join(' ')
                    : (note.display_name || note.user_email || 'Staff')}
                  {' • '}
                  {note.created_at ? new Date(note.created_at.replace(' ', 'T') + 'Z').toLocaleString() : '—'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
