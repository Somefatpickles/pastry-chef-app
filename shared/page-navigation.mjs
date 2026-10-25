export const pageOrder = Object.freeze(['recipes', 'current', 'profile', 'analytics']);
export const pageLabels = Object.freeze({ recipes: 'Recipe List', current: 'Current Recipe', profile: 'Profile', analytics: 'Analytics' });

export function normalizePage(value) {
  return pageOrder.includes(value) ? value : 'recipes';
}

export function pageFromHash(hash) {
  if (typeof hash !== 'string') return 'recipes';
  return normalizePage(hash.replace(/^#\/?/, ''));
}

export function pageHash(page) {
  return `#${normalizePage(page)}`;
}

export function pageOffset(page, activePage) {
  return pageOrder.indexOf(normalizePage(page)) - pageOrder.indexOf(normalizePage(activePage));
}

// Nonadjacent destinations enter from the nearest edge. Travelling multiple full
// widths would expose the hidden middle page as a gap during the transition.
export function slideOffset(page, activePage) {
  return Math.sign(pageOffset(page, activePage));
}

export function transitionDirection(previousPage, nextPage) {
  const change = pageOffset(nextPage, previousPage);
  return change > 0 ? 'forward' : change < 0 ? 'backward' : 'none';
}
