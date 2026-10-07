import { motion } from 'framer-motion';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';
import type { Driver } from '../model/types';
import { teamAccent } from './livery';
import { SideCar } from './SideCar';
import { TopCar } from './TopCar';
import './car-poster.css';

/**
 * Studio "spec sheet" of a driver's car: plan view above, side view below,
 * name, team and season — like a team launch poster. Pure vector, in the
 * team colours, without sponsor or championship marks.
 */
export function CarPoster({ d, year, className }: { d: Driver; year?: number; className?: string }) {
  const accent = teamAccent(d.team, d.color);
  return (
    <figure className={`car-poster ${className ?? ''}`} style={{ ['--team' as string]: d.color }} aria-label={`Monoposto di ${d.full}, ${d.team}`}>
      <span className="cp-bignum num" aria-hidden>
        {d.num}
      </span>
      <motion.div
        className="cp-top"
        initial={{ x: '-30%', opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
      >
        <TopCar color={d.color} accent={accent} number={d.num} title={`Monoposto ${d.team} vista dall'alto`} />
      </motion.div>
      <motion.div
        className="cp-side"
        initial={{ x: '30%', opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.18 }}
      >
        <SideCar color={d.color} accent={accent} number={d.num} name={d.last} title={`Monoposto ${d.team} vista di lato`} />
      </motion.div>
      <motion.figcaption initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, duration: 0.5 }}>
        <span className="cp-swatch" />
        <span className="cp-name">
          {d.first} {d.last}
        </span>
        <span className="cp-team">{d.team}</span>
        {year && <span className="cp-year num">{year}</span>}
      </motion.figcaption>
    </figure>
  );
}

/** Full-screen sheet with the poster, rendered at the document root. */
export function CarPosterModal({ d, year, onClose }: { d: Driver; year?: number; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  return createPortal(
    <motion.div className="cp-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        className="cp-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Monoposto di ${d.full}`}
        initial={{ y: 40, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 40, opacity: 0, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 340, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="icon-btn cp-close" onClick={onClose} aria-label="Chiudi">
          <Icon name="close" />
        </button>
        <CarPoster d={d} year={year} />
      </motion.div>
    </motion.div>,
    document.body,
  );
}
