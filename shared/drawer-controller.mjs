// One owner for animation work: stale frames and closing timers can never
// change a drawer whose requested state has since changed.
export function createDrawerController({ onOpen, onClose, onStage, requestFrame, cancelFrame, setTimer, clearTimer, reducedMotion = () => false, duration = 240 }) {
  let desired = false;
  let visible = false;
  let disposed = false;
  let revision = 0;
  let frame;
  let timer;

  function cancelScheduled() {
    if (frame !== undefined) cancelFrame(frame);
    if (timer !== undefined) clearTimer(timer);
    frame = undefined;
    timer = undefined;
  }

  function finishClose(version) {
    if (disposed || desired || version !== revision || !visible) return;
    cancelScheduled();
    visible = false;
    onClose(true);
    onStage('closed');
  }

  function setOpen(next) {
    if (disposed) return;
    next = Boolean(next);
    if (next === desired) return;
    desired = next;
    const version = ++revision;
    cancelScheduled();
    if (next) {
      if (visible) { onStage('open'); return; }
      visible = true;
      onStage(reducedMotion() ? 'open' : 'opening');
      onOpen();
      if (!reducedMotion()) frame = requestFrame(() => {
        if (disposed || !desired || version !== revision) return;
        frame = requestFrame(() => {
          frame = undefined;
          if (!disposed && desired && version === revision) onStage('open');
        });
      });
    } else if (visible) {
      if (reducedMotion()) finishClose(version);
      else { onStage('closing'); timer = setTimer(() => finishClose(version), duration); }
    }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    revision++;
    cancelScheduled();
    if (visible) { visible = false; onClose(false); }
  }

  return { setOpen, dispose };
}

// A drag from a checkbox/list to the backdrop is not a backdrop click.
export function createBackdropGesture() {
  let startedOutside = null;
  return {
    start(outside, pointerId) { startedOutside = outside ? pointerId : null; },
    end(outside, pointerId) {
      const close = outside && startedOutside !== null && startedOutside === pointerId;
      startedOutside = null;
      return close;
    },
    cancel() { startedOutside = null; },
  };
}

export function lockScrollablePage(page) {
  if (!page) return () => {};
  const overflowY = page.style.overflowY;
  const overflowAnchor = page.style.overflowAnchor ?? '';
  const top = page.scrollTop;
  const left = page.scrollLeft;
  page.style.overflowY = 'hidden';
  page.style.overflowAnchor = 'none';
  let locked = true;
  return () => {
    if (!locked) return;
    locked = false;
    page.style.overflowY = overflowY;
    page.style.overflowAnchor = overflowAnchor;
    page.scrollTop = top;
    page.scrollLeft = left;
  };
}
