import test from 'node:test';
import assert from 'node:assert/strict';
import { createBackdropGesture, createDrawerController, lockScrollablePage } from '../shared/drawer-controller.mjs';

function fixture(reduced = false) {
  let counter = 0;
  const frames = new Map(); const timers = new Map(); const canceled = new Set(); const events = [];
  const controller = createDrawerController({
    onOpen: () => events.push('show'), onClose: restore => events.push(restore ? 'close+restore' : 'dispose'), onStage: stage => events.push(stage),
    requestFrame: callback => { const id = ++counter; frames.set(id, callback); return id; },
    cancelFrame: id => canceled.add(id), setTimer: callback => { const id = ++counter; timers.set(id, callback); return id; },
    clearTimer: id => canceled.add(id), reducedMotion: () => reduced,
  });
  function flushFrames() { for (const [id, callback] of [...frames]) { frames.delete(id); if (!canceled.has(id)) callback(); } }
  return { controller, frames, timers, events, canceled, flushFrames };
}

test('checkbox/progress rerenders do not reopen, refocus, or restart a visible drawer', () => {
  const f = fixture(); f.controller.setOpen(true); f.flushFrames(); f.flushFrames();
  const before = [...f.events];
  for (let n = 0; n < 20; n++) f.controller.setOpen(true);
  assert.deepEqual(f.events, before);
  assert.deepEqual(f.events, ['opening', 'show', 'open']);
});

test('closing before opening frames settle ignores even a stale canceled opening callback', () => {
  const f = fixture(); f.controller.setOpen(true);
  const staleOpening = [...f.frames.values()][0];
  f.controller.setOpen(false); staleOpening();
  assert.deepEqual(f.events, ['opening', 'show', 'closing']);
  [...f.timers.values()][0]();
  assert.deepEqual(f.events.slice(-2), ['close+restore', 'closed']);
});

test('a close/reopen cannot be closed by the previous transition timer', () => {
  const f = fixture(); f.controller.setOpen(true); f.flushFrames(); f.flushFrames();
  f.controller.setOpen(false); const staleClose = [...f.timers.values()][0];
  f.controller.setOpen(true); staleClose();
  assert.equal(f.events.at(-1), 'open');
  assert.equal(f.events.filter(event => event === 'show').length, 1);
  assert.equal(f.events.filter(event => event === 'close+restore').length, 0);
  f.controller.setOpen(false); [...f.timers.values()].at(-1)();
  assert.equal(f.events.filter(event => event === 'close+restore').length, 1);
});

test('reduced motion and disposal have deterministic close behavior without stale work', () => {
  const f = fixture(true); f.controller.setOpen(true); f.controller.setOpen(false);
  assert.deepEqual(f.events, ['open', 'show', 'close+restore', 'closed']);
  assert.equal(f.frames.size, 0); assert.equal(f.timers.size, 0);
  const g = fixture(); g.controller.setOpen(true); const stale = [...g.frames.values()][0];
  g.controller.dispose(); g.controller.dispose(); stale(); g.controller.setOpen(true);
  assert.deepEqual(g.events, ['opening', 'show', 'dispose']);
});

test('only an entire pointer gesture on the backdrop dismisses the drawer', () => {
  const gesture = createBackdropGesture();
  gesture.start(false, 1); assert.equal(gesture.end(true, 1), false, 'list-to-backdrop drag stays open');
  gesture.start(true, 1); assert.equal(gesture.end(false, 1), false, 'backdrop-to-list drag stays open');
  gesture.start(true, 1); assert.equal(gesture.end(true, 2), false, 'another pointer does not dismiss');
  gesture.start(true, 1); gesture.cancel(); assert.equal(gesture.end(true, 1), false);
  gesture.start(true, 1); assert.equal(gesture.end(true, 1), true);
  assert.equal(gesture.end(true, 1), false, 'synthetic or repeated clicks do not dismiss');
});

test('the recipe page remains locked until close and returns to the exact prior scroll offset', () => {
  const page = { style: { overflowY: 'auto', overflowX: 'hidden', overflowAnchor: 'auto' }, scrollTop: 1700, scrollLeft: 0 };
  const release = lockScrollablePage(page);
  assert.equal(page.style.overflowY, 'hidden');
  assert.equal(page.style.overflowX, 'hidden');
  assert.equal(page.style.overflowAnchor, 'none', 'background content updates cannot scroll-anchor the locked page');
  page.scrollTop = 0; release();
  assert.equal(page.scrollTop, 1700); assert.equal(page.style.overflowY, 'auto');
  assert.equal(page.style.overflowAnchor, 'auto');
  page.scrollTop = 900; release(); assert.equal(page.scrollTop, 900, 'cleanup is idempotent');
});
