import test from 'node:test';
import assert from 'node:assert/strict';
import { createNotificationQueue, NOTIFICATION_EXIT_MS } from '../shared/notifications.mjs';

function clockQueue(options = {}) {
  let clock = 0; let sequence = 0; let current = [];
  const tasks = new Map();
  const queue = createNotificationQueue({ onChange: items => { current = items; }, now: () => clock, setTimer: (fn, delay) => { const id = ++sequence; tasks.set(id, { fn, time: clock + delay }); return id; }, clearTimer: id => tasks.delete(id), ...options });
  queue.start();
  return { queue, current: () => current, tasks, advance(ms) { const end = clock + ms; while (true) { const next = [...tasks.entries()].filter(([, task]) => task.time <= end).sort((a, b) => a[1].time - b[1].time)[0]; if (!next) break; clock = next[1].time; tasks.delete(next[0]); next[1].fn(); } clock = end; } };
}

test('reading lifetimes are eight/ten seconds followed by a retained 300 ms exit', () => {
  const c = clockQueue(); c.queue.notify('Saved', 'success'); c.queue.notify('Storage failed', 'error'); c.advance(7999);
  assert.equal(c.current().length, 2); c.advance(1);
  assert.equal(c.current()[0].stage, 'exiting');
  c.advance(NOTIFICATION_EXIT_MS - 1); assert.equal(c.current().length, 2);
  c.advance(1); assert.deepEqual(c.current().map(item => item.message), ['Storage failed']);
  c.advance(1700); assert.equal(c.current()[0].stage, 'exiting');
  c.advance(NOTIFICATION_EXIT_MS); assert.equal(c.current().length, 0);
});
test('pointer and keyboard focus pause independently and retain remaining reading time', () => {
  const c = clockQueue(); const id = c.queue.notify('Read this'); c.advance(3000); c.queue.pause(id, 'pointer'); c.queue.pause(id, 'focus'); c.advance(20000); c.queue.resume(id, 'pointer'); c.advance(20000);
  assert.equal(c.current().length, 1); c.queue.resume(id, 'focus'); c.advance(4999); assert.notEqual(c.current()[0].stage, 'exiting'); c.advance(1); assert.equal(c.current()[0].stage, 'exiting'); c.advance(NOTIFICATION_EXIT_MS); assert.equal(c.current().length, 0);
});
test('duplicate feedback refreshes one notice and queue caps at three with cleared timers', () => {
  const c = clockQueue(); const id = c.queue.notify('Saved', 'success'); c.advance(7000); assert.equal(c.queue.notify('Saved', 'success'), id); c.advance(2000); assert.equal(c.current().length, 1);
  c.queue.notify('Two'); c.queue.notify('Three'); c.queue.notify('Four');
  assert.equal(c.current().length, 3); assert.equal(c.current()[0].stage, 'exiting');
  assert.equal(c.tasks.size, 3); c.advance(NOTIFICATION_EXIT_MS);
  assert.deepEqual(c.current().map(item => item.message), ['Two', 'Three', 'Four']); assert.equal(c.tasks.size, 3);
});
test('effect stop/start preserves lifetime and creates no duplicate timers', () => {
  const c = clockQueue(); c.queue.notify('Saved'); c.advance(2500); c.queue.stop(); assert.equal(c.tasks.size, 0); c.advance(10000); assert.equal(c.queue.notify('Unmounted'), undefined); c.queue.start(); c.queue.start(); assert.equal(c.tasks.size, 1); c.advance(5499); assert.equal(c.current().length, 1); c.advance(1); assert.equal(c.current()[0].stage, 'exiting'); c.advance(NOTIFICATION_EXIT_MS); assert.equal(c.current().length, 0);
});
test('X dismissal starts exit, ignores repeated dismissal, and invalidates reading timeout', () => {
  const c = clockQueue(); const id = c.queue.notify('Saved'); const stale = [...c.tasks.values()][0].fn;
  c.queue.dismiss(id); assert.equal(c.current()[0].stage, 'exiting'); assert.equal(c.tasks.size, 1);
  c.advance(150); c.queue.dismiss(id); stale();
  c.advance(149); assert.equal(c.current()[0].stage, 'exiting');
  c.advance(1); assert.equal(c.current().length, 0); assert.equal(c.tasks.size, 0);
});
test('a stale timeout cannot expire duplicate feedback whose reading time was refreshed', () => {
  const c = clockQueue(); const id = c.queue.notify('Saved'); const stale = [...c.tasks.values()][0].fn; c.advance(7000); c.queue.notify('Saved'); stale();
  assert.equal(c.current()[0].id, id); assert.equal(c.tasks.size, 1); c.advance(7999); assert.notEqual(c.current()[0].stage, 'exiting'); c.advance(1); assert.equal(c.current()[0].stage, 'exiting'); c.advance(NOTIFICATION_EXIT_MS); assert.equal(c.current().length, 0);
});
test('queue pressure preserves the notification whose close button has keyboard focus', () => {
  const c = clockQueue(); const focused = c.queue.notify('Reading'); c.queue.pause(focused, 'focus'); c.queue.notify('Two'); c.queue.notify('Three'); c.queue.notify('Four');
  assert.equal(c.current().find(item => item.message === 'Two').stage, 'exiting');
  c.advance(NOTIFICATION_EXIT_MS);
  assert.deepEqual(c.current().map(item => item.message), ['Reading', 'Three', 'Four']);
});

