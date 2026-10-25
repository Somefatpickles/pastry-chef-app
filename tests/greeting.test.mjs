import test from 'node:test';
import assert from 'node:assert/strict';
import { greeting, normalizeFirstName } from '../shared/greeting.mjs';

test('named guests and signed-in bakers receive the requested personal greeting', () => {
  assert.equal(greeting({ firstName: 'Maya', signedIn: false }), 'Welcome back, Maya!');
  assert.equal(greeting({ firstName: '  Élodie  ', signedIn: true }), 'Welcome back, Élodie!');
  assert.equal(greeting({ firstName: "Anne-Marie O’Neil" }), 'Welcome back, Anne-Marie O’Neil!');
});

test('signed-in bakers without a first name receive the generic return greeting', () => {
  for (const firstName of [undefined, null, '', '  ', 123]) assert.equal(greeting({ firstName, signedIn: true }), 'Welcome back!');
});

test('a new guest with no name keeps the original introduction', () => {
  assert.equal(greeting(), null);
  assert.equal(greeting({}), null);
  assert.equal(greeting({ firstName: '\n\t ', signedIn: false }), null);
});

test('first names preserve Unicode and punctuation, remove accidental spacing and bound length safely', () => {
  assert.equal(normalizeFirstName(" \tAna\n  María O'Neil-Smith \u0000 "), "Ana María O'Neil-Smith");
  assert.equal(normalizeFirstName(123), '');
  assert.equal(normalizeFirstName(null), '');
  const limited = normalizeFirstName('😀'.repeat(61));
  assert.equal(Array.from(limited).length, 60);
  assert.equal(limited, '😀'.repeat(60));
});
