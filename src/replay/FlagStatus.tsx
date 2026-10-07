import { AnimatePresence, motion } from 'framer-motion';
import { flagStateAt, marshalRange, nearestCorner, type TrackFlag } from '../model/flags';
import type { SessionData } from '../model/types';
import { WavingFlag } from '../ui/WavingFlag';
import { useThrottledTime } from './store';

const TITLE: Record<TrackFlag, string> = {
  green: 'Bandiera verde',
  yellow: 'Bandiera gialla',
  'double-yellow': 'Doppia gialla',
  red: 'Bandiera rossa',
  sc: 'Safety Car',
  vsc: 'Virtual Safety Car',
  chequered: 'Bandiera a scacchi',
  none: 'Pre-partenza',
};

/** Compact waving flag with the current track condition, shown in the control dock. */
export function FlagStatus({ data }: { data: SessionData }) {
  const t = useThrottledTime(250);
  const st = flagStateAt(data, t);
  let sub = '';
  if (st.flag === 'yellow' || st.flag === 'double-yellow') {
    const secs = [...new Set(st.sectors.map((s) => s.sector))].sort((a, b) => a - b);
    const first = marshalRange(data, secs[0]);
    const corner = first ? nearestCorner(data, ((first[0] + first[1]) / 2) % 1) : null;
    sub = `${secs.length > 1 ? 'Settori' : 'Settore'} ${secs.join(', ')}${corner ? ` · T${corner.num}${corner.name ? ` ${corner.name}` : ''}` : ''}`;
  } else if (st.flag === 'red') sub = 'Sessione sospesa';
  else if (st.flag === 'sc') sub = 'Sorpassi vietati';
  else if (st.flag === 'vsc') sub = 'Delta obbligatorio';
  else if (st.flag === 'green') sub = st.sectors.length ? '' : 'Pista libera';
  else if (st.flag === 'chequered') sub = 'Fine sessione';
  else sub = 'In attesa del via';

  return (
    <div className={`flag-status fs-${st.flag}`} role="status" aria-label={`${TITLE[st.flag]}${sub ? `, ${sub}` : ''}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={st.flag}
          className="fs-flag"
          initial={{ opacity: 0, y: 8, rotate: -8 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ type: 'spring', stiffness: 300, damping: 22 }}
        >
          {st.flag === 'none' ? <span className="fs-dot" /> : <WavingFlag kind={st.flag} size={st.flag === 'double-yellow' ? 0.62 : 0.9} />}
        </motion.div>
      </AnimatePresence>
      <div className="fs-text">
        <b>{TITLE[st.flag]}</b>
        <span title={sub}>{sub}</span>
      </div>
    </div>
  );
}