test('entry reveals once; portal cleanup preserves stage and remaining reading time', () => {
  const c = clockQueue(); const id = c.queue.notify('Saved');
  assert.equal(c.current()[0].stage, 'entering'); c.queue.reveal(id);
  assert.equal(c.current()[0].stage, 'visible'); c.advance(4000);
  c.queue.pause(id, 'pointer'); c.queue.pause(id, 'focus');
  c.queue.resume(id, 'pointer'); c.queue.resume(id, 'focus'); c.queue.reveal(id);
  assert.equal(c.current()[0].stage, 'visible'); assert.equal(c.tasks.size, 1);
  c.advance(3999); assert.equal(c.current()[0].stage, 'visible'); c.advance(1);
  assert.equal(c.current()[0].stage, 'exiting');
  c.queue.reveal(id); assert.equal(c.current()[0].stage, 'exiting');
});

test('duplicate during exit revives same card and stale exit callback cannot remove it', () => {
  const c = clockQueue(); const id = c.queue.notify('Saved'); c.queue.reveal(id);
  c.queue.dismiss(id); const staleExit = [...c.tasks.values()][0].fn; c.advance(150);
  assert.equal(c.queue.notify('Saved'), id); assert.equal(c.current()[0].stage, 'visible');
  staleExit(); c.advance(300); assert.equal(c.current()[0].id, id); assert.equal(c.tasks.size, 1);
  c.advance(7700); assert.equal(c.current()[0].stage, 'exiting'); c.advance(NOTIFICATION_EXIT_MS);
  assert.equal(c.current().length, 0);
});

test('stop/start also retains exit duration and cancels stale exit callbacks', () => {
  const c = clockQueue(); const id = c.queue.notify('Saved'); c.queue.dismiss(id);
  const staleExit = [...c.tasks.values()][0].fn; c.advance(100); c.queue.stop();
  assert.equal(c.tasks.size, 0); c.advance(10000); staleExit(); assert.equal(c.current()[0].stage, 'exiting');
  c.queue.start(); c.queue.start(); assert.equal(c.tasks.size, 1);
  c.advance(199); assert.equal(c.current().length, 1); c.advance(1); assert.equal(c.current().length, 0);
});

test('reduced motion skips entrance and removes immediately for X and timeout', () => {
  const c = clockQueue({ reducedMotion: () => true }); const id = c.queue.notify('Saved');
  assert.equal(c.current()[0].stage, 'visible'); c.queue.dismiss(id);
  assert.equal(c.current().length, 0); assert.equal(c.tasks.size, 0);
  c.queue.notify('Reading'); c.advance(8000); assert.equal(c.current().length, 0);
  for (const message of ['One', 'Two', 'Three', 'Four']) c.queue.notify(message);
  assert.deepEqual(c.current().map(item => item.message), ['Two', 'Three', 'Four']);
  assert.equal(c.tasks.size, 3);
});

test('burst feedback is bounded and waiting messages receive their full reading time', () => {
  const c = clockQueue(); const snapshots = [];
  for (const message of ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven']) {
    c.queue.notify(message); snapshots.push(c.current().length);
  }
  assert.ok(snapshots.every(count => count <= 3));
  c.advance(NOTIFICATION_EXIT_MS);
  assert.deepEqual(c.current().map(item => item.message), ['Five', 'Six', 'Seven']);
  c.advance(7999); assert.ok(c.current().every(item => item.stage !== 'exiting'));
  c.advance(1); assert.ok(c.current().every(item => item.stage === 'exiting'));
  c.advance(NOTIFICATION_EXIT_MS); assert.equal(c.current().length, 0); assert.equal(c.tasks.size, 0);
});
