import test from 'node:test';
import assert from 'node:assert/strict';
import { pageOrder, pageLabels, normalizePage, pageFromHash, pageHash, pageOffset, slideOffset, transitionDirection } from '../shared/page-navigation.mjs';

test('all four named pages round-trip through a shareable fragment', () => {
  assert.deepEqual(pageOrder, ['recipes', 'current', 'profile', 'analytics']);
  assert.deepEqual(pageOrder.map(page => pageLabels[page]), ['Recipe List', 'Current Recipe', 'Profile', 'Analytics']);
  for (const page of pageOrder) {
    assert.equal(pageFromHash(pageHash(page)), page);
    assert.equal(pageFromHash(`#/${page}`), page);
  }
});

test('unknown fragments and nonstring inputs safely return the recipe list', () => {
  for (const value of ['', '#', '#settings', '#current?secret=anything', '#//current', null, {}, undefined]) assert.equal(pageFromHash(value), 'recipes');
  for (const value of ['CURRENT', 1, null, {}, 'profile/extra']) assert.equal(normalizePage(value), 'recipes');
  assert.equal(pageHash('invalid'), '#recipes');
});

test('page positions slide forward and backward while the active page always sits at zero', () => {
  assert.deepEqual(pageOrder.map(page => pageOffset(page, 'recipes')), [0, 1, 2, 3]);
  assert.deepEqual(pageOrder.map(page => pageOffset(page, 'current')), [-1, 0, 1, 2]);
  assert.deepEqual(pageOrder.map(page => pageOffset(page, 'profile')), [-2, -1, 0, 1]);
  assert.deepEqual(pageOrder.map(page => pageOffset(page, 'analytics')), [-3, -2, -1, 0]);
  assert.equal(transitionDirection('recipes', 'profile'), 'forward');
  assert.equal(transitionDirection('profile', 'current'), 'backward');
  assert.equal(transitionDirection('current', 'current'), 'none');
  assert.equal(transitionDirection('profile', 'analytics'), 'forward');
  assert.equal(transitionDirection('analytics', 'recipes'), 'backward');
});

test('even nonadjacent destinations slide only one viewport so the hidden middle page cannot create a gap', () => {
  assert.equal(slideOffset('profile', 'recipes'), 1);
  assert.equal(slideOffset('recipes', 'profile'), -1);
  assert.equal(pageOffset('profile', 'recipes'), 2, 'route distance remains distinct from visual displacement');
  assert.equal(slideOffset('analytics', 'recipes'), 1);
  assert.equal(slideOffset('recipes', 'analytics'), -1);
  assert.equal(pageOffset('analytics', 'recipes'), 3);
  for (const previous of pageOrder) for (const next of pageOrder) {
    assert.ok(Math.abs(slideOffset(next, previous)) <= 1);
    assert.equal(slideOffset(next, next), 0);
    if (previous !== next) assert.equal(slideOffset(next, previous), -slideOffset(previous, next));
  }
});
