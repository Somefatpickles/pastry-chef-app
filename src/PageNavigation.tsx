import { useEffect, useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { normalizePage, pageLabels, slideOffset, pageOrder, type AppPage } from '../shared/page-navigation.mjs';
import './page-navigation.css';

type Props = {
  activePage: AppPage;
  onNavigate: (page: AppPage) => void;
  pages: Record<AppPage, ReactNode>;
  hasRecipeHeader?: boolean;
};

function PageIcon({ page }: { page: AppPage }) {
  const paths: Record<AppPage, ReactNode> = {
    recipes: <><path d="M4 5.5c3-1.2 5.5-.8 8 1.1 2.5-1.9 5-2.3 8-1.1V19c-3-1.2-5.5-.8-8 1.1C9.5 18.2 7 17.8 4 19z" /><path d="M12 6.6v13.5M7 9h2M7 12h2M15 9h2M15 12h2" /></>,
    current: <><path d="M7 10a3.6 3.6 0 0 1-.3-7.1A5.1 5.1 0 0 1 16 3a3.6 3.6 0 1 1 1 7v10H7z" /><path d="M7 15h10M10 11v2M14 11v2" /></>,
    profile: <><circle cx="12" cy="7.5" r="3.5" /><path d="M4.5 21v-1.5a7.5 7.5 0 0 1 15 0V21" /></>,
    analytics: <><path d="M3 3v18h18M6 18v-4M11 18v-7M16 18v-5M21 18V7" /><path d="m5 10 5-5 5 3 6-5" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[page]}</svg>;
}

export default function AppPages({ activePage, onNavigate, pages, hasRecipeHeader = false }: Props) {
  const active = normalizePage(activePage);
  const panels = useRef<Partial<Record<AppPage, HTMLElement>>>({});
  const navigation = useRef<HTMLElement>(null);

  useEffect(() => {
    // The mounted panel retains its native scroll offset. Focus never scrolls
    // it back to the top, and bottom-navigation keyboard focus stays usable.
    if (navigation.current?.contains(document.activeElement)) return;
    const frame = requestAnimationFrame(() => panels.current[active]?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [active]);

  function navigateWithKeyboard(event: KeyboardEvent<HTMLButtonElement>, page: AppPage) {
    const index = pageOrder.indexOf(page);
    const nextIndex = event.key === 'ArrowRight' ? (index + 1) % pageOrder.length
      : event.key === 'ArrowLeft' ? (index + pageOrder.length - 1) % pageOrder.length
      : event.key === 'Home' ? 0 : event.key === 'End' ? pageOrder.length - 1 : null;
    if (nextIndex === null) return;
    event.preventDefault();
    const next = pageOrder[nextIndex];
    navigation.current?.querySelector<HTMLButtonElement>(`[data-page="${next}"]`)?.focus();
    onNavigate(next);
  }

  return <div className={`app-pages ${hasRecipeHeader ? 'has-recipe-header' : ''}`}>
    <div className="app-page-stage">
      {pageOrder.map(page => {
        const isActive = page === active;
        return <section
          key={page}
          id={`page-${page}`}
          ref={element => { if (element) panels.current[page] = element; }}
          className={`app-page app-page-${page} ${isActive ? 'is-active' : ''}`}
          style={{ '--page-offset': slideOffset(page, active) } as CSSProperties}
          tabIndex={-1}
          inert={!isActive}
          aria-hidden={!isActive}
          aria-label={pageLabels[page]}
        ><div className="app-page-content">{pages[page]}</div></section>;
      })}
    </div>
    <nav className="bottom-navigation" aria-label="Main navigation" ref={navigation}>
      <div className="bottom-navigation-inner">
        {pageOrder.map(page => <button
          key={page}
          type="button"
          data-page={page}
          className={`bottom-navigation-item ${active === page ? 'is-active' : ''}`}
          aria-current={active === page ? 'page' : undefined}
          aria-controls={`page-${page}`}
          onClick={() => onNavigate(page)}
          onKeyDown={event => navigateWithKeyboard(event, page)}
        ><PageIcon page={page} /><span>{pageLabels[page]}</span></button>)}
      </div>
    </nav>
  </div>;
}
