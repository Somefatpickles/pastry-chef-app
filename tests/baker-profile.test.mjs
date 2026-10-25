import test from 'node:test';
import assert from 'node:assert/strict';
import { firstNameStorageKey, loadFirstName, hasFirstNameEntry, saveFirstName } from '../src/bakerProfile.ts';

function withStorage(action) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: storage });
  try { action(values, storage); }
  finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  }
}

test('guest first names survive serialized storage and repeated reads', () => withStorage(values => {
  assert.equal(loadFirstName(), '');
  assert.equal(hasFirstNameEntry(), false);
  assert.equal(saveFirstName('  Zoë   Anne  '), 'Zoë Anne');
  assert.deepEqual(JSON.parse(values.get(firstNameStorageKey())), { version: 1, firstName: 'Zoë Anne' });
  assert.equal(loadFirstName(), 'Zoë Anne');
  assert.equal(loadFirstName(null), 'Zoë Anne');
  assert.equal(hasFirstNameEntry(), true);
}));

test('guest and account names stay isolated when accounts switch', () => withStorage(() => {
  saveFirstName('Guest');
  saveFirstName('Alice', 'uid-a');
  saveFirstName('Bob', 'uid-b');
  assert.equal(loadFirstName(), 'Guest');
  assert.equal(loadFirstName('uid-a'), 'Alice');
  assert.equal(loadFirstName('uid-b'), 'Bob');
  assert.equal(loadFirstName('uid-c'), '');
  assert.equal(hasFirstNameEntry('uid-c'), false);
  assert.notEqual(firstNameStorageKey(), firstNameStorageKey('guest'));
  assert.notEqual(firstNameStorageKey('a/b'), firstNameStorageKey('a%2Fb'));
  assert.notEqual(firstNameStorageKey('uid-a '), firstNameStorageKey('uid-a'));
}));

test('clearing a name remains an explicit value and does not affect other identities', () => withStorage(() => {
  saveFirstName('Maya', 'uid-a');
  saveFirstName('Guest');
  assert.equal(saveFirstName('   ', 'uid-a'), '');
  assert.equal(loadFirstName('uid-a'), '');
  assert.equal(hasFirstNameEntry('uid-a'), true);
  assert.equal(loadFirstName(), 'Guest');
}));

test('corrupt or unsupported records do not crash or masquerade as a deliberate clear', () => withStorage(values => {
  for (const raw of ['{broken', 'null', '[]', '"Maya"', '{"version":1,"firstName":null}', '{"version":2,"firstName":"Maya"}']) {
    values.set(firstNameStorageKey('uid-a'), raw);
    assert.equal(loadFirstName('uid-a'), '');
    assert.equal(hasFirstNameEntry('uid-a'), false);
  }
  values.set(firstNameStorageKey('uid-a'), JSON.stringify({ version: 1, firstName: 'Maya'.repeat(40) }));
  assert.equal(Array.from(loadFirstName('uid-a')).length, 60);
}));

test('blocked storage reads recover while save failures propagate to the caller', () => withStorage((values, storage) => {
  storage.getItem = () => { throw new Error('Storage blocked'); };
  assert.equal(loadFirstName('uid-a'), '');
  assert.equal(hasFirstNameEntry('uid-a'), false);
  storage.setItem = () => { throw new Error('Storage full'); };
  assert.throws(() => saveFirstName('Maya', 'uid-a'), /Storage full/);
  assert.equal(values.size, 0);
}));
