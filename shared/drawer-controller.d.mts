export type DrawerStage = 'closed' | 'opening' | 'open' | 'closing';
export type DrawerController = { setOpen(open: boolean): void; dispose(): void };
export function createDrawerController(options: {
  onOpen(): void;
  onClose(restoreFocus: boolean): void;
  onStage(stage: DrawerStage): void;
  requestFrame(callback: () => void): number;
  cancelFrame(id: number): void;
  setTimer(callback: () => void, delay: number): number;
  clearTimer(id: number): void;
  reducedMotion?: () => boolean;
  duration?: number;
}): DrawerController;
export function createBackdropGesture(): { start(outside: boolean, pointerId: number): void; end(outside: boolean, pointerId: number): boolean; cancel(): void };
export function lockScrollablePage(page: HTMLElement | null): () => void;
