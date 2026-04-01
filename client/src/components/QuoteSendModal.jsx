import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function QuoteSendModal({ quote, onClose, onSent, onError, classNames = {} }) {
  const [templates, setTemplates] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [toEmail, setToEmail] = useState(quote?.client_email || '');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [allFiles, setAllFiles] = useState([]);
  const [attachmentIds, setAttachmentIds] = useState([]);

  useEffect(() => {
    api
      .getTemplates()
      .then((d) => {
        const list = d.templates || [];
        setTemplates(list);
        const defaultT = list.find((t) => t.is_default);
        if (defaultT) {
          setSelectedId(String(defaultT.id));
          api
            .getTemplate(defaultT.id)
            .then((t) => {
              setSubject(t.subject || '');
              setBody(t.body_text || t.body_html || '');
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
    api
      .getFiles()
      .then(async (d) => {
        const list = d.files || [];
        setAllFiles(list);
        await api.prefetchFileServeUrls(list.map((f) => f.id));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setToEmail(quote?.client_email || '');
  }, [quote?.client_email]);

  const loadTemplate = (id) => {
    if (!id) return;
    api
      .getTemplate(id)
      .then((t) => {
        setSubject(t.subject || '');
        setBody(t.body_text || t.body_html || '');
      })
      .catch(() => {});
  };

  function toggleAttachment(id) {
    setAttachmentIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const handleSend = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      await api.sendQuote(quote.id, {
        templateId: selectedId || undefined,
        subject,
        bodyText: body,
        bodyHtml: body,
        toEmail: toEmail || undefined,
        attachmentIds,
      });
      onSent();
    } catch (err) {
      onError(err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className={classNames.modalOverlay}
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <div
        className={classNames.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="send-modal-title"
      >
        <h3 className={classNames.modalTitle} id="send-modal-title">Send quote to client</h3>
        <form onSubmit={handleSend} className={classNames.sendForm}>
          <div className="form-group">
            <label htmlFor="send-to">To</label>
            <input
              id="send-to"
              type="email"
              required
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              placeholder="client@example.com"
            />
          </div>
          <div className="form-group">
            <label htmlFor="send-template">Template</label>
            <select
              id="send-template"
              value={selectedId}
              onChange={(e) => {
                setSelectedId(e.target.value);
                loadTemplate(e.target.value);
              }}
            >
              <option value="">— None —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.is_default ? ' (default)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="send-subject">Subject</label>
            <input id="send-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Quote from..." />
          </div>
          <div className="form-group">
            <label htmlFor="send-body">Body</label>
            <textarea
              id="send-body"
              rows={6}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Email body..."
            />
          </div>
          {allFiles.length > 0 && (
            <div className="form-group" role="group" aria-labelledby="qs-attach-label">
              <label id="qs-attach-label">Attachments</label>
              <div className={classNames.attachmentGrid}>
                {allFiles.map((f) => {
                  const isImg = f.mime_type && f.mime_type.startsWith('image/');
                  const selected = attachmentIds.includes(f.id);
                  return (
                    <button
                      key={f.id}
                      type="button"
                      className={`${classNames.attachThumb} ${selected ? classNames.attachSelected : ''}`}
                      onClick={() => toggleAttachment(f.id)}
                      title={f.original_name}
                    >
                      {isImg ? (
                        <img
                          src={api.fileServeUrl(f.id, { variant: 'thumb' })}
                          alt={f.original_name}
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      ) : (
                        <span style={{ fontSize: 24 }} aria-hidden="true">📎</span>
                      )}
                      <span className={classNames.attachName}>{f.original_name}</span>
                      {selected && <span className={classNames.attachCheck} aria-hidden="true">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className={classNames.formActions}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={sending}>
              {sending ? 'Sending…' : 'Send'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
