import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import type { ChefResult, Recipe } from './types';
import { firebaseAuth, isFirebaseConfigured } from './firebase';
import { displayIngredientAmount } from '../shared/baking-measures.mjs';
import { toUsChefResult } from '../shared/us-recipe-text.mjs';
import { ChefSessionEndedError, hasChefAccount, requestChefWithSession } from '../shared/chef-session.mjs';
import { chooseChefPrompts, type ChefPromptSelection } from '../shared/chef-prompts.mjs';
import './chef-auth.css';

type Notify = (message: string, kind?: 'success' | 'error' | 'info') => void;
type Props = { recipe: Recipe; sourceRecipeId: string; onApply: (result: ChefResult, request: string) => void; user: User | null; authReady: boolean; notify: Notify };
type WorkbenchProps = Omit<Props, 'user' | 'authReady'> & { user: User; focusOnMount: boolean; onFocusConsumed: () => void; promptSelection: ChefPromptSelection };

function authErrorCode(reason: unknown) {
  return reason && typeof reason === 'object' && 'code' in reason && typeof reason.code === 'string' ? reason.code : '';
}

function accountErrorMessage(reason: unknown, creating: boolean) {
  switch (authErrorCode(reason)) {
    case 'auth/email-already-in-use': return 'That email already has an account. Choose Sign in to continue.';
    case 'auth/invalid-email': return 'Enter a valid email address.';
    case 'auth/weak-password': return 'Use at least 6 characters for your password.';
    case 'auth/invalid-credential': case 'auth/user-not-found': case 'auth/wrong-password': return 'Sign-in failed. Check your email and password.';
    case 'auth/too-many-requests': return 'Too many attempts. Wait a moment and try again.';
    case 'auth/network-request-failed': return 'Could not connect. Check your connection and try again.';
    case 'auth/operation-not-allowed': return 'Email and password sign-in is currently unavailable. Please try again later.';
    default: return creating ? 'Your account could not be created. Please try again.' : 'Sign-in failed. Please try again.';
  }
}

export default function ChefPanel({ user, authReady, notify, ...recipeProps }: Props) {
  const [promptSelection] = useState(chooseChefPrompts);
  const [mode, setMode] = useState<'create' | 'sign-in'>('create');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [focusOnUnlock, setFocusOnUnlock] = useState(false);
  const mountedRef = useRef(false);
  const authPendingRef = useRef(false);
  const consumeFocus = useCallback(() => setFocusOnUnlock(false), []);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  async function authenticate(event: React.FormEvent) {
    event.preventDefault();
    if (!firebaseAuth || !authReady || authPendingRef.current) return;
    const form = event.currentTarget as HTMLFormElement;
    const emailInput = form.querySelector<HTMLInputElement>('#chef-account-email');
    if (!email.trim() || !emailInput?.validity.valid) { emailInput?.focus(); notify('Enter a valid email address.', 'error'); return; }
    if (password.length < 6) { form.querySelector<HTMLInputElement>('#chef-account-password')?.focus(); notify('Use at least 6 characters for your password.', 'error'); return; }
    authPendingRef.current = true;
    setAuthBusy(true); setFocusOnUnlock(true);
    const creating = mode === 'create';
    try {
      const credential = creating ? await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password) : await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
      if (mountedRef.current) setPassword('');
      if (firebaseAuth.currentUser?.uid === credential.user.uid && hasChefAccount(credential.user)) {
        notify('Your AI Pastry Chef is ready. You can adjust your profile on the Profile page.', 'success');
      }
    } catch (reason) {
      if (mountedRef.current) { setFocusOnUnlock(false); notify(accountErrorMessage(reason, creating), 'error'); }
    } finally {
      authPendingRef.current = false;
      if (mountedRef.current) setAuthBusy(false);
    }
  }

  if (authReady && user && hasChefAccount(user)) return <AuthenticatedChef key={user.uid} {...recipeProps} user={user} notify={notify} focusOnMount={focusOnUnlock} onFocusConsumed={consumeFocus} promptSelection={promptSelection} />;

  const canAuthenticate = authReady && isFirebaseConfigured && Boolean(firebaseAuth);
  return <section id="ai-pastry-chef" className="chef-panel chef-account-gate" tabIndex={-1} aria-labelledby="chef-title">
    <div className="chef-heading"><h3 id="chef-title">AI Pastry Chef</h3><span className="chef-status">{!authReady ? 'Checking your profile…' : canAuthenticate ? 'Sign in to unlock' : 'Sign-in unavailable'}</span></div>
    <h4 className="chef-account-title">{mode === 'create' ? 'Create your baking profile' : 'Welcome back to your kitchen'}</h4>
    <p>{canAuthenticate ? 'Use your email and password to unlock recipe adaptations, substitutions and useful tips from your AI Pastry Chef.' : !authReady ? 'Your baking profile is loading.' : 'Account sign-in is currently unavailable. Please try again later.'}</p>
    <form className="chef-account-form" noValidate onSubmit={event => void authenticate(event)}>
      <div className="chef-account-fields">
        <label htmlFor="chef-account-email">Email<input id="chef-account-email" type="email" autoComplete="email" required value={email} disabled={!canAuthenticate || authBusy} onChange={event => setEmail(event.target.value)} /></label>
        <label htmlFor="chef-account-password">Password<input id="chef-account-password" type="password" autoComplete={mode === 'create' ? 'new-password' : 'current-password'} required minLength={6} value={password} disabled={!canAuthenticate || authBusy} onChange={event => setPassword(event.target.value)} /></label>
      </div>
      <div className="button-row">
        <button type="submit" className="completion-button" disabled={!canAuthenticate || authBusy}>{authBusy ? 'Please wait…' : mode === 'create' ? 'Create account & unlock chef' : 'Sign in & unlock chef'}</button>
        <button type="button" className="text-button" disabled={!canAuthenticate || authBusy} onClick={() => setMode(mode === 'create' ? 'sign-in' : 'create')}>{mode === 'create' ? 'Already have an account? Sign in' : 'Create a baking profile'}</button>
      </div>
    </form>
  </section>;
}

