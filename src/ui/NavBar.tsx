import { motion } from 'framer-motion';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Icon, type IconName } from './Icon';
import './nav.css';

const LINKS: { to: string; label: string; icon: IconName; match: string }[] = [
  { to: '/', label: 'Home', icon: 'home', match: '/' },
  { to: '/season', label: 'Calendario', icon: 'calendar', match: '/season' },
  { to: '/drivers', label: 'Piloti', icon: 'person', match: '/drivers' },
  { to: '/standings', label: 'Classifiche', icon: 'trophy', match: '/standings' },
];

export function NavBar() {
  const { pathname } = useLocation();
  const active = LINKS.slice()
    .reverse()
    .find((l) => (l.match === '/' ? pathname === '/' : pathname.startsWith(l.match)))?.to;
  return (
    <header className="nav-wrap">
      <nav className="nav glass" aria-label="Navigazione principale">
        <Link to="/" className="nav-logo" aria-label="Pitwall, home">
          <svg width="26" height="26" viewBox="0 0 64 64" aria-hidden>
            <defs>
              <linearGradient id="nlg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#ff453a" />
                <stop offset="1" stopColor="#ff9f0a" />
              </linearGradient>
            </defs>
            <path d="M10 42c7-16 16-23 30-23h14l-7 9h-7c-8 0-13 5-16 14z" fill="url(#nlg)" />
            <circle cx="48" cy="44" r="5" fill="#fff" />
          </svg>
          <span>Pitwall</span>
        </Link>
        <div className="nav-links">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} className="nav-link" aria-current={active === l.to ? 'page' : undefined}>
              {active === l.to && (
                <motion.span layoutId="nav-pill" className="nav-pill" transition={{ type: 'spring', stiffness: 480, damping: 38 }} />
              )}
              <Icon name={l.icon} size={17} />
              <span className="nav-label">{l.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </header>
  );
}
