import type { Recipe, RecipeProgress } from './types';
import FavoriteButton from './FavoriteButton';
import './recipe-card.css';

type Props = {
  recipe: Recipe;
  progress?: RecipeProgress;
  selected: boolean;
  artworkId?: string;
  isFavorite: boolean;
  onToggleFavorite: (recipe: Recipe) => void;
  onSelect: (recipe: Recipe) => void;
};

export default function RecipeCard({ recipe, progress, selected, artworkId, isFavorite, onToggleFavorite, onSelect }: Props) {
  return <article className={`recipe-card ${artworkId ? 'recipe-card-with-art ' : ''}${selected ? 'active ' : ''}${progress?.completedAt ? 'completed' : ''}`} data-recipe-id={recipe.id} onClick={() => onSelect(recipe)}>
    {artworkId && <img className="recipe-card-image" data-recipe-image={artworkId} src={`/recipe-images/${artworkId}-320.webp`} width="320" height="200" alt="" loading="lazy" decoding="async" />}
    <div className="recipe-card-body">
      <div className="recipe-card-top"><span className="recipe-category">{recipe.category ?? 'My recipe'}</span><span className="recipe-meta">{recipe.difficulty}</span></div>
      <div className="recipe-card-title-row">
        <button type="button" className="recipe-card-select" aria-pressed={selected} onClick={event => { event.stopPropagation(); onSelect(recipe); }}><strong>{recipe.title}</strong></button>
        <FavoriteButton favorite={isFavorite} onToggle={() => onToggleFavorite(recipe)} recipeTitle={recipe.title} className="recipe-card-favorite" />
      </div>
      <p>{recipe.blurb}</p>
      <div className="recipe-card-footer"><span>{recipe.time}</span><span>{recipe.yield}</span>{progress?.completedAt && <span className="recipe-card-completed">Completed ✓</span>}</div>
    </div>
  </article>;
}
