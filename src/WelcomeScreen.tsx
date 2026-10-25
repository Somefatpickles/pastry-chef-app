import BrandLogo from './BrandLogo';
import type { CookieArtwork } from './cookieArt';
import './welcome-screen.css';

type Props = { welcome: string; leaving: boolean; onStart: () => void; cookie: CookieArtwork; onCookieChange: (cookie: CookieArtwork) => void };

export default function WelcomeScreen({ welcome, leaving, onStart, cookie, onCookieChange }: Props) {
  return <main className={`welcome-screen ${leaving ? 'is-leaving' : ''}`} aria-labelledby="welcome-title">
    <section className="intro-card welcome-card">
      <BrandLogo cookie={cookie} onCookieChange={onCookieChange} />
      <h1 id="welcome-title" className="welcome-title">{welcome}</h1>
      <p className="welcome-description">With CrumbCraft, you can learn and practice standard pastry chef recipes, progress through to more complex offerings, and even use an AI Pastry Chef to tailor recipes to your own needs, with useful tips along the way.</p>
      <button className="start-button" onClick={onStart} disabled={leaving} type="button">Start Baking!</button>
    </section>
    <footer className="welcome-credit">An app made for curious bakers by Pixel &amp; Principle</footer>
  </main>;
}
