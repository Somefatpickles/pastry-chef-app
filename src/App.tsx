import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut, updateProfile, type User } from 'firebase/auth';
import { firebaseAuth, isFirebaseConfigured } from './firebase';
import { saveProgress, subscribeToProgress } from './progressStore';
import { recipes } from './recipeLibrary';
import { isRecipe, scaleRecipe, batchConsiderations } from '../shared/recipe-core.mjs';
import { loadLocalProgress, loadSavedRecipes, persistLocalProgress, persistSavedRecipes } from './localStore';
import ChefPanel from './ChefPanel';
import AppPages from './PageNavigation';
import IngredientDrawer from './IngredientDrawer';
import WelcomeScreen from './WelcomeScreen';
import BrandLogo from './BrandLogo';
import RecipeCard from './RecipeCard';
import FavoriteButton from './FavoriteButton';
import AnalyticsPage from './AnalyticsPage';
import { useBakerActivity } from './useBakerActivity';
import Notifications, { useNotifications, type NotificationKind } from './Notifications';
import { cookieArt } from './cookieArt';
import { pageFromHash, pageHash, type AppPage } from '../shared/page-navigation.mjs';
import { displayIngredientAmount } from '../shared/baking-measures.mjs';
import { getRecipeChanges } from '../shared/recipe-changes.mjs';
import { availableCategories, normalizeCategory, matchesRecipeFilters } from '../shared/recipe-filters.mjs';
import { toUsRecipe, toUsText } from '../shared/us-recipe-text.mjs';
import { hasFirstNameEntry, loadFirstName, normalizeFirstName, saveFirstName } from './bakerProfile';
import { greeting } from '../shared/greeting.mjs';
import { shuffleForLoad } from '../shared/recipe-order.mjs';
import { planRecipeImport, planSavedRecipe, sameRecipeContent } from '../shared/saved-recipes.mjs';
import type { ChefResult, ChecklistState, ProgressByRecipe, Recipe, RecipeProgress } from './types';