class ChefReplyError extends Error {}

function AuthenticatedChef({ recipe, sourceRecipeId, onApply, user, notify, focusOnMount, onFocusConsumed, promptSelection }: WorkbenchProps) {
  const [request, setRequest] = useState('');
  const [context, setContext] = useState('');
  const [busy, setBusy] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [result, setResult] = useState<ChefResult | null>(null);
  const displayResult = useMemo(() => toUsChefResult(result), [result]);
  const [submitted, setSubmitted] = useState('');
  const requestRef = useRef<HTMLTextAreaElement>(null);
  const activeRef = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const ownerIsCurrent = () => activeRef.current && firebaseAuth?.currentUser?.uid === user.uid && hasChefAccount(firebaseAuth.currentUser);
  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
      controllerRef.current?.abort();
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    };
  }, []);
  useEffect(() => {
    if (!focusOnMount) return;
    const frame = requestAnimationFrame(() => { requestRef.current?.focus({ preventScroll: true }); onFocusConsumed(); });
    return () => cancelAnimationFrame(frame);
  }, [focusOnMount, onFocusConsumed]);
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/chef/status', { signal: controller.signal }).then(r => r.ok ? r.json() : null).then(data => { if (!controller.signal.aborted) setAvailable(Boolean(data?.available)); }).catch(() => { if (!controller.signal.aborted) setAvailable(false); });
    return () => controller.abort();
  }, []);

  async function askChef(event: React.FormEvent) {
    event.preventDefault();
    if (controllerRef.current || !request.trim() || available !== true || !ownerIsCurrent()) return;
    const fullRequest = context ? `Previous request: ${context.slice(-900)}\nBaker clarification: ${request.trim().slice(0, 1000)}` : request.trim();
    const controller = new AbortController();
    controllerRef.current = controller;
    let timedOut = false;
    const timeout = window.setTimeout(() => { timedOut = true; controller.abort(); }, 100000);
    timeoutRef.current = timeout;
    setBusy(true); setResult(null); setSubmitted(fullRequest);
    try {
      const recipeForChef = { ...recipe };
      delete recipeForChef.adaptation;
      const response = await requestChefWithSession({ user, payload: { recipeId: sourceRecipeId, recipe: recipeForChef, request: fullRequest }, isCurrent: ownerIsCurrent, signal: controller.signal });
      if (!ownerIsCurrent() || controller.signal.aborted) return;
      if (response.status === 401) {
        notify('Please sign in again to use your AI Pastry Chef.', 'error');
        if (firebaseAuth && ownerIsCurrent()) await signOut(firebaseAuth).catch(() => {});
        return;
      }
      let data;
      try { data = await response.json(); } catch { throw new ChefReplyError('The chef returned an unreadable reply. Please try again.'); }
      if (!ownerIsCurrent() || controller.signal.aborted) return;
      if (!response.ok) throw new ChefReplyError(typeof data.error === 'string' ? data.error.slice(0, 500) : 'The chef could not complete this request.');
      setResult(data as ChefResult);
      if (data.questions?.length) { setContext(fullRequest); setRequest(''); }
      else setContext('');
    } catch (reason) {
      if (!ownerIsCurrent()) return;
      if (timedOut) notify('The chef took too long to respond. Your recipe is unchanged; please try again.', 'error');
      else if (reason instanceof ChefSessionEndedError || ['auth/user-token-expired', 'auth/invalid-user-token', 'auth/user-disabled'].includes(authErrorCode(reason))) {
        notify('Please sign in again to use your AI Pastry Chef.', 'error');
        if (firebaseAuth) await signOut(firebaseAuth).catch(() => {});
      } else if (reason instanceof ChefReplyError) notify(reason.message, 'error');
      else notify('Could not reach the chef. Check your connection and try again.', 'error');
    } finally {
      window.clearTimeout(timeout);
      if (timeoutRef.current === timeout) timeoutRef.current = null;
      if (controllerRef.current === controller) controllerRef.current = null;
      if (ownerIsCurrent()) setBusy(false);
    }
  }

  function applyProposal() {
    if (!ownerIsCurrent() || !result) return;
    onApply(result, submitted);
  }

  return <section id="ai-pastry-chef" className="chef-panel" tabIndex={-1} aria-labelledby="chef-title">
    <div className="chef-heading"><h3 id="chef-title">AI Pastry Chef</h3><span className={`chef-status ${available ? 'online' : ''}`}>{available === null ? 'Checking…' : available ? 'Ready to help' : 'Currently unavailable'}</span></div>
    <p>Tell the chef what you have, what you need to avoid, or how you want to change this recipe. Review the proposal before applying it.</p>
    <div className="prompt-chips" aria-label="Example requests">
      {promptSelection.suggestions.map(text => <button type="button" key={text} disabled={busy} onClick={() => { setRequest(text); setContext(''); }}>{text}</button>)}
    </div>
    <form onSubmit={askChef}>
      <label htmlFor="chef-request">{context ? 'Answer the chef’s questions' : 'What would you like to change?'}</label>
      <textarea ref={requestRef} id="chef-request" value={request} onChange={event => setRequest(event.target.value)} maxLength={context ? 1000 : 2000} rows={3} placeholder={promptSelection.placeholder} required disabled={busy} />
      {context && <button type="button" className="text-button" disabled={busy} onClick={() => { setContext(''); setRequest(''); setResult(null); }}>Start a new request</button>}
      <div className="chef-submit"><small>Only this recipe and your message are sent to OpenAI. Adaptations are suggestions and have not been kitchen tested.</small><button type="submit" className="completion-button" disabled={busy || available !== true || !request.trim()}>{busy ? 'Chef is thinking…' : context ? 'Send clarification' : 'Ask the chef'}</button></div>
    </form>
    <div aria-live="polite" aria-busy={busy}>
      {busy && <p className="busy-note">Checking the formula, method, and ingredient tradeoffs. This can take about a minute.</p>}
      {displayResult && <div className="chef-proposal">
        <p className="eyebrow">{displayResult.source === 'local' ? 'CALCULATED BATCH CHANGE' : 'CHEF’S PROPOSAL'}</p>
        <h4>{displayResult.summary}</h4>
        {displayResult.questions.length > 0 ? <><p>The chef needs a little more information. Your recipe is unchanged.</p><ul>{displayResult.questions.map((q, i) => <li key={i}>{q}</li>)}</ul></> : <>
          <ul>{displayResult.changes.map((change, i) => <li key={i}>{change}</li>)}</ul>
          <details><summary>Preview the complete adapted recipe</summary><p><strong>{displayResult.recipe.title}</strong> · {displayResult.recipe.yield} · {displayResult.recipe.time}</p><ul>{displayResult.recipe.ingredients.map(i => { const measure = displayIngredientAmount(i); return <li key={i.id}>{measure.amount} {i.name}{i.note ? ` — ${i.note}` : ''}{measure.note ? ` (${measure.note})` : ''}</li>; })}</ul><ol>{displayResult.recipe.steps.map(s => <li key={s.id}><strong>{s.title}.</strong> {s.detail}{s.why ? ` Why: ${s.why}` : ''}</li>)}</ol><p>{displayResult.recipe.storage}</p></details>
        </>}
        {displayResult.considerations.length > 0 && <div className="considerations"><strong>Keep in mind</strong><ul>{displayResult.considerations.map((note, i) => <li key={i}>{note}</li>)}</ul></div>}
        {!displayResult.questions.length && <div className="button-row"><button type="button" className="completion-button" onClick={applyProposal}>Apply to working recipe</button><button type="button" className="secondary-button" onClick={() => setResult(null)}>Dismiss proposal</button></div>}
      </div>}
    </div>
    <p className="chef-footnote">For allergy changes, verify ingredient labels and shared equipment. The chef cannot guarantee an allergen-free result.</p>
  </section>;
}
