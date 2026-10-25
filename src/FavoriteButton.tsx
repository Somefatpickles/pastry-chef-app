import './favorites.css';

type Props = {
  favorite: boolean;
  onToggle: () => void;
  recipeTitle: string;
  className?: string;
};

export function FavoriteButton({ favorite, onToggle, recipeTitle, className = '' }: Props) {
  return <button
    type="button"
    className={`favorite-button ${favorite ? 'is-favorite' : ''} ${className}`.trim()}
    aria-pressed={favorite}
    aria-label={`${favorite ? 'Unfavorite' : 'Favorite'} ${recipeTitle}`}
    title={favorite ? 'Remove from favorites' : 'Add to favorites'}
    onClick={event => { event.stopPropagation(); onToggle(); }}
  >
    <svg viewBox="0 0 24 24" fill={favorite ? '#e9ae38' : 'none'} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m12 3 2.78 5.63 6.22.91-4.5 4.39 1.06 6.2L12 17.2l-5.56 2.93 1.06-6.2L3 9.54l6.22-.91L12 3Z" /></svg>
  </button>;
}

export default FavoriteButton;
