import test from 'node:test';
import assert from 'node:assert/strict';
import { chefPromptSuggestions, chooseChefPrompts } from '../shared/chef-prompts.mjs';

test('the Chef offers twelve distinct standard-measurement baking requests', () => {
  assert.equal(chefPromptSuggestions.length, 12);
  assert.equal(new Set(chefPromptSuggestions).size, 12);
  for (const suggestion of chefPromptSuggestions) {
    assert.ok(typeof suggestion === 'string' && suggestion.trim());
    assert.doesNotMatch(suggestion, /\b(?:grams?|kilograms?|millilit(?:er|re)s?|lit(?:er|re)s?|mL|kg)\b/);
  }
});

test('selection presents three unique requests and a placeholder from the displayed trio without mutating the pool', () => {
  const original = [...chefPromptSuggestions];
  for (const random of [() => 0, () => .5, () => .999999999]) {
    const selection = chooseChefPrompts(random);
    assert.equal(selection.suggestions.length, 3);
    assert.equal(new Set(selection.suggestions).size, 3);
    assert.ok(selection.suggestions.every(item => chefPromptSuggestions.includes(item)));
    assert.ok(selection.suggestions.includes(selection.placeholder));
  }
  assert.deepEqual(chefPromptSuggestions, original);
});
