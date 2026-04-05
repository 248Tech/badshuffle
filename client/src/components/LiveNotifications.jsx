import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getToken } from '../api.js';
import styles from './LiveNotifications.module.css';

const LiveNotificationsContext = createContext(null);
const DEFAULT_TRAY_POSITION = 'bottom_right';
const TRAY_POSITIONS = new Set(['top_right', 'top_left', 'bottom_right', 'bottom_left']);
const DEFAULT_ICON_BG_OPACITY = '90';

function playNotificationSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(740, ctx.currentTime);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.035, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.22);
    oscillator.onended = () => ctx.close().catch(() => {});
  } catch {
    // ignore
  }
}

function timeAgo(value) {
  if (!value) return '';
  const date = new Date(String(value).replace(' ', 'T') + 'Z');
  if (Number.isNaN(date.getTime())) return '';
  const diffSec = Math.round((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

function iconForType(type) {
  switch (type) {
    case 'quote_signed': return 'Signed';
    case 'quote_confirmed': return 'Booked';
    case 'quote_sent': return 'Sent';
    case 'quote_created': return 'New';
    case 'project_lost': return 'Lost';
    case 'message_received': return 'Reply';
    case 'message_sent': return 'Note';
    case 'user_online': return 'On';
    case 'user_offline': return 'Off';
    case 'fulfillment_started': return 'Work';
    case 'item_created': return 'Item';
    case 'item_deleted': return 'Gone';
    case 'item_property_updated': return 'Edit';
    case 'file_uploaded': return 'File';
    case 'lead_created': return 'Lead';
    default: return 'Live';
  }
}

export function LiveNotificationsProvider({ children }) {
  const [initialized, setInitialized] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [latestCursor, setLatestCursor] = useState(0);
  const [liveItems, setLiveItems] = useState([]);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [inboxItems, setInboxItems] = useState([]);
  const [loadingInbox, setLoadingInbox] = useState(false);
  const [trayPosition, setTrayPosition] = useState(DEFAULT_TRAY_POSITION);
  const [iconBgOpacity, setIconBgOpacity] = useState(DEFAULT_ICON_BG_OPACITY);
  const dismissTimers = useRef(new Map());

  useEffect(() => {
    return () => {
      dismissTimers.current.forEach((timer) => clearTimeout(timer));
      dismissTimers.current.clear();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      if (!getToken()) {
        if (!cancelled) {
          setInitialized(true);
          setInboxItems([]);
          setLiveItems([]);
          setUnreadCount(0);
          setLatestCursor(0);
        }
        return;
      }
      try {
        const [me, unread] = await Promise.all([
          api.auth.me(),
          api.notifications.unreadCount(),
        ]);
        const settings = await api.getSettings().catch(() => ({}));
        if (cancelled) return;
        setEnabled(Number(me.live_notifications_enabled || 0) === 1);
        setSoundEnabled(Number(me.live_notification_sound_enabled || 0) === 1);
        setUnreadCount(Number(unread.count || 0));
        setLatestCursor(Number(unread.latest_recipient_id || 0));
        setTrayPosition(TRAY_POSITIONS.has(settings.notification_tray_position) ? settings.notification_tray_position : DEFAULT_TRAY_POSITION);
        setIconBgOpacity(String(settings.notification_icon_bg_opacity || DEFAULT_ICON_BG_OPACITY));
      } catch {
        if (!cancelled) {
          setUnreadCount(0);
          setLatestCursor(0);
          setTrayPosition(DEFAULT_TRAY_POSITION);
          setIconBgOpacity(DEFAULT_ICON_BG_OPACITY);
        }
      } finally {
        if (!cancelled) setInitialized(true);
      }
    }
    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleSettingsUpdated = (event) => {
      const next = event?.detail?.settings?.notification_tray_position;
      const nextOpacity = event?.detail?.settings?.notification_icon_bg_opacity;
      setTrayPosition(TRAY_POSITIONS.has(next) ? next : DEFAULT_TRAY_POSITION);
      if (nextOpacity !== undefined) setIconBgOpacity(String(nextOpacity || DEFAULT_ICON_BG_OPACITY));
    };
    window.addEventListener('bs:settings-updated', handleSettingsUpdated);
    return () => {
      window.removeEventListener('bs:settings-updated', handleSettingsUpdated);
    };
  }, []);

  useEffect(() => {
    if (!initialized || !getToken()) return undefined;
    const id = setInterval(async () => {
      if (document.visibilityState === 'hidden') return;
      try {
        const unread = await api.notifications.unreadCount();
        setUnreadCount(Number(unread.count || 0));
        setLatestCursor((current) => current || Number(unread.latest_recipient_id || 0));
      } catch {
        // ignore
      }
    }, 45000);
    return () => clearInterval(id);
  }, [initialized]);

  useEffect(() => {
    if (!initialized || !getToken() || latestCursor == null) return undefined;
    const poll = async () => {
      if (document.visibilityState === 'hidden') return;
      try {
        const feed = await api.notifications.feed(latestCursor, 10);
        const incoming = Array.isArray(feed.notifications) ? feed.notifications : [];
        if (incoming.length > 0) {
          setLatestCursor(Number(feed.latest_recipient_id || incoming[incoming.length - 1].id || latestCursor));
          setUnreadCount((count) => Math.max(count, count + incoming.filter((item) => item.unread).length));
          if (enabled) {
            setLiveItems((current) => {
              const existingIds = new Set(current.map((item) => item.id));
              const next = [...current];
              const fresh = [];
              incoming.forEach((item) => {
                if (existingIds.has(item.id)) return;
                next.push(item);
                fresh.push(item);
                const timer = window.setTimeout(() => {
                  setLiveItems((value) => value.filter((entry) => entry.id !== item.id));
                  dismissTimers.current.delete(item.id);
                }, 5000);
                dismissTimers.current.set(item.id, timer);
              });
              if (fresh.length > 0) {
                api.notifications.markPresented(fresh.map((item) => item.id)).catch(() => {});
                if (soundEnabled) playNotificationSound();
              }
              return next.slice(-4);
            });
          }
        }
      } catch {
        // ignore
      }
    };
    const id = setInterval(poll, 10000);
    return () => clearInterval(id);
  }, [enabled, initialized, latestCursor, soundEnabled]);

  async function refreshInbox() {
    if (!getToken()) return;
    setLoadingInbox(true);
    try {
      const data = await api.notifications.list({ limit: 20 });
      setInboxItems(data.notifications || []);
      const unread = await api.notifications.unreadCount();
      setUnreadCount(Number(unread.count || 0));
    } catch {
      // ignore
    } finally {
      setLoadingInbox(false);
    }
  }

  async function openInbox() {
    setInboxOpen(true);
    await refreshInbox();
  }

  function closeInbox() {
    setInboxOpen(false);
  }

  async function markRead(id) {
    await api.notifications.markRead(id);
    setInboxItems((items) => items.map((item) => item.id === id ? { ...item, unread: false, read_at: new Date().toISOString() } : item));
    setUnreadCount((count) => Math.max(0, count - 1));
  }

  async function markAllRead() {
    await api.notifications.markAllRead();
    setInboxItems((items) => items.map((item) => ({ ...item, unread: false, read_at: item.read_at || new Date().toISOString() })));
    setUnreadCount(0);
  }

  async function dismissInboxItem(id) {
    const dismissedItem = inboxItems.find((item) => item.id === id) || null;
    const unreadRemoved = dismissedItem?.unread ? 1 : 0;
    setInboxItems((items) => items.filter((item) => item.id !== id));
    setLiveItems((items) => items.filter((item) => item.id !== id));
    setUnreadCount((count) => Math.max(0, count - unreadRemoved));
    try {
      await api.notifications.dismiss(id);
    } catch {
      if (dismissedItem) {
        setInboxItems((items) => [dismissedItem, ...items]);
        if (dismissedItem.unread) {
          setUnreadCount((count) => count + 1);
        }
      }
    }
  }

  async function dismissInboxType(type) {
    const normalizedType = String(type || '').trim();
    if (!normalizedType) return;
    const dismissedItems = inboxItems.filter((item) => item.type === normalizedType);
    const unreadRemoved = dismissedItems.filter((item) => item.unread).length;
    setInboxItems((items) => items.filter((item) => item.type !== normalizedType));
    setLiveItems((items) => items.filter((item) => item.type !== normalizedType));
    setUnreadCount((count) => Math.max(0, count - unreadRemoved));
    try {
      await api.notifications.dismissByType(normalizedType);
    } catch {
      if (dismissedItems.length > 0) {
        setInboxItems((items) => [...dismissedItems, ...items]);
        if (unreadRemoved > 0) setUnreadCount((count) => count + unreadRemoved);
      }
    }
  }

  const value = useMemo(() => ({
    unreadCount,
    inboxOpen,
    inboxItems,
    loadingInbox,
    openInbox,
    closeInbox,
    toggleInbox: () => (inboxOpen ? closeInbox() : openInbox()),
    markRead,
    markAllRead,
    dismissInboxItem,
    dismissInboxType,
    refreshInbox,
    trayPosition,
    iconBgOpacity,
  }), [dismissInboxItem, dismissInboxType, iconBgOpacity, inboxItems, inboxOpen, loadingInbox, markAllRead, markRead, trayPosition, unreadCount]);

  const positionClassName = trayPosition === 'top_left'
    ? styles.topLeft
    : trayPosition === 'bottom_left'
      ? styles.bottomLeft
      : trayPosition === 'top_right'
        ? styles.topRight
        : styles.bottomRight;

  return (
    <LiveNotificationsContext.Provider value={value}>
      {children}
      <div className={`${styles.popupStack} ${positionClassName}`} aria-live="polite" aria-atomic="true">
        {liveItems.map((item) => (
          <PopupCard key={item.id} item={item} onDismiss={() => {
            const timer = dismissTimers.current.get(item.id);
            if (timer) clearTimeout(timer);
            dismissTimers.current.delete(item.id);
            setLiveItems((current) => current.filter((entry) => entry.id !== item.id));
          }} />
        ))}
      </div>
      {inboxOpen ? <NotificationInbox positionClassName={positionClassName} /> : null}
    </LiveNotificationsContext.Provider>
  );
}

function PopupCard({ item, onDismiss }) {
  const navigate = useNavigate();
  const startXRef = useRef(0);
  const pointerIdRef = useRef(null);
  const suppressClickRef = useRef(false);
  const [dragX, setDragX] = useState(0);

  function resetDrag() {
    pointerIdRef.current = null;
    setDragX(0);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      className={styles.popupCard}
      style={{
        transform: dragX ? `translateX(${dragX}px)` : undefined,
        opacity: dragX ? Math.max(0.35, 1 - (Math.abs(dragX) / 180)) : undefined,
      }}
      onPointerDown={(event) => {
        pointerIdRef.current = event.pointerId;
        startXRef.current = event.clientX;
        suppressClickRef.current = false;
      }}
      onPointerMove={(event) => {
        if (pointerIdRef.current !== event.pointerId) return;
        const delta = event.clientX - startXRef.current;
        if (Math.abs(delta) > 6) suppressClickRef.current = true;
        setDragX(delta);
      }}
      onPointerUp={(event) => {
        if (pointerIdRef.current !== event.pointerId) return;
        const delta = event.clientX - startXRef.current;
        if (Math.abs(delta) >= 88) {
          onDismiss();
        } else {
          resetDrag();
        }
      }}
      onPointerCancel={resetDrag}
      onClick={() => {
        if (suppressClickRef.current) {
          suppressClickRef.current = false;
          return;
        }
        if (item.href) navigate(item.href);
        onDismiss();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          if (item.href) navigate(item.href);
          onDismiss();
        }
      }}
    >
      <span className={styles.popupIcon}>{iconForType(item.type)}</span>
      <span className={styles.popupBody}>
        <span className={styles.popupTitleRow}>
          <span className={styles.popupTitle}>{item.title}</span>
          <span className={styles.popupTime}>{timeAgo(item.created_at)}{item.exact_time ? ` · ${item.exact_time}` : ''}</span>
        </span>
        {item.body ? <span className={styles.popupText}>{item.body}</span> : null}
      </span>
      <span
        className={styles.popupClose}
        onClick={(event) => {
          event.stopPropagation();
          onDismiss();
        }}
      >
        ×
      </span>
    </div>
  );
}

function NotificationInbox({ positionClassName }) {
  const navigate = useNavigate();
  const { inboxItems, closeInbox, markAllRead, markRead, dismissInboxItem, dismissInboxType, loadingInbox } = useLiveNotifications();
  const isMobile = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 767px)').matches;

  async function openNotification(item) {
    if (item.unread) {
      try { await markRead(item.id); } catch {}
    }
    if (item.href) navigate(item.href);
    closeInbox();
  }

  async function dismissNotification(item) {
    try {
      await dismissInboxItem(item.id);
    } catch {}
  }

  async function dismissNotificationType(item) {
    const count = inboxItems.filter((entry) => entry.type === item.type).length;
    if (count <= 1) return;
    const label = item.title || iconForType(item.type) || 'this notification type';
    const confirmed = window.confirm(`Dismiss all ${count} notifications of this type?\n\n${label}`);
    if (!confirmed) return;
    try {
      await dismissInboxType(item.type);
    } catch {}
  }

  return (
    <>
      <div className={styles.backdrop} onClick={closeInbox} aria-hidden="true" />
      <aside className={`${styles.inbox} ${positionClassName}`} role="dialog" aria-modal="true" aria-label="Notifications">
        <div className={styles.inboxHeader}>
          <div>
            <div className={styles.eyebrow}>Live Feed</div>
            <h3 className={styles.inboxTitle}>Notifications</h3>
          </div>
          <div className={styles.headerActions}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={async () => {
                if (isMobile) {
                  const confirmed = window.confirm('Dismiss all notifications?');
                  if (!confirmed) return;
                  const types = Array.from(new Set(inboxItems.map((item) => item.type).filter(Boolean)));
                  for (const type of types) {
                    // Run sequentially to keep local optimistic state predictable.
                    // The list is small and mobile-only.
                    // eslint-disable-next-line no-await-in-loop
                    await dismissInboxType(type);
                  }
                  return;
                }
                const confirmed = window.confirm('Mark all notifications as read?');
                if (!confirmed) return;
                await markAllRead();
              }}
            >
              {isMobile ? 'Dismiss all' : 'Mark all read'}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={closeInbox}>Close</button>
          </div>
        </div>
        <div className={styles.inboxBody}>
          {loadingInbox ? <div className={styles.empty}>Loading…</div> : null}
          {!loadingInbox && inboxItems.length === 0 ? <div className={styles.empty}>No notifications yet.</div> : null}
          {!loadingInbox && inboxItems.map((item) => (
            <NotificationInboxItem
              key={item.id}
              item={item}
              onOpen={() => openNotification(item)}
              onDismiss={async () => {
                await dismissNotification(item);
              }}
              onLongPress={async () => {
                await dismissNotificationType(item);
              }}
            />
          ))}
        </div>
      </aside>
    </>
  );
}

function NotificationInboxItem({ item, onOpen, onDismiss, onLongPress }) {
  const startXRef = useRef(0);
  const pointerIdRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const suppressClickRef = useRef(false);
  const [dragX, setDragX] = useState(0);
  const [dismissing, setDismissing] = useState(false);
  const [longPressTriggered, setLongPressTriggered] = useState(false);

  function clearLongPressTimer() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  function resetDrag() {
    pointerIdRef.current = null;
    clearLongPressTimer();
    setDragX(0);
  }

  return (
    <button
      type="button"
      className={`${styles.inboxItem} ${item.unread ? styles.unread : ''} ${dismissing ? styles.inboxItemDismissing : ''}`}
      style={{
        transform: dragX ? `translateX(${dragX}px)` : undefined,
        opacity: dragX ? Math.max(0.3, 1 - (Math.abs(dragX) / 180)) : undefined,
      }}
      onPointerDown={(event) => {
        pointerIdRef.current = event.pointerId;
        startXRef.current = event.clientX;
        suppressClickRef.current = false;
        setLongPressTriggered(false);
        clearLongPressTimer();
        if (window.matchMedia && window.matchMedia('(max-width: 767px)').matches) {
          longPressTimerRef.current = window.setTimeout(() => {
            suppressClickRef.current = true;
            setLongPressTriggered(true);
            resetDrag();
            onLongPress?.();
          }, 520);
        }
      }}
      onPointerMove={(event) => {
        if (pointerIdRef.current !== event.pointerId) return;
        const delta = event.clientX - startXRef.current;
        if (Math.abs(delta) > 8) clearLongPressTimer();
        if (Math.abs(delta) > 8) suppressClickRef.current = true;
        setDragX(delta);
      }}
      onPointerUp={(event) => {
        if (pointerIdRef.current !== event.pointerId) return;
        clearLongPressTimer();
        if (longPressTriggered) {
          resetDrag();
          return;
        }
        const delta = event.clientX - startXRef.current;
        if (Math.abs(delta) >= 88) {
          pointerIdRef.current = null;
          suppressClickRef.current = true;
          setDismissing(true);
          setDragX(delta < 0 ? -220 : 220);
          window.setTimeout(() => {
            onDismiss();
          }, 110);
        } else {
          resetDrag();
        }
      }}
      onPointerCancel={resetDrag}
      onClick={() => {
        if (suppressClickRef.current) {
          suppressClickRef.current = false;
          resetDrag();
          return;
        }
        onOpen();
      }}
    >
      <span className={styles.inboxIcon}>{iconForType(item.type)}</span>
      <span className={styles.inboxCopy}>
        <span className={styles.inboxTopRow}>
          <span className={styles.inboxItemTitle}>{item.title}</span>
          <span className={styles.popupTime}>{timeAgo(item.created_at)}{item.exact_time ? ` · ${item.exact_time}` : ''}</span>
        </span>
        {item.body ? <span className={styles.inboxText}>{item.body}</span> : null}
      </span>
    </button>
  );
}

export function NotificationBell({ className = '', compact = false }) {
  const { unreadCount, toggleInbox, iconBgOpacity } = useLiveNotifications();
  return (
    <button
      type="button"
      className={`${styles.bellButton} ${compact ? styles.compact : ''} ${className}`.trim()}
      onClick={toggleInbox}
      aria-label="Open notifications"
      style={{ '--notification-icon-bg-opacity': `${Math.max(30, Math.min(100, Number(iconBgOpacity || DEFAULT_ICON_BG_OPACITY)))}%` }}
    >
      <span className={styles.bellGlyph} aria-hidden="true">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10 21a2 2 0 0 0 4 0" />
        </svg>
      </span>
      {unreadCount > 0 ? <span className={styles.badge}>{unreadCount > 99 ? '99+' : unreadCount}</span> : null}
    </button>
  );
}

export function useLiveNotifications() {
  return useContext(LiveNotificationsContext);
}
