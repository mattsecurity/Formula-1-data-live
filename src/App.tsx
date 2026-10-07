import { lazy, Suspense, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Route, Routes, useLocation } from 'react-router-dom';
import { Page } from './ui/motion';
import { NavBar } from './ui/NavBar';
import HomePage from './pages/HomePage';

const SeasonPage = lazy(() => import('./pages/SeasonPage'));
const MeetingPage = lazy(() => import('./pages/MeetingPage'));
const DriversPage = lazy(() => import('./pages/DriversPage'));
const StandingsPage = lazy(() => import('./pages/StandingsPage'));
const ReplayPage = lazy(() => import('./replay/ReplayPage'));
const LapLabPage = lazy(() => import('./lab/LapLabPage'));

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);
  return null;
}

export default function App() {
  const location = useLocation();
  const { pathname } = location;
  const immersive = pathname.startsWith('/replay') || pathname.startsWith('/lab');
  useEffect(() => {
    if (!immersive) document.title = 'Pitwall · F1 Replay';
  }, [immersive, pathname]);
  return (
    <>
      <ScrollTop />
      {!immersive && (
        <div className="ambient" aria-hidden>
          <i />
          <i />
          <i />
        </div>
      )}
      {!immersive && <NavBar />}
      <Suspense fallback={<div className="page"><div className="skeleton" style={{ height: 320 }} /></div>}>
        <AnimatePresence mode="wait">
          <Routes location={location} key={pathname}>
            <Route path="/" element={<Page><HomePage /></Page>} />
            <Route path="/season/:year?" element={<Page><SeasonPage /></Page>} />
            <Route path="/meeting/:key" element={<Page><MeetingPage /></Page>} />
            <Route path="/drivers/:year?" element={<Page><DriversPage /></Page>} />
            <Route path="/standings/:year?" element={<Page><StandingsPage /></Page>} />
            <Route path="/replay/:key" element={<Page plain><ReplayPage /></Page>} />
            <Route path="/lab/:key" element={<Page plain><LapLabPage /></Page>} />
            <Route path="*" element={<Page><HomePage /></Page>} />
          </Routes>
        </AnimatePresence>
      </Suspense>
    </>
  );
}
