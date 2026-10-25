import { useLayoutEffect, useRef, useState } from 'react';
import { cookieArt, type CookieArtwork } from './cookieArt';
import './brand-logo.css';

type CookieRun = {
  next: CookieArtwork;
  cancelled: boolean;
  started: boolean;
  completed: boolean;
  preloader: HTMLImageElement;
  animations: Animation[];
  frames: Map<number, (active: boolean) => void>;
};

type Props = { cookie: CookieArtwork; compact?: boolean; onCookieChange?: (cookie: CookieArtwork) => void };

function cancelEffects(run: CookieRun) {
  for (const animation of run.animations) animation.cancel();
  for (const [frame, resolve] of run.frames) { cancelAnimationFrame(frame); resolve(false); }
  run.frames.clear();
  if (!run.preloader.complete) run.preloader.removeAttribute('src');
}

export default function BrandLogo({ cookie, compact = false, onCookieChange }: Props) {
  const [displayedCookie, setDisplayedCookie] = useState(cookie);
  const [incomingCookie, setIncomingCookie] = useState<CookieArtwork | null>(null);
  const [phase, setPhase] = useState<'idle' | 'loading' | 'preparing' | 'animating'>('idle');
  const currentRef = useRef<HTMLImageElement>(null);
  const incomingRef = useRef<HTMLImageElement>(null);
  const flightRef = useRef<HTMLSpanElement>(null);
  const displayedRef = useRef(cookie);
  const runRef = useRef<CookieRun | null>(null);
  const mountedRef = useRef(true);
  const onCookieChangeRef = useRef(onCookieChange);
  onCookieChangeRef.current = onCookieChange;

  function cancelRun() {
    const run = runRef.current;
    if (!run) return;
    run.cancelled = true;
    cancelEffects(run);
    runRef.current = null;
  }

  useLayoutEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; cancelRun(); };
  }, []);

  // A different page may finish its own cookie change while this one is mounted.
  useLayoutEffect(() => {
    if (cookie.id === displayedRef.current.id) return;
    cancelRun();
    displayedRef.current = cookie;
    setDisplayedCookie(cookie);
    setIncomingCookie(null);
    setPhase('idle');
  }, [cookie.id]);

  // The incoming image keeps its key when it becomes the current image. Clear
  // its finished opacity effect only after that DOM handoff, before painting.
  useLayoutEffect(() => {
    const run = runRef.current;
    if (incomingCookie || !run?.completed || displayedCookie.id !== run.next.id) return;
    cancelEffects(run);
    runRef.current = null;
  }, [displayedCookie.id, incomingCookie]);

  function isActive(run: CookieRun) { return mountedRef.current && runRef.current === run && !run.cancelled; }

  function nextFrame(run: CookieRun) {
    return new Promise<boolean>(resolve => {
      if (!isActive(run)) { resolve(false); return; }
      const frame = requestAnimationFrame(() => { run.frames.delete(frame); resolve(isActive(run)); });
      run.frames.set(frame, resolve);
    });
  }

  useLayoutEffect(() => {
    const run = runRef.current;
    if (!incomingCookie || !run || run.next.id !== incomingCookie.id) return;
    void animateCookie(run);
  }, [incomingCookie]);

  async function animateCookie(run: CookieRun) {
    if (run.started) return;
    run.started = true;
    try {
      await incomingRef.current?.decode();
      if (!await nextFrame(run) || !await nextFrame(run)) return;
      const image = currentRef.current;
      const incoming = incomingRef.current;
      const flight = flightRef.current;
      if (!isActive(run)) return;
      if (!image || !incoming || !flight) throw new Error('Cookie layers are unavailable.');
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const lift = Math.min(42, image.getBoundingClientRect().width * .4);
      const duration = reducedMotion ? 180 : 1000;
      const frames: Keyframe[] = reducedMotion ? [
        { transform: 'scale(1)' }, { transform: 'scale(.94)' }, { transform: 'scale(1)' },
      ] : [
        { transform: 'translateY(0) rotate(0deg) scale(1)', offset: 0 },
        { transform: `translateY(${-lift * .35}px) rotate(35deg) scale(.97, 1.03)`, offset: .15 },
        { transform: `translateY(${-lift}px) rotate(185deg) scale(1.03)`, offset: .4 },
        { transform: 'translateY(0) rotate(360deg) scale(1.1, .9)', offset: .75 },
        { transform: `translateY(${-lift * .15}px) rotate(360deg) scale(.98, 1.02)`, offset: .88 },
        { transform: 'translateY(0) rotate(360deg) scale(1)', offset: 1 },
      ];
      const fadeStart = reducedMotion ? 0 : .18;
      const fadeEnd = reducedMotion ? 1 : .68;
      run.animations = [
        flight.animate(frames, { duration, easing: 'ease-in-out' }),
        image.animate([{ opacity: 1, offset: 0 }, { opacity: 1, offset: fadeStart }, { opacity: 0, offset: fadeEnd }, { opacity: 0, offset: 1 }], { duration, fill: 'forwards', easing: 'ease-in-out' }),
        incoming.animate([{ opacity: 0, offset: 0 }, { opacity: 0, offset: fadeStart }, { opacity: 1, offset: fadeEnd }, { opacity: 1, offset: 1 }], { duration, fill: 'forwards', easing: 'ease-in-out' }),
      ];
      setPhase('animating');
      await Promise.all(run.animations.map(animation => animation.finished));
      if (!isActive(run)) return;
      run.completed = true;
      displayedRef.current = run.next;
      setDisplayedCookie(run.next);
      setIncomingCookie(null);
      setPhase('idle');
      onCookieChangeRef.current?.(run.next);
    } catch {
      if (!isActive(run)) return;
      cancelRun();
      setIncomingCookie(null);
      setPhase('idle');
    }
  }

  async function bounceCookie() {
    if (runRef.current) return;
    const options = cookieArt.filter(candidate => candidate.id !== displayedRef.current.id);
    const next = options[Math.floor(Math.random() * options.length)];
    const preloader = new Image();
    const run: CookieRun = { next, preloader, cancelled: false, started: false, completed: false, animations: [], frames: new Map() };
    runRef.current = run;
    setPhase('loading');
    try {
      preloader.src = next.src;
      await preloader.decode();
      if (!isActive(run)) return;
      setIncomingCookie(next);
      setPhase('preparing');
    } catch {
      if (!isActive(run)) return;
      cancelRun();
      setPhase('idle');
    }
  }

  return <div className={`brand-logo${compact ? ' brand-logo-compact' : ''}`} data-cookie={displayedCookie.id} data-next-cookie={incomingCookie?.id} data-cookie-phase={phase}>
    <button className="brand-cookie-button" type="button" aria-label={`Bounce and spin ${displayedCookie.label.toLowerCase()}`} aria-busy={phase !== 'idle'} onClick={() => void bounceCookie()}>
      <span ref={flightRef} className="brand-cookie-flight">
        <img key={displayedCookie.id} ref={currentRef} className="brand-cookie brand-cookie-current" src={displayedCookie.src} alt={displayedCookie.label} width="512" height="512" fetchPriority={compact ? 'auto' : 'high'} decoding="sync" />
        {incomingCookie && <img key={incomingCookie.id} ref={incomingRef} className="brand-cookie brand-cookie-incoming" src={incomingCookie.src} alt="" aria-hidden="true" width="512" height="512" decoding="sync" />}
      </span>
    </button>
    <svg className="brand-wordmark" viewBox="0 0 320 60" role="img" aria-label="CrumbCraft" xmlns="http://www.w3.org/2000/svg">
      <text x="160" y="46" textAnchor="middle">Crumb<tspan>Craft</tspan></text>
    </svg>
  </div>;
}
