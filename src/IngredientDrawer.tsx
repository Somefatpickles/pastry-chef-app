import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { displayIngredientAmount } from '../shared/baking-measures.mjs';
import { createBackdropGesture, createDrawerController, lockScrollablePage, type DrawerController, type DrawerStage } from '../shared/drawer-controller.mjs';
import type { RecipeChanges } from '../shared/recipe-changes.mjs';
import type { Recipe, RecipeProgress } from './types';
import './ingredient-drawer.css';

type Props = {
  open: boolean;
  onClose: () => void;
  recipe: Recipe | null;
  progress: RecipeProgress | null;
  onToggle: (ingredientId: string) => void;
  changes?: RecipeChanges;
  batchControls?: ReactNode;
  batchGuidance?: ReactNode;
  saveControls?: ReactNode;
};

export default function IngredientDrawer({ open, onClose, recipe, progress, onToggle, changes, batchControls, batchGuidance, saveControls }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const recipeIdRef = useRef<string | null>(null);
  const lastOpenedRecipeRef = useRef<string | null>(null);
  recipeIdRef.current = recipe?.id ?? null;
  const controllerRef = useRef<DrawerController | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const unlockRef = useRef<() => void>(() => {});
  const backdropRef = useRef(createBackdropGesture());
  const desiredRef = useRef(false);
  desiredRef.current = open && Boolean(recipe);
  const [stage, setStage] = useState<DrawerStage>('closed');

  useEffect(() => {
    const controller = createDrawerController({
      onOpen() {
        const dialog = dialogRef.current;
        if (!dialog) return;
        returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        unlockRef.current = lockScrollablePage(document.querySelector<HTMLElement>('.app-page-current'));
        backdropRef.current.cancel();
        if (!dialog.open) dialog.showModal();
        // The dialog is a viewport overlay, never a scroller. The list below
        // owns scrolling; focusing an offscreen animated control must not pan it.
        dialog.scrollTop = 0;
        dialog.scrollLeft = 0;
        if (lastOpenedRecipeRef.current !== recipeIdRef.current) {
          if (listRef.current) listRef.current.scrollTop = 0;
          lastOpenedRecipeRef.current = recipeIdRef.current;
        }
        closeButtonRef.current?.focus({ preventScroll: true });
      },
      onClose(restoreFocus) {
        dialogRef.current?.close();
        unlockRef.current();
        unlockRef.current = () => {};
        backdropRef.current.cancel();
        const trigger = returnFocusRef.current;
        returnFocusRef.current = null;
        if (!restoreFocus) return;
        if (trigger?.isConnected && !trigger.closest('[inert], [aria-hidden="true"]') && trigger.getClientRects().length) trigger.focus({ preventScroll: true });
        else document.querySelector<HTMLElement>('.app-page.is-active')?.focus({ preventScroll: true });
      },
      onStage: setStage,
      requestFrame: callback => window.requestAnimationFrame(callback),
      cancelFrame: id => window.cancelAnimationFrame(id),
      setTimer: (callback, delay) => window.setTimeout(callback, delay),
      clearTimer: id => window.clearTimeout(id),
      reducedMotion: () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      duration: 260,
    });
    controllerRef.current = controller;
    controller.setOpen(desiredRef.current);
    return () => { controller.dispose(); controllerRef.current = null; };
  }, []);

  useEffect(() => { controllerRef.current?.setOpen(open && Boolean(recipe)); }, [open, recipe === null]);

  function trapFocus(event: React.KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== 'Tab') return;
    const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, a[href], [tabindex]:not([tabindex="-1"])')]
      .filter(control => control.getClientRects().length > 0);
    const first = controls[0];
    const last = controls.at(-1);
    if (!first || !last) { event.preventDefault(); return; }
    if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  if (typeof document === 'undefined') return null;

  return createPortal(<dialog
    ref={dialogRef}
    id="ingredient-drawer"
    className="ingredient-drawer"
    data-stage={stage}
    autoFocus
    aria-labelledby="ingredient-drawer-title"
    aria-describedby="ingredient-drawer-recipe"
    aria-modal="true"
    onCancel={event => { event.preventDefault(); onClose(); }}
    onPointerDown={event => backdropRef.current.start(event.target === event.currentTarget, event.pointerId)}
    onPointerUp={event => { if (backdropRef.current.end(event.target === event.currentTarget, event.pointerId)) { event.preventDefault(); onClose(); } }}
    onPointerCancel={() => backdropRef.current.cancel()}
    onKeyDown={trapFocus}
  >
    <div className="ingredient-drawer-panel">
      <div className="ingredient-drawer-top">
      <header className="ingredient-drawer-header">
        <div><p className="eyebrow">KEEP THE CHECKLIST HANDY</p><h2 id="ingredient-drawer-title">Ingredients / Save</h2></div>
        <button ref={closeButtonRef} type="button" className="ingredient-drawer-close" onClick={onClose} aria-label="Close ingredient list">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg><span>Close</span>
        </button>
      </header>
      <p id="ingredient-drawer-recipe" className="ingredient-drawer-recipe" title={recipe?.title}>{recipe?.title ?? 'Select a recipe to see its ingredients.'}</p>
      {batchControls && <section className="ingredient-drawer-batch" aria-label="Batch size">{batchControls}</section>}
      </div>
      <div ref={listRef} className="ingredient-drawer-list" tabIndex={0} aria-label="Scrollable ingredient checklist">
        <p className="ingredient-drawer-help">Check items as you gather them. Your checks stay with this recipe.</p>
        {batchGuidance}
        {recipe?.ingredients.map(ingredient => {
          const measure = displayIngredientAmount(ingredient);
          const checked = progress?.ingredients?.[ingredient.id] ?? false;
          const edited = changes?.ingredients[ingredient.id]?.changed;
          return <label key={ingredient.id} className={`check-item ${checked ? 'checked' : ''} ${edited ? 'ai-change' : ''}`}>
            <input type="checkbox" checked={checked} onChange={() => onToggle(ingredient.id)} />
            <span><strong>{ingredient.name}{edited && <span className="change-tag">Updated</span>}</strong><small><b className="ingredient-amount">{measure.amount}</b>{ingredient.note ? ` · ${ingredient.note}` : ''}{measure.note && <span className="measure-note">{measure.note}</span>}</small></span>
          </label>;
        })}
      </div>
      {saveControls && <footer className="ingredient-drawer-save" aria-label="Save this recipe">{saveControls}</footer>}
    </div>
  </dialog>, document.body);
}
