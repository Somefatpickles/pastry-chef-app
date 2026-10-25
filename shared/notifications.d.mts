export type NotificationKind = 'success' | 'error' | 'info';
export type NotificationStage = 'entering' | 'visible' | 'exiting';
export type NotificationItem = { id: string; message: string; kind: NotificationKind; stage: NotificationStage };
export const NOTIFICATION_EXIT_MS: 300;
export type NotificationQueue = {
  notify(message: string, kind?: NotificationKind): string | undefined;
  dismiss(id: string): void;
  reveal(id: string): void;
  has(id: string): boolean;
  pause(id: string, reason?: string): void;
  resume(id: string, reason?: string): void;
  start(): void;
  stop(): void;
  isActive(): boolean;
};
export function createNotificationQueue(options: {
  onChange: (items: NotificationItem[]) => void;
  now?: () => number;
  setTimer?: (callback: () => void, delay: number) => unknown;
  clearTimer?: (timer: unknown) => void;
  limit?: number;
  prefix?: string;
  reducedMotion?: () => boolean;
}): NotificationQueue;
