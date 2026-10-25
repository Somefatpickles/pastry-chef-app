import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { createNotificationQueue, type NotificationItem, type NotificationKind, type NotificationQueue } from '../shared/notifications.mjs';
import './notifications.css';

export type { NotificationKind } from '../shared/notifications.mjs';

export function useNotifications() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const prefix = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const origins = useRef(new Map<string, HTMLElement>());
  const focusFrame = useRef<number | null>(null);
  const queue = useRef<NotificationQueue | null>(null);
  if (!queue.current) queue.current = createNotificationQueue({
    prefix: `notice-${prefix}`,
    reducedMotion: () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    onChange(items) {
      for (const id of origins.current.keys()) if (!queue.current!.has(id)) origins.current.delete(id);
      setNotifications(items);
    },
  });

  useEffect(() => {
    queue.current!.start();
    return () => {
      queue.current!.stop();
      if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current);
    };
  }, []);

  const notify = useCallback((message: string, kind: NotificationKind = 'info') => {
    const id = queue.current!.notify(message, kind);
    if (id && document.activeElement instanceof HTMLElement) origins.current.set(id, document.activeElement);
    return id;
  }, []);
  const dismiss = useCallback((id: string) => {
    const focused = document.activeElement instanceof HTMLElement && document.activeElement.closest(`[data-notification-id="${id}"]`);
    const origin = origins.current.get(id);
    queue.current!.dismiss(id);
    if (!focused) return;
    if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current);
    focusFrame.current = requestAnimationFrame(() => {
      focusFrame.current = null;
      if (!queue.current!.isActive()) return;
      const current = document.activeElement;
      if (current instanceof HTMLElement && current !== document.body && current.isConnected && !current.closest(`[data-notification-id="${id}"]`)) return;
      const modal = activeModal();
      if (origin?.isConnected && origin !== document.body && !origin.closest('[inert], [aria-hidden="true"]') && origin.getClientRects().length && (!modal || modal.contains(origin))) origin.focus({ preventScroll: true });
      else (modal?.querySelector<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex]') ?? document.querySelector<HTMLElement>('.welcome-screen .start-button:not(:disabled), .app-page.is-active'))?.focus({ preventScroll: true });
    });
  }, []);
  const pause = useCallback((id: string, reason?: string) => queue.current!.pause(id, reason), []);
  const resume = useCallback((id: string, reason?: string) => queue.current!.resume(id, reason), []);
  const reveal = useCallback((id: string) => queue.current!.reveal(id), []);
  return { notifications, notify, dismiss, pause, resume, reveal };
}

function activeModal(): HTMLDialogElement | null {
  try { return [...document.querySelectorAll<HTMLDialogElement>('dialog:modal')].at(-1) ?? null; }
  catch { return [...document.querySelectorAll<HTMLDialogElement>('dialog[open]')].at(-1) ?? null; }
}

type Props = {
  notifications: NotificationItem[];
  dismiss: (id: string) => void;
  pause: (id: string, reason?: string) => void;
  resume: (id: string, reason?: string) => void;
  reveal: (id: string) => void;
  layerKey?: unknown;
};

export default function Notifications({ notifications, dismiss, pause, resume, reveal, layerKey }: Props) {
  const [host, setHost] = useState<HTMLElement | null>(() => typeof document === 'undefined' ? null : document.body);
  useLayoutEffect(() => {
    const update = () => setHost(activeModal() ?? document.body);
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['open'] });
    return () => observer.disconnect();
  }, [layerKey]);
  if (!host || !notifications.length) return null;

  // A portal inside the current modal shares its top layer and its focus boundary.
  // A body z-index alone would leave the notifications behind a native dialog.
  return createPortal(<section className="notification-stack" aria-label="Notifications" data-notification-layer={host instanceof HTMLDialogElement ? 'dialog' : 'page'}>
    {notifications.map(item => <NotificationCard key={item.id} item={item} dismiss={dismiss} pause={pause} resume={resume} reveal={reveal} />)}
  </section>, host);
}

function NotificationCard({ item, dismiss, pause, resume, reveal }: { item: NotificationItem; dismiss: Props['dismiss']; pause: Props['pause']; resume: Props['resume']; reveal: Props['reveal'] }) {
  useEffect(() => () => { resume(item.id, 'pointer'); resume(item.id, 'focus'); }, [item.id, resume]);
  useLayoutEffect(() => {
    if (item.stage !== 'entering') return;
    let secondFrame: number | undefined;
    const firstFrame = requestAnimationFrame(() => { secondFrame = requestAnimationFrame(() => reveal(item.id)); });
    return () => { cancelAnimationFrame(firstFrame); if (secondFrame !== undefined) cancelAnimationFrame(secondFrame); };
  }, [item.id, item.stage, reveal]);
  const exiting = item.stage === 'exiting';
  return <div className={`action-notification notification-${item.kind}`} data-notification-id={item.id} data-stage={item.stage} role={item.kind === 'error' ? 'alert' : 'status'} aria-atomic="true" inert={exiting} aria-hidden={exiting || undefined}
    onPointerEnter={() => pause(item.id, 'pointer')} onPointerLeave={() => resume(item.id, 'pointer')}
    onFocusCapture={() => pause(item.id, 'focus')} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) resume(item.id, 'focus'); }}>
    <p>{item.message}</p>
    <button type="button" className="notification-dismiss" aria-label="Dismiss notification" disabled={exiting} onClick={() => dismiss(item.id)}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
    </button>
  </div>;
}
