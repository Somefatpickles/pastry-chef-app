export function availableCategories(recipes, difficulty = 'All levels') {
  return [...new Set(recipes.filter(recipe => difficulty === 'All levels' || recipe.difficulty === difficulty).map(recipe => recipe.category).filter(category => typeof category === 'string' && category.length > 0))];
}

export function normalizeCategory(recipes, difficulty, category) {
  return category === 'All categories' || availableCategories(recipes, difficulty).includes(category) ? category : 'All categories';
}

export function matchesRecipeFilters(recipe, { category = 'All categories', difficulty = 'All levels', search = '', status = 'All', favorites = 'All', completed = false, favorite = false } = {}) {
  return (category === 'All categories' || recipe.category === category)
    && (difficulty === 'All levels' || recipe.difficulty === difficulty)
    && (status !== 'Completed' || completed)
    && (status !== 'Not Completed' || !completed)
    && (favorites !== 'Favorites Only' || favorite)
    && `${recipe.title} ${recipe.blurb} ${recipe.ingredients.map(item => item.name).join(' ')}`.toLowerCase().includes(search.trim().toLowerCase());
}