function checklist(items: { id: string }[]): ChecklistState { return Object.fromEntries(items.map(item => [item.id, false])); }
function createProgress(recipe: Recipe): RecipeProgress { return { ingredients: checklist(recipe.ingredients), steps: checklist(recipe.steps) }; }
function localId() { return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`; }
function sourceId(recipe: Recipe) { return recipe.adaptation?.sourceRecipeId ?? recipe.sourceRecipeId ?? recipe.id; }
const levels: Recipe['difficulty'][] = ['Novice', 'Intermediate', 'Experienced', 'Challenges'];

export default function App() {
  const [brandCookie, setBrandCookie] = useState(() => cookieArt[Math.floor(Math.random() * cookieArt.length)]);
  const notices = useNotifications();
  const notify = useCallback((message: string, kind: NotificationKind = 'info') => { notices.notify(toUsText(message), kind); }, [notices.notify]);
  const setNotice = (message: string) => { if (message) notify(message, 'success'); };
  const setStorageError = (message: string) => { if (message) notify(message, 'error'); };
  const setDrawerNotice = setNotice;
  const setDrawerError = setStorageError;
  const setAuthError = setStorageError;
  const setNameError = setStorageError;
  const setNameMessage = (message: string) => { if (message) notify(message, message.includes('unavailable') ? 'info' : 'success'); };
  const [introStage, setIntroStage] = useState<'welcome' | 'fading' | 'focusing' | 'ready'>('welcome');
  const started = introStage === 'ready';
  const [activePage, setActivePage] = useState<AppPage>(() => pageFromHash(window.location.hash));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collection, setCollection] = useState<'library' | 'saved'>('library');
  const [category, setCategory] = useState('All categories');
  const [difficulty, setDifficulty] = useState('All levels');
  const [statusFilter, setStatusFilter] = useState('All');
  const [favoritesFilter, setFavoritesFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [savedRecipes, setSavedRecipes] = useState<Recipe[]>(loadSavedRecipes);
  const savedRecipesRef = useRef(savedRecipes);
  const [browseOrder] = useState(() => shuffleForLoad([...recipes, ...savedRecipes].map(recipe => recipe.id)));
  const browseRanks = useMemo(() => new Map(browseOrder.map((id, rank) => [id, rank])), [browseOrder]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Recipe | null>(null);
  const [scaleInput, setScaleInput] = useState('1');
  const [saveName, setSaveName] = useState('');
  const [progress, setProgress] = useState<ProgressByRecipe>(loadLocalProgress);
  const [user, setUser] = useState<User | null>(null);
  const [syncState, setSyncState] = useState(isFirebaseConfigured ? 'signing-in' : 'not-configured');
  const [authMode, setAuthMode] = useState<'sign-in' | 'create-account'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authReady, setAuthReady] = useState(!isFirebaseConfigured);
  const [firstName, setFirstName] = useState(loadFirstName);
  const [firstNameDraft, setFirstNameDraft] = useState(loadFirstName);
  const [nameBusy, setNameBusy] = useState(false);
  const profileOwnerRef = useRef<string | null>(null);
  const [cloudRevision, setCloudRevision] = useState(0);
  const lastSyncedRevision = useRef(0);
  const importRef = useRef<HTMLInputElement>(null);
  const workspaceRef = useRef<HTMLElement>(null);
  const libraryIds = useMemo(() => new Set(recipes.map(r => r.id)), []);
  const allRecipes = useMemo(() => [...recipes, ...savedRecipes], [savedRecipes]);
  const baker = useBakerActivity(user, authReady, progress, allRecipes, notify);
  const completions = useMemo(() => baker.activity.completions.filter(event => !event.deletedAt), [baker.activity.completions]);
  const latestCompletions = useMemo(() => new Map(completions.map(event => [event.recipeId, event.completedAt])), [completions]);
  const selectedBase = allRecipes.find(r => r.id === selectedId) ?? null;
  const selectedArtwork = selectedBase ? recipes.find(recipe => recipe.id === sourceId(selectedBase)) : undefined;
  const factor = Number(scaleInput);
  const scaleValid = scaleInput.trim() !== '' && Number.isFinite(factor) && factor >= .1 && factor <= 10;
  const workingRecipe = useMemo(() => {
    if (!selectedBase) return null;
    const current = draft ?? selectedBase;
    const scaled = scaleValid ? scaleRecipe(current, factor) : current;
    return { ...scaled, id: draft || factor !== 1 ? `working:${selectedBase.id}:${factor}:${draft?.adaptation?.createdAt ?? ''}` : selectedBase.id };
  }, [selectedBase, draft, factor, scaleValid]);
  const displayRecipe = useMemo(() => toUsRecipe(workingRecipe), [workingRecipe]);
  const selectedSavedRecipe = savedRecipes.find(recipe => recipe.id === selectedId);
  const renamingSavedRecipe = Boolean(selectedSavedRecipe && workingRecipe && sameRecipeContent(selectedSavedRecipe, workingRecipe));
  const currentProgress = workingRecipe ? progress[workingRecipe.id] ?? createProgress(workingRecipe) : null;
  const activeRecipes = useMemo(() => [...(collection === 'saved' ? savedRecipes : recipes)].sort((left, right) => (browseRanks.get(left.id) ?? browseOrder.length) - (browseRanks.get(right.id) ?? browseOrder.length)), [collection, savedRecipes, browseRanks, browseOrder.length]);
  const categories = availableCategories(activeRecipes, difficulty);
  const effectiveCategory = normalizeCategory(activeRecipes, difficulty, category);
  const comparisonBase = workingRecipe?.adaptation?.before ?? (workingRecipe?.adaptation ? recipes.find(r => r.id === sourceId(workingRecipe)) ?? null : null);
  const changes = getRecipeChanges(comparisonBase, workingRecipe);
  const changed = (field: keyof typeof changes.fields) => changes.fields[field] ? 'ai-change-text' : undefined;
  const visibleRecipes = useMemo(() => activeRecipes.filter(recipe => matchesRecipeFilters(recipe, { category: effectiveCategory, difficulty, search, status: statusFilter, favorites: favoritesFilter, completed: latestCompletions.has(recipe.id), favorite: Boolean(baker.activity.favorites[recipe.id]?.favorite) })).map(recipe => toUsRecipe(recipe)), [activeRecipes, effectiveCategory, difficulty, search, statusFilter, favoritesFilter, latestCompletions, baker.activity.favorites]);
  const selectedCompletions = completions.filter(event => event.recipeId === selectedId);

  useEffect(() => { if (category !== effectiveCategory) setCategory(effectiveCategory); }, [category, effectiveCategory]);
  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; };
  }, []);
  useEffect(() => {
    if (introStage !== 'fading' && introStage !== 'focusing') return;
    const timer = window.setTimeout(() => setIntroStage(introStage === 'fading' ? 'focusing' : 'ready'), introStage === 'fading' ? 900 : 1050);
    return () => window.clearTimeout(timer);
  }, [introStage]);
  useEffect(() => {
    if (!started) return;
    const frame = requestAnimationFrame(() => document.querySelector<HTMLElement>('.app-page.is-active')?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [started]);
  useEffect(() => {
    const followLocation = () => { setActivePage(pageFromHash(window.location.hash)); setDrawerOpen(false); };
    window.addEventListener('popstate', followLocation);
    window.addEventListener('hashchange', followLocation);
    return () => { window.removeEventListener('popstate', followLocation); window.removeEventListener('hashchange', followLocation); };
  }, []);

  useEffect(() => { try { persistLocalProgress(progress); } catch { setStorageError('This browser could not save progress. Export your saved recipes to keep a backup.'); } }, [progress]);
  useEffect(() => {
    if (!firebaseAuth) return;
    return onAuthStateChanged(firebaseAuth, next => {
      const owner = next?.uid ?? null;
      profileOwnerRef.current = owner;
      const name = hasFirstNameEntry(owner) ? loadFirstName(owner) : normalizeFirstName(next?.displayName ?? '');
      setUser(next); setSyncState(next ? 'loading' : 'signing-in');
      setFirstName(name); setFirstNameDraft(name); setNameBusy(false); setNameMessage(''); setNameError(''); setAuthReady(true);
    });
  }, []);
  useEffect(() => {
    if (!user) return;
    return subscribeToProgress(user.uid, remote => {
      if (profileOwnerRef.current !== user.uid) return;
      setProgress(current => ({ ...current, ...Object.fromEntries(recipes.map(recipe => [recipe.id, { ...createProgress(recipe), ...remote?.[recipe.id], ingredients: { ...checklist(recipe.ingredients), ...remote?.[recipe.id]?.ingredients }, steps: { ...checklist(recipe.steps), ...remote?.[recipe.id]?.steps } }])) }));
      setSyncState('ready');
    }, () => setSyncState('error'));
  }, [user]);
  useEffect(() => {
    if (!user || syncState !== 'ready') return;
    if (cloudRevision === lastSyncedRevision.current) return;
    lastSyncedRevision.current = cloudRevision;
    void saveProgress(user.uid, Object.fromEntries(Object.entries(progress).filter(([id]) => libraryIds.has(id)))).catch(() => setSyncState('error'));
    // Drafts and saved copies stay on this device; only explicit library edits trigger cloud writes.
  }, [cloudRevision, user, syncState, libraryIds]);

  function selectRecipe(recipe: Recipe) {
    navigate('current');
    if (recipe.id === selectedId) return;
    setSelectedId(recipe.id); setDraft(null); setScaleInput('1'); setSaveName(toUsText(recipe.title, { ingredients: recipe.ingredients })); setNotice('');
    revealCurrentRecipe();
  }
  function navigate(page: AppPage) {
    setDrawerOpen(false); setActivePage(page);
    if (window.location.hash !== pageHash(page)) window.history.pushState(null, '', pageHash(page));
  }
  function startBaking() {
    if (introStage !== 'welcome') return;
    navigate('recipes');
    setIntroStage(window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'ready' : 'fading');
  }
  function revealChef() {
    const page = document.getElementById('page-current');
    const chef = document.getElementById('ai-pastry-chef');
    if (!page || !chef) return;
    const top = page.scrollTop + chef.getBoundingClientRect().top - page.getBoundingClientRect().top - 12;
    chef.focus({ preventScroll: true });
    page.scrollTo({ top: Math.max(0, top), behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }
  function revealCurrentRecipe() {
    requestAnimationFrame(() => { document.getElementById('page-current')?.scrollTo({ top: 0, behavior: 'instant' }); workspaceRef.current?.focus({ preventScroll: true }); });
  }
  function setCollectionAndReset(next: 'library' | 'saved') { setCollection(next); setCategory('All categories'); setDifficulty('All levels'); setStatusFilter('All'); setFavoritesFilter('All'); setSearch(''); }
  function changeDifficulty(next: string) { setDifficulty(next); setCategory(current => normalizeCategory(activeRecipes, next, current)); }
  function updateChecklist(kind: 'ingredients' | 'steps', id: string) {
    if (!workingRecipe) return;
    setProgress(current => { const before = current[workingRecipe.id] ?? createProgress(workingRecipe); return { ...current, [workingRecipe.id]: { ...before, [kind]: { ...before[kind], [id]: !before[kind][id] } } }; });
    if (libraryIds.has(workingRecipe.id)) setCloudRevision(v => v + 1);
  }
  function logCompletion() {
    if (!workingRecipe || !selectedBase) return;
    const event = baker.addCompletion({ ...workingRecipe, sourceRecipeId: sourceId(selectedBase) }, selectedBase.id);
    if (!event) return;
    setProgress(current => {
      const before = current[selectedBase.id] ?? createProgress(selectedBase);
      return { ...current, [selectedBase.id]: { ...before, completedAt: event.completedAt } };
    });
    if (libraryIds.has(selectedBase.id)) setCloudRevision(v => v + 1);
  }
  function removeBakeCompletion(id: string) {
    const event = baker.removeCompletion(id);
    if (!event) return;
    const last = completions.filter(item => item.id !== id && item.recipeId === event.recipeId).at(-1);
    setProgress(current => {
      const before = current[event.recipeId];
      if (!before) return current;
      const next = { ...before };
      if (last) next.completedAt = last.completedAt; else delete next.completedAt;
      return { ...current, [event.recipeId]: next };
    });
    if (libraryIds.has(event.recipeId)) setCloudRevision(v => v + 1);
  }
  function applyAdaptation(result: ChefResult, request: string) {
    if (!selectedBase || !workingRecipe) return;
    const before = structuredClone(workingRecipe.adaptation?.before ?? workingRecipe);
    delete (before as Recipe).adaptation;
    const adapted: Recipe = { ...result.recipe, id: `draft-${selectedBase.id}`, sourceRecipeId: sourceId(selectedBase), adaptation: { sourceRecipeId: sourceId(selectedBase), request, createdAt: new Date().toISOString(), changes: result.changes, considerations: result.considerations, source: result.source, before, ...(result.model ? { model: result.model } : {}) } };
    setDraft(adapted); setScaleInput('1'); setSaveName(`${toUsText(adapted.title, { ingredients: adapted.ingredients })} — my version`); setNotice('Adaptation applied. Open Ingredient List / Save to keep a copy.');
    revealCurrentRecipe();
  }
  function replaceSaved(next: Recipe[], scope: 'page' | 'drawer' = 'page') {
    const reportError = scope === 'drawer' ? setDrawerError : setStorageError;
    if (!next.every(isRecipe)) { reportError('This recipe cannot be saved because some details are incomplete. Reset the working changes or try a simpler adaptation.'); return false; }
    try { persistSavedRecipes(next); savedRecipesRef.current = next; setSavedRecipes(next); reportError(''); return true; }
    catch { reportError('This browser could not save the recipe. Storage may be full or disabled. Export a backup and try again.'); return false; }
  }
  function saveCopy() {
    if (!workingRecipe || !selectedBase || !scaleValid) return;
    setDrawerNotice(''); setDrawerError('');
    const copy: Recipe = { ...workingRecipe, id: localId(), title: toUsText(saveName.trim() || workingRecipe.title, { ingredients: workingRecipe.ingredients }), sourceRecipeId: sourceId(selectedBase) };
    if (factor !== 1) copy.adaptation = { ...workingRecipe.adaptation, sourceRecipeId: sourceId(selectedBase), request: `Scale working batch by ${factor}`, createdAt: new Date().toISOString(), changes: [...(workingRecipe.adaptation?.changes ?? []), `Multiplied the working ingredient amounts by ${factor}.`], considerations: [...new Set([...(workingRecipe.adaptation?.considerations ?? []), ...batchConsiderations])], source: workingRecipe.adaptation?.source ?? 'local' };
    const plan = planSavedRecipe({ recipes: savedRecipesRef.current, candidate: copy, selectedId: selectedBase.id });
    if (plan.status === 'full') { setDrawerError('Your local collection is full (200 recipes). Export a backup and remove an older copy.'); return; }
    if (plan.status === 'duplicate') { notify(`This recipe is already saved as “${plan.recipe.title}”. Open it in My recipes to rename it.`); return; }
    if (plan.status === 'unchanged') { notify('No changes to save. This recipe is already in My recipes.'); return; }
    if (replaceSaved(plan.recipes, 'drawer')) {
      setSaveName(plan.recipe.title);
      setDrawerNotice(plan.status === 'renamed' ? `Recipe renamed to “${plan.recipe.title}”. Your baking progress is kept.` : `“${plan.recipe.title}” is saved in My recipes on this device.`);
    }
  }
  function exportRecipes() {
    const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), recipes: savedRecipes }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'my-pastry-recipes.json'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function importRecipes(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      if (file.size > 2000000) throw new Error('Choose a recipe backup smaller than 2 MB.');
      const data = JSON.parse(await file.text());
      if (!data || data.version !== 1 || !Array.isArray(data.recipes) || !data.recipes.every(isRecipe)) throw new Error('This is not a valid Pastry Chef recipe backup.');
      const imported = (data.recipes as Recipe[]).map(r => ({ ...r, id: localId() }));
      const plan = planRecipeImport({ recipes: savedRecipesRef.current, candidates: imported });
      if (plan.status === 'full') throw new Error('Import would exceed the 200-recipe local limit after skipping identical recipes.');
      if (plan.status === 'unchanged') { notify(plan.skipped ? `All ${plan.skipped} recipes are already saved. No duplicates were added.` : 'This backup contains no recipes.'); return; }
      if (replaceSaved(plan.recipes)) {
        setNotice(`Imported ${plan.added} ${plan.added === 1 ? 'recipe' : 'recipes'} to this device.${plan.skipped ? ` Skipped ${plan.skipped} identical ${plan.skipped === 1 ? 'recipe' : 'recipes'}.` : ''}`);
        setCollectionAndReset('saved');
      }
    } catch (reason) { setStorageError(reason instanceof Error ? reason.message : 'The backup could not be read.'); }
    finally { event.target.value = ''; }
  }
  async function authenticate(event: React.FormEvent) {
    event.preventDefault(); if (!firebaseAuth || authBusy) return;
    const emailInput = event.currentTarget.querySelector<HTMLInputElement>('input[type="email"]');
    if (!email.trim() || !emailInput?.validity.valid) { notify('Enter a valid email address.', 'error'); return; }
    if (password.length < 6) { notify('Use at least 6 characters for your password.', 'error'); return; }
    setAuthBusy(true); setAuthError('');
    try {
      if (authMode === 'create-account') await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
      else await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
      setPassword('');
      notify(authMode === 'create-account' ? 'Your baking profile is ready. You can use the AI Pastry Chef in Current Recipe.' : 'You’re signed in. Your AI Pastry Chef is ready.', 'success');
    } catch { setAuthError('Sign-in failed. Check your details and try again.'); }
    finally { setAuthBusy(false); }
  }
  async function saveBakerName(event: React.FormEvent) {
    event.preventDefault(); if (nameBusy || !authReady) return;
    const owner = user?.uid ?? null;
    const name = normalizeFirstName(firstNameDraft);
    setNameError(''); setNameMessage('');
    try { saveFirstName(name, owner); }
    catch { setNameError('Your first name could not be saved in this browser. Please try again.'); return; }
    setFirstName(name); setFirstNameDraft(name);
    if (!user) { setNameMessage(name ? 'First name saved.' : 'First name cleared.'); return; }
    setNameBusy(true);
    try {
      await updateProfile(user, { displayName: name });
      if (profileOwnerRef.current === owner) setNameMessage(name ? 'First name saved.' : 'First name cleared.');
    } catch {
      if (profileOwnerRef.current === owner) setNameMessage('Saved on this device. Profile sync is unavailable right now.');
    } finally { if (profileOwnerRef.current === owner) setNameBusy(false); }
  }

  const progressLogin = <section className="progress-login" aria-labelledby="progress-login-title">
    <p className="eyebrow">YOUR BAKING PROFILE</p><h2 id="progress-login-title">Library progress</h2>
    {user ? <><p><strong>{syncState === 'ready' ? 'Library progress sync is on' : syncState === 'error' ? 'Cloud sync paused; progress stays on this device' : 'Loading cloud progress…'}</strong><span>{user.email}</span></p><button type="button" className="text-button" onClick={() => void signOut(firebaseAuth!).then(() => notify('You’re signed out.', 'info')).catch(() => setAuthError('Could not sign out. Try again.'))}>Sign out</button></> : isFirebaseConfigured ? <form className="auth-form" noValidate onSubmit={authenticate}><p>Sign in to keep library checklists and completions together across your devices.</p><div className="login-fields"><label>Email<input type="email" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} /></label><label>Password<input type="password" required minLength={6} autoComplete={authMode === 'sign-in' ? 'current-password' : 'new-password'} value={password} onChange={event => setPassword(event.target.value)} /></label></div><div className="button-row"><button type="submit" className="completion-button" disabled={authBusy}>{authBusy ? 'Please wait…' : authMode === 'sign-in' ? 'Sign in' : 'Create account'}</button><button type="button" className="text-button" onClick={() => setAuthMode(authMode === 'sign-in' ? 'create-account' : 'sign-in')}>{authMode === 'sign-in' ? 'Create a baking profile' : 'Already have an account?'}</button></div></form> : <p>Checklists and completions are saved on this device. Account sync is not configured on this host.</p>}
  </section>;

  const welcome = authReady ? greeting({ firstName, signedIn: Boolean(user) }) : null;

  const footer = <footer className="kitchen-footer">An app made for curious bakers by Pixel &amp; Principle.</footer>;

  const recipeListPage = <div className="page-content recipe-list-page">
    <section className="panel recipe-rail">
      <header className="page-heading branded-page-heading"><div className="page-title-row"><h1>Recipe List</h1><BrandLogo cookie={brandCookie} onCookieChange={setBrandCookie} compact /></div><p>Find your next bake, or return to a saved favorite.</p></header>
      <div className="collection-tabs" aria-label="Recipe collection"><button className={collection === 'library' ? 'active' : ''} aria-pressed={collection === 'library'} onClick={() => setCollectionAndReset('library')}>Recipe library <span>{recipes.length}</span></button><button className={collection === 'saved' ? 'active' : ''} aria-pressed={collection === 'saved'} onClick={() => setCollectionAndReset('saved')}>My recipes <span>{savedRecipes.length}</span></button></div>
      <label className="field-label">Search recipes or ingredients<input type="search" placeholder="Try lemon, chocolate, or brioche" value={search} onChange={event => setSearch(event.target.value)} /></label>
      <div className="filter-grid"><label className="field-label">Category<select value={effectiveCategory} disabled={!categories.length} onChange={event => setCategory(event.target.value)}><option>All categories</option>{categories.map(item => <option key={item}>{item}</option>)}</select></label><label className="field-label">Skill level<select value={difficulty} onChange={event => changeDifficulty(event.target.value)}><option>All levels</option>{levels.map(level => <option key={level}>{level}</option>)}</select></label><label className="field-label">Status<select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option>All</option><option>Completed</option><option>Not Completed</option></select></label><label className="field-label">Favorites<select value={favoritesFilter} onChange={event => setFavoritesFilter(event.target.value)}><option>All</option><option>Favorites Only</option></select></label></div>
      {collection === 'saved' && <div className="local-tools"><p>Saved in this browser on this device. Export a backup to move recipes to another device.</p><div className="button-row"><button type="button" className="secondary-button" onClick={exportRecipes} disabled={!savedRecipes.length}>Export backup</button><button type="button" className="secondary-button" onClick={() => importRef.current?.click()}>Import backup</button><input ref={importRef} type="file" accept=".json,application/json" hidden onChange={event => void importRecipes(event)} /></div></div>}
      <p className="results-count">{visibleRecipes.length} {visibleRecipes.length === 1 ? 'recipe' : 'recipes'}</p>
      <div className="recipe-list">{visibleRecipes.map(recipe => <RecipeCard key={recipe.id} recipe={recipe} progress={{ ...(progress[recipe.id] ?? createProgress(recipe)), completedAt: latestCompletions.get(recipe.id) }} isFavorite={Boolean(baker.activity.favorites[recipe.id]?.favorite)} onToggleFavorite={baker.toggleFavorite} selected={recipe.id === selectedId} onSelect={selectRecipe} artworkId={libraryIds.has(sourceId(recipe)) ? sourceId(recipe) : undefined} />)}</div>
      {!visibleRecipes.length && <div className="filter-prompt">{collection === 'saved' && !savedRecipes.length ? 'Save a library recipe or a chef adaptation to start your own collection.' : 'No recipes match. Try a different search or filter.'}</div>}
    </section>
    {footer}
  </div>;

  const currentRecipePage = <div className="page-content current-recipe-page">
    <section ref={workspaceRef} tabIndex={-1} className="panel recipe-workspace" aria-label="Recipe workspace">
      {displayRecipe && workingRecipe && selectedBase ? <>
        <header className="recipe-header"><div className="recipe-title-summary"><p className="eyebrow">{draft ? 'YOUR WORKING ADAPTATION' : savedRecipes.some(recipe => recipe.id === selectedBase.id) ? 'FROM MY RECIPES' : 'FROM THE RECIPE LIBRARY'}</p><h2 className={changed('title')}>{displayRecipe.title}</h2><p className={'section-help ' + (changed('blurb') ?? '')}>{displayRecipe.blurb}</p></div><FavoriteButton className="current-recipe-favorite" favorite={Boolean(baker.activity.favorites[selectedBase.id]?.favorite)} recipeTitle={displayRecipe.title} onToggle={() => baker.toggleFavorite(selectedBase)} /><div className="recipe-badges"><span className={changed('difficulty')}>{displayRecipe.difficulty}</span><span className={changed('time')}>{displayRecipe.time}</span><span className={changed('yield')}>{displayRecipe.yield}</span></div></header>
        {selectedArtwork && <figure className="recipe-hero"><img data-recipe-image={selectedArtwork.id} src={`/recipe-images/${selectedArtwork.id}.webp`} width="640" height="400" alt={`Recipe illustration: ${selectedArtwork.title}`} decoding="async" fetchPriority="high" /></figure>}

        {displayRecipe.adaptation && <details className="adaptation-notes ai-change" open><summary>Your adaptation notes</summary><p>{displayRecipe.adaptation.request}</p><p className="change-legend">Blue highlights mark changes from your starting recipe.</p><ul>{displayRecipe.adaptation.changes.map((change, index) => <li key={index}>{change}</li>)}</ul><strong>Keep in mind</strong><ul>{displayRecipe.adaptation.considerations.map((note, index) => <li key={index}>{note}</li>)}</ul><p>Adapted guidance has not been kitchen tested.</p></details>}
        {(changes.removedIngredients.length > 0 || changes.removedSteps.length > 0) && <details className="adaptation-notes ai-change"><summary>Removed in this adaptation</summary><ul>{changes.removedIngredients.map((item, index) => <li key={'ingredient-' + index}>Ingredient removed: {displayIngredientAmount(item).amount} {item.name}{item.note ? ' — ' + toUsText(item.note) : ''}</li>)}{changes.removedSteps.map((step, index) => <li key={'step-' + index}>Step removed: {toUsText(step.title)} — {toUsText(step.detail)}</li>)}</ul></details>}
        <div className="recipe-prep"><div className={changed('equipment')}><p className="eyebrow">BEFORE YOU BEGIN</p><h3>Set up for a good bake</h3><ul>{displayRecipe.equipment?.map(item => <li key={item}>{item}</li>)}</ul></div><div className={changed('notes')}><p className="eyebrow">BAKER’S NOTES</p><ul>{displayRecipe.notes?.map((note, index) => <li key={index}>{note}</li>)}</ul></div></div>
        <section className="subpanel method-panel" aria-labelledby="recipe-method-title">
          <div className="section-head slim"><div><p className="eyebrow">STEP-BY-STEP GUIDANCE</p><h3 id="recipe-method-title">Follow the method</h3></div></div>
          <div className="steps-list">{displayRecipe.steps.map((step, index) => <article key={step.id} className={'step-card ' + (currentProgress?.steps?.[step.id] ? 'done ' : '') + (changes.steps[step.id]?.changed ? 'ai-change' : '')}><label><input type="checkbox" aria-label={'Complete step ' + (index + 1) + ': ' + step.title} checked={currentProgress?.steps?.[step.id] ?? false} onChange={() => updateChecklist('steps', step.id)} /><span className="step-index">{index + 1}</span><div><strong>{step.title}{changes.steps[step.id]?.changed && <span className="change-tag">Updated</span>}</strong><p>{step.detail}</p>{step.why && <p className="step-why"><b>Why it matters:</b> {step.why}</p>}{step.tip && <small>{step.tip}</small>}</div></label></article>)}</div>
          <div className="completion-bar"><p>{selectedCompletions.length ? `${selectedCompletions.length} ${selectedCompletions.length === 1 ? 'bake' : 'bakes'} logged · Last baked ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(selectedCompletions.at(-1)!.completedAt))}` : 'Finished your bake? Record it here.'}</p><div className="completion-actions"><button className="completion-button" type="button" onClick={logCompletion}>Log as completed</button>{selectedCompletions.length > 0 && <button className="text-button" type="button" onClick={() => removeBakeCompletion(selectedCompletions.at(-1)!.id)}>Undo last log</button>}</div></div>
        </section>
        {displayRecipe.storage && <section className={'storage-panel ' + (changes.fields.storage ? 'ai-change' : '')}><p className="eyebrow">AFTER THE BAKE</p><h3>Storing & serving</h3><p>{displayRecipe.storage}</p></section>}
        {!displayRecipe.adaptation && <details className="review-details"><summary>Recipe review & references</summary><p>Reviewed for formula balance and completeness against published baking guidance. These are editorially revised recipes; they have not been kitchen tested in this app. Times are ranges—use the doneness cues too. Temperatures are for a conventional oven unless specified.</p><ul>{displayRecipe.reviewNotes?.map((note, index) => <li key={index}>{note}</li>)}</ul><ul>{displayRecipe.sources?.filter(source => typeof source.url === 'string' && source.url.startsWith('https://')).map((source, index) => <li key={index}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a></li>)}</ul></details>}
        {scaleValid ? <ChefPanel key={selectedBase.id + ':' + factor + ':' + (draft?.adaptation?.createdAt ?? '')} recipe={workingRecipe} sourceRecipeId={sourceId(selectedBase)} onApply={applyAdaptation} user={user} authReady={authReady} notify={notify} /> : <section id="ai-pastry-chef" className="chef-panel" tabIndex={-1} aria-labelledby="chef-batch-title"><div className="chef-heading"><h3 id="chef-batch-title">AI Pastry Chef</h3></div><p>Set a batch multiplier from 0.1 to 10 to continue with your recipe.</p><button type="button" className="completion-button" onClick={event => { event.currentTarget.focus({ preventScroll: true }); setDrawerOpen(true); }}>Check batch size</button></section>}
      </> : <div className="empty-state"><span className="pastry-mark" aria-hidden="true">✺</span><h1>Current Recipe</h1><p>Choose a recipe to see its method, ingredients, and baking guidance.</p><button type="button" className="completion-button" onClick={() => navigate('recipes')}>Choose a recipe</button></div>}
    </section>
    {footer}
  </div>;

  const profilePage = <div className="page-content profile-page">
    <header className="page-heading branded-page-heading"><div className="page-title-row"><h1>Profile</h1><BrandLogo cookie={brandCookie} onCookieChange={setBrandCookie} compact /></div><p>Your sign-in and library progress, in one place.</p></header>
    <section className="panel profile-name-card"><form className="first-name-form" onSubmit={event => void saveBakerName(event)}>
      <div><h2>Your name</h2></div>
      <label className="field-label" htmlFor="baker-first-name">First Name<input id="baker-first-name" type="text" autoComplete="given-name" maxLength={60} value={firstNameDraft} disabled={!authReady || nameBusy} onChange={event => { setFirstNameDraft(event.target.value); setNameMessage(''); setNameError(''); }} /></label>
      <button type="submit" className="completion-button" disabled={!authReady || nameBusy}>{nameBusy ? 'Saving…' : 'Save first name'}</button>
    </form></section>
    <section className="panel profile-card">{progressLogin}</section>
    <section className="subpanel profile-activity-sync"><h2>Your baking history</h2><p>{user ? baker.syncState === 'ready' ? 'Bakes and favorites are saved on this device and synced to your profile.' : baker.syncState === 'error' ? 'Bakes and favorites are saved on this device. Cloud sync needs another try.' : 'Bakes and favorites are saved on this device. Connecting to your profile…' : 'Bakes and favorites save on this device. Sign in to unlock Analytics and sync them to your profile.'}</p>{user && baker.syncState === 'error' && <button type="button" className="secondary-button" onClick={baker.retrySync}>Retry history sync</button>}<button type="button" className="text-button" onClick={() => navigate('analytics')}>Open Analytics</button></section>
    <section className="subpanel profile-local-info"><h2>Your recipes, your device</h2><p>My recipes and working adaptations stay in this browser. Use Recipe List to browse your collection and export or import a recipe backup.</p><p>Sign in with the same profile on another device to share your library checklists and completion history.</p></section>
    {footer}
  </div>;

  const drawerBatch = workingRecipe ? <div className="batch-controls">
    <label className="field-label">Batch multiplier<input aria-label="Batch multiplier" aria-invalid={!scaleValid} type="number" min="0.1" max="10" step="0.1" value={scaleInput} onChange={event => { setScaleInput(event.target.value); setDrawerNotice(''); setDrawerError(''); }} onBlur={() => { if (!scaleValid) notify('Enter a batch multiplier from 0.1 to 10.', 'error'); }} /></label>
    <span>× batch</span><button type="button" className="text-button" title="Reset working changes" aria-label="Reset working changes" onClick={() => { setDraft(null); setScaleInput('1'); setNotice(''); setDrawerNotice('Working changes cleared. The saved or library recipe is restored.'); setDrawerError(''); }}>Reset</button>
  </div> : null;
  const drawerGuidance = workingRecipe ? <>
    {factor !== 1 && scaleValid && <details className="batch-guidance"><summary>For this batch</summary><ul>{batchConsiderations.map(note => <li key={note}>{toUsText(note)}</li>)}</ul></details>}
  </> : null;
  const drawerSave = workingRecipe && selectedBase ? <form className="drawer-save-form" onSubmit={event => { event.preventDefault(); saveCopy(); }}>
    <div className="save-controls"><label className="field-label">{renamingSavedRecipe ? 'Recipe name' : selectedSavedRecipe ? 'Name your new version' : 'Name your saved copy'}<input maxLength={160} value={saveName} onChange={event => { setSaveName(event.target.value); setDrawerNotice(''); setDrawerError(''); }} /></label><button type="submit" className="completion-button" disabled={!scaleValid}>{renamingSavedRecipe ? 'Save changes' : selectedSavedRecipe ? 'Save as new recipe' : 'Save to My recipes'}</button></div>
    {savedRecipes.some(recipe => recipe.id === selectedBase.id) && <button type="button" className="drawer-remove-saved text-button danger-button" onClick={() => { if (window.confirm('Remove “' + selectedBase.title + '” from this device?')) { if (replaceSaved(savedRecipes.filter(recipe => recipe.id !== selectedBase.id), 'drawer')) { setSelectedId(null); setDraft(null); setDrawerOpen(false); setNotice('Saved copy removed from this device.'); navigate('recipes'); } } }}>Remove this saved copy</button>}
  </form> : null;

  return <>
  <div className={`app-reveal is-${introStage}`} inert={!started} aria-hidden={!started}>
  <main className="multipage-app">
    {displayRecipe && activePage === 'current' && <aside className="recipe-reading-bar" aria-label="Current recipe"><div className="reading-bar-inner">
      <div className="reading-bar-copy"><strong className={'reading-bar-title ' + (changed('title') ?? '')} title={displayRecipe.title}>{displayRecipe.title}</strong><div className="reading-bar-meta"><span className={'reading-difficulty ' + (changed('difficulty') ?? '')}>{displayRecipe.difficulty}</span><span className={'reading-batch ' + (changed('yield') ?? '')} title={displayRecipe.yield}>{scaleValid ? (displayRecipe.baseYield ? (displayRecipe.batchScale ?? 1) + '× · ' + displayRecipe.baseYield : factor + '× · ' + displayRecipe.yield) : 'Check batch multiplier'}</span></div></div>
      <div className="reading-bar-actions">
        <button type="button" className="chef-shortcut-button" aria-label="Go to AI Pastry Chef" aria-controls="ai-pastry-chef" title="Go to AI Pastry Chef" onClick={revealChef}><svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="m9 8 1.9 5.1L16 15l-5.1 1.9L9 22l-1.9-5.1L2 15l5.1-1.9L9 8Z" /><path d="m18 2 1.1 2.9L22 6l-2.9 1.1L18 10l-1.1-2.9L14 6l2.9-1.1L18 2Z" /></svg></button>
        <button type="button" className="ingredient-list-trigger secondary-button" aria-label="Ingredient List / Save" aria-haspopup="dialog" aria-expanded={drawerOpen} aria-controls="ingredient-drawer" onClick={event => { event.currentTarget.focus({ preventScroll: true }); setDrawerNotice(''); setDrawerError(''); setDrawerOpen(true); }}><span>Ingredient List</span><span className="ingredient-save-label">/ Save</span></button>
      </div>
    </div></aside>}
    <AppPages activePage={started ? activePage : 'recipes'} onNavigate={navigate} pages={{ recipes: recipeListPage, current: currentRecipePage, profile: profilePage, analytics: <AnalyticsPage user={user} authReady={authReady} events={baker.activity.completions} syncState={baker.syncState} onProfile={() => navigate('profile')} onRemove={removeBakeCompletion} onRetry={baker.retrySync} /> }} hasRecipeHeader={Boolean(displayRecipe)} />
    <IngredientDrawer open={drawerOpen && activePage === 'current'} onClose={() => setDrawerOpen(false)} recipe={displayRecipe} progress={currentProgress} onToggle={ingredientId => updateChecklist('ingredients', ingredientId)} changes={changes} batchControls={drawerBatch} batchGuidance={drawerGuidance} saveControls={drawerSave} />
  </main>
  </div>
  {(introStage === 'welcome' || introStage === 'fading') && <WelcomeScreen welcome={welcome ?? 'Welcome!'} leaving={introStage === 'fading'} onStart={startBaking} cookie={brandCookie} onCookieChange={setBrandCookie} />}
  <Notifications {...notices} layerKey={drawerOpen} />
  </>;
}
