import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { getChampionship } from '../data/sources';
import { useAsync } from '../data/useAsync';
import { gapsByLap, lapSeries, periodLaps, positionsByLap, sectorTable } from '../model/analysis';
import { COMPOUND_COLORS, COMPOUND_NAME_IT, RACE_POINTS, SPRINT_POINTS } from '../model/constants';
import { fmtClock } from '../model/derive';
import { fmtLapTime, type StandingRow } from '../model/standings';
import type { SessionData } from '../model/types';
import { median } from '../model/util';
import { Headshot } from '../ui/Headshot';
import { Icon } from '../ui/Icon';
import { LineChart, type Band, type Series } from '../ui/LineChart';
import { Segmented } from '../ui/Segmented';
import { usePlayback, useThrottledTime } from './store';
import './insights.css';

type Tab = 'laps' | 'gaps' | 'positions' | 'tyres' | 'sectors' | 'pits' | 'rc' | 'radio' | 'weather' | 'champ';

const TABS: { id: Tab; label: string; race?: boolean }[] = [
  { id: 'laps', label: 'Tempi giro' },
  { id: 'gaps', label: 'Distacchi', race: true },
  { id: 'positions', label: 'Posizioni', race: true },
  { id: 'tyres', label: 'Gomme' },
  { id: 'sectors', label: 'Settori' },
  { id: 'pits', label: 'Pit stop', race: true },
  { id: 'rc', label: 'Direzione gara' },
  { id: 'radio', label: 'Team radio' },
  { id: 'weather', label: 'Meteo' },
  { id: 'champ', label: 'Mondiale live', race: true },
];

function useFocus() {
  const selected = usePlayback((s) => s.selected);
  return selected.length ? selected : [];
}

function bandsFor(data: SessionData): Band[] {
  return periodLaps(data).map((p) => ({
    x0: p.from,
    x1: p.to,
    color: p.kind === 'RED' ? 'rgba(255,69,58,0.14)' : 'rgba(255,214,10,0.10)',
    label: p.kind === 'RED' ? 'Rossa' : p.kind,
  }));
}

function DriverChips({ data, focus }: { data: SessionData; focus: number[] }) {
  const select = usePlayback((s) => s.select);
  return (
    <div className="in-chips" role="group" aria-label="Piloti evidenziati">
      {data.drivers.map((d) => (
        <button
          key={d.num}
          className="in-chip press"
          aria-pressed={focus.includes(d.num)}
          onClick={() => select(d.num, true)}
          style={{ ['--team' as string]: d.color }}
        >
          {d.code}
        </button>
      ))}
    </div>
  );
}

function LapsTab({ data, upto }: { data: SessionData; upto: number }) {
  const focus = useFocus();
  const [mode, setMode] = useState<'abs' | 'delta'>('abs');
  const series = useMemo(() => lapSeries(data, upto), [data, upto]);
  const all = [...series.values()].flat().map((p) => p.time);
  const med = median(all);
  const ref = focus[0];
  const refMap = new Map((series.get(ref) ?? []).map((p) => [p.lap, p.time]));
  const s: Series[] = data.drivers.map((d) => {
    const pts = series.get(d.num) ?? [];
    const filtered = pts.filter((p) => mode === 'abs' || refMap.has(p.lap));
    return {
      id: String(d.num),
      label: d.code,
      color: d.color,
      width: focus.includes(d.num) ? 2.4 : 1.4,
      // pit in/out laps break the line instead of spiking the scale
      points: filtered.map((p) => [p.lap, p.pitIn || p.pitOut ? NaN : mode === 'abs' ? p.time : p.time - refMap.get(p.lap)!] as [number, number]),
      dotColors: focus.includes(d.num) ? filtered.map((p) => p.compound) : undefined,
    };
  });
  const minT = Math.min(...all);
  const yDomain: [number, number] | undefined =
    mode === 'abs' && Number.isFinite(minT) ? [minT - 0.5, Math.max(minT + 2, med * (data.meta.kind === 'race' ? 1.09 : 1.15))] : undefined;
  return (
    <div className="in-pane">
      <div className="in-toolbar">
        <Segmented
          label="Modalità"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'abs', label: 'Tempi' },
            { value: 'delta', label: ref ? `Delta vs ${data.byNum.get(ref)?.code}` : 'Delta (seleziona un pilota)' },
          ]}
        />
        <span className="dim" style={{ fontSize: 12 }}>
          I pallini mostrano la mescola dei piloti evidenziati
        </span>
      </div>
      <LineChart
        series={mode === 'delta' && !ref ? [] : s}
        height={300}
        yDomain={mode === 'delta' ? [-3, 3] : yDomain}
        bands={data.meta.kind === 'race' ? bandsFor(data) : []}
        xFormat={(v) => `G${Math.round(v)}`}
        yFormat={(v) => (mode === 'abs' ? fmtLapTime(v) : `${v > 0 ? '+' : ''}${v.toFixed(2)}s`)}
        highlight={focus.map(String)}
        xLabel="giro"
        xInteger
      />
      <DriverChips data={data} focus={focus} />
    </div>
  );
}

function GapsTab({ data, upto }: { data: SessionData; upto: number }) {
  const focus = useFocus();
  const gaps = useMemo(() => gapsByLap(data, upto), [data, upto]);
  const s: Series[] = data.drivers.map((d) => ({
    id: String(d.num),
    label: d.code,
    color: d.color,
    width: focus.includes(d.num) ? 2.4 : 1.4,
    points: (gaps.get(d.num) ?? []).filter((p) => p[1] < data.typicalLap * 1.6),
  }));
  return (
    <div className="in-pane">
      <LineChart
        series={s}
        height={320}
        invertY
        bands={bandsFor(data)}
        xFormat={(v) => `G${Math.round(v)}`}
        yFormat={(v) => `+${v.toFixed(1)}s`}
        highlight={focus.map(String)}
        xLabel="giro"
        xInteger
      />
      <DriverChips data={data} focus={focus} />
    </div>
  );
}

function PositionsTab({ data, upto }: { data: SessionData; upto: number }) {
  const focus = useFocus();
  const pos = useMemo(() => positionsByLap(data, upto), [data, upto]);
  const n = data.drivers.length;
  const s: Series[] = data.drivers.map((d) => ({
    id: String(d.num),
    label: d.code,
    color: d.color,
    width: focus.includes(d.num) ? 3 : 1.6,
    points: pos.get(d.num) ?? [],
  }));
  return (
    <div className="in-pane">
      <LineChart
        series={s}
        height={360}
        invertY
        yDomain={[0.5, n + 0.5]}
        yTicks={Array.from({ length: n }, (_, i) => i + 1).filter((v) => v === 1 || v % 2 === 0)}
        bands={bandsFor(data)}
        xFormat={(v) => (v === 0 ? 'Griglia' : `G${Math.round(v)}`)}
        yFormat={(v) => `P${Math.round(v)}`}
        highlight={focus.map(String)}
        xLabel="giro"
        xInteger
      />
      <DriverChips data={data} focus={focus} />
    </div>
  );
}

function TyresTab({ data, upto, rows }: { data: SessionData; upto: number; rows: StandingRow[] }) {
  const lapNow = Math.max(1, ...rows.map((r) => r.lap));
  const total = Math.max(data.totalLaps, ...data.stints.map((s) => s.lapEnd));
  const limit = Number.isFinite(upto) ? lapNow : total;
  const order = rows.map((r) => r.num);
  return (
    <div className="in-pane">
      <div className="tyre-legend">
        {(['SOFT', 'MEDIUM', 'HARD', 'INTERMEDIATE', 'WET'] as const).map((c) => (
          <span key={c}>
            <i style={{ background: COMPOUND_COLORS[c] }} /> {COMPOUND_NAME_IT[c]}
          </span>
        ))}
      </div>
      <div className="tyre-rows">
        {order.map((num) => {
          const d = data.byNum.get(num)!;
          const stints = data.stints.filter((s) => s.driver === num && s.lapStart <= limit);
          return (
            <div key={num} className="tyre-row">
              <span className="tyre-code" style={{ color: d.color }}>
                {d.code}
              </span>
              <div className="tyre-track">
                {stints.map((s) => {
                  const end = Math.min(s.lapEnd, limit);
                  const left = ((s.lapStart - 1) / total) * 100;
                  const width = ((end - s.lapStart + 1) / total) * 100;
                  return (
                    <span
                      key={s.n}
                      className="tyre-stint"
                      title={`${COMPOUND_NAME_IT[s.compound]} · giri ${s.lapStart}–${end} · età iniziale ${s.ageStart}`}
                      style={{ left: `${left}%`, width: `${width}%`, background: COMPOUND_COLORS[s.compound] }}
                    >
                      {width > 6 ? end - s.lapStart + 1 : ''}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SectorsTab({ data, upto }: { data: SessionData; upto: number }) {
  const { rows, best } = useMemo(() => sectorTable(data, upto), [data, upto]);
  const cls = (v: number | null, b: number) => (v != null && Math.abs(v - b) < 1e-6 ? 'purple' : '');
  return (
    <div className="in-pane">
      <table className="in-table">
        <thead>
          <tr>
            <th>Pilota</th>
            <th>Settore 1</th>
            <th>Settore 2</th>
            <th>Settore 3</th>
            <th>Miglior giro</th>
            <th>Giro ideale</th>
            <th>Velocità max</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const d = data.byNum.get(r.driver)!;
            return (
              <tr key={r.driver}>
                <td>
                  <span className="in-driver">
                    <i style={{ background: d.color }} />
                    {d.code}
                  </span>
                </td>
                <td className={`tabular ${cls(r.s1, best[0])}`}>{r.s1?.toFixed(3) ?? '—'}</td>
                <td className={`tabular ${cls(r.s2, best[1])}`}>{r.s2?.toFixed(3) ?? '—'}</td>
                <td className={`tabular ${cls(r.s3, best[2])}`}>{r.s3?.toFixed(3) ?? '—'}</td>
                <td className={`tabular ${cls(r.best, best[3])}`}>{fmtLapTime(r.best)}</td>
                <td className="tabular dim">{fmtLapTime(r.ideal)}</td>
                <td className="tabular">{r.topSpeed ? `${r.topSpeed} km/h` : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PitsTab({ data, upto }: { data: SessionData; upto: number }) {
  const pits = data.pits.filter((p) => p.t <= upto);
  const sorted = [...pits].sort((a, b) => (a.stop ?? a.lane ?? 99) - (b.stop ?? b.lane ?? 99));
  const fastest = sorted[0];
  if (!pits.length) return <p className="in-empty">Nessun pit stop finora.</p>;
  return (
    <div className="in-pane">
      {fastest && (
        <div className="in-callout">
          <Icon name="stopwatch" />
          Pit stop più veloce: <b>{data.byNum.get(fastest.driver)?.code}</b> al giro {fastest.lap}
          {fastest.stop ? ` — ${fastest.stop.toFixed(1)}s da fermo` : fastest.lane ? ` — ${fastest.lane.toFixed(1)}s in corsia` : ''}
        </div>
      )}
      <table className="in-table">
        <thead>
          <tr>
            <th>Giro</th>
            <th>Pilota</th>
            <th>Da fermo</th>
            <th>In corsia box</th>
            <th>Nuova gomma</th>
          </tr>
        </thead>
        <tbody>
          {pits.map((p, i) => {
            const d = data.byNum.get(p.driver)!;
            const next = data.stints.find((s) => s.driver === p.driver && s.lapStart > p.lap);
            return (
              <tr key={i}>
                <td className="tabular">{p.lap}</td>
                <td>
                  <span className="in-driver">
                    <i style={{ background: d.color }} />
                    {d.full}
                  </span>
                </td>
                <td className="tabular">{p.stop ? `${p.stop.toFixed(1)}s` : '—'}</td>
                <td className="tabular">{p.lane ? `${p.lane.toFixed(1)}s` : '—'}</td>
                <td>
                  {next ? (
                    <span className="in-driver">
                      <i style={{ background: COMPOUND_COLORS[next.compound] }} />
                      {COMPOUND_NAME_IT[next.compound]}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function flagColor(flag: string | null, msg: string) {
  const f = (flag ?? '').toUpperCase();
  if (f.includes('RED')) return 'var(--red)';
  if (f.includes('YELLOW') || /SAFETY CAR/.test(msg)) return 'var(--yellow)';
  if (f.includes('GREEN') || f === 'CLEAR') return 'var(--green)';
  if (f.includes('BLUE')) return 'var(--blue)';
  if (f.includes('CHEQUERED')) return '#fff';
  if (f.includes('BLACK')) return '#8e8e93';
  return 'var(--text-3)';
}

function RaceControlTab({ data, upto }: { data: SessionData; upto: number }) {
  const msgs = data.raceControl.filter((m) => m.t <= upto).reverse();
  if (!msgs.length) return <p className="in-empty">Nessun messaggio dalla direzione gara finora.</p>;
  const { seek } = usePlayback.getState();
  return (
    <ul className="rc-list">
      {msgs.map((m, i) => (
        <li key={i}>
          <button className="rc-item press" onClick={() => seek(m.t - 3)} title="Vai a questo momento">
            <i style={{ background: flagColor(m.flag, m.message) }} />
            <span className="rc-time tabular dim">{m.lap ? `G${m.lap}` : fmtClock(m.t - data.startT)}</span>
            <span className="rc-msg">{m.message}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function RadioTab({ data, upto }: { data: SessionData; upto: number }) {
  const list = data.radio.filter((r) => r.t <= upto).reverse();
  if (!data.radio.length) return <p className="in-empty">F1 non ha pubblicato team radio per questa sessione.</p>;
  if (!list.length) return <p className="in-empty">Nessun team radio finora — continua a guardare.</p>;
  return (
    <ul className="radio-list">
      {list.map((r, i) => {
        const d = data.byNum.get(r.driver);
        return (
          <li key={i} className="radio-item">
            {d && <Headshot driver={d} size={36} />}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 650 }}>{d?.full ?? `#${r.driver}`}</div>
              <div className="dim" style={{ fontSize: 12 }}>
                {fmtClock(r.t - data.startT)} dall'inizio
              </div>
            </div>
            <audio controls preload="none" src={r.url} />
          </li>
        );
      })}
    </ul>
  );
}

function WeatherTab({ data, upto }: { data: SessionData; upto: number }) {
  const w = data.weather.filter((x) => x.t <= upto);
  if (!w.length) return <p className="in-empty">Nessun dato meteo.</p>;
  const toMin = (t: number) => (t - data.startT) / 60;
  const rainBands: Band[] = [];
  let start: number | null = null;
  for (const x of w) {
    if (x.rain && start == null) start = x.t;
    if (!x.rain && start != null) {
      rainBands.push({ x0: toMin(start), x1: toMin(x.t), color: 'rgba(10,132,255,0.16)', label: 'Pioggia' });
      start = null;
    }
  }
  if (start != null) rainBands.push({ x0: toMin(start), x1: toMin(w.at(-1)!.t), color: 'rgba(10,132,255,0.16)', label: 'Pioggia' });
  const last = w.at(-1)!;
  return (
    <div className="in-pane">
      <div className="wx-cards">
        <div className="wx-card">
          <span className="dim">Aria</span>
          <b>{last.air.toFixed(1)}°</b>
        </div>
        <div className="wx-card">
          <span className="dim">Asfalto</span>
          <b>{last.track.toFixed(1)}°</b>
        </div>
        <div className="wx-card">
          <span className="dim">Umidità</span>
          <b>{Math.round(last.humidity)}%</b>
        </div>
        <div className="wx-card">
          <span className="dim">Vento</span>
          <b>
            {last.windSpeed.toFixed(1)} m/s <span style={{ display: 'inline-block', transform: `rotate(${last.windDir + 180}deg)` }}>↑</span>
          </b>
        </div>
        <div className="wx-card">
          <span className="dim">Pressione</span>
          <b>{Math.round(last.pressure)} hPa</b>
        </div>
        <div className="wx-card">
          <span className="dim">Pioggia</span>
          <b>{last.rain ? 'Sì' : 'No'}</b>
        </div>
      </div>
      <LineChart
        height={240}
        series={[
          { id: 'track', label: 'Asfalto', color: '#ff9f0a', width: 2.2, points: w.map((x) => [toMin(x.t), x.track]) },
          { id: 'air', label: 'Aria', color: '#40c8e0', width: 2.2, points: w.map((x) => [toMin(x.t), x.air]) },
        ]}
        bands={rainBands}
        xFormat={(v) => `${Math.round(v)}'`}
        yFormat={(v) => `${v.toFixed(1)}°`}
        xLabel="minuti"
      />
    </div>
  );
}

function ChampTab({ data, rows }: { data: SessionData; rows: StandingRow[] }) {
  const champ = useAsync((signal) => getChampionship(data.meta.key, signal), [data.meta.key]);
  if (data.source === 'demo') return <p className="in-empty">Il mondiale live è disponibile con i dati reali OpenF1.</p>;
  if (champ.loading) return <p className="in-empty">Caricamento classifica mondiale…</p>;
  const list = champ.data?.drivers ?? [];
  if (!list.length) return <p className="in-empty">OpenF1 non ha ancora la classifica mondiale per questa gara.</p>;
  const table = data.meta.isSprint ? SPRINT_POINTS : RACE_POINTS;
  const livePos = new Map(rows.map((r) => [r.num, r.status === 'out' ? 99 : r.pos]));
  const proj = list
    .map((c) => {
      const p = livePos.get(c.driver_number) ?? 99;
      return { ...c, live: c.points_start + (table[p - 1] ?? 0), gained: table[p - 1] ?? 0 };
    })
    .sort((a, b) => b.live - a.live);
  return (
    <div className="in-pane">
      <p className="dim" style={{ fontSize: 12, margin: '0 0 8px' }}>
        Proiezione del mondiale piloti se la gara finisse adesso (punto giro veloce escluso).
      </p>
      <table className="in-table">
        <thead>
          <tr>
            <th>Pos</th>
            <th>Pilota</th>
            <th>Prima della gara</th>
            <th>Punti oggi</th>
            <th>Live</th>
          </tr>
        </thead>
        <tbody>
          {proj.map((c, i) => {
            const d = data.byNum.get(c.driver_number);
            const move = c.position_start - (i + 1);
            return (
              <tr key={c.driver_number}>
                <td className="tabular">
                  {i + 1}{' '}
                  {move !== 0 && <span style={{ color: move > 0 ? 'var(--green)' : 'var(--red)', fontSize: 11 }}>{move > 0 ? `▲${move}` : `▼${-move}`}</span>}
                </td>
                <td>
                  <span className="in-driver">
                    <i style={{ background: d?.color ?? '#888' }} />
                    {d?.full ?? `#${c.driver_number}`}
                  </span>
                </td>
                <td className="tabular dim">{c.points_start}</td>
                <td className="tabular" style={{ color: c.gained ? 'var(--green)' : undefined }}>
                  +{c.gained}
                </td>
                <td className="tabular">
                  <b>{c.live}</b>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function InsightsSheet({ data, rows }: { data: SessionData; rows: StandingRow[] }) {
  const open = usePlayback((s) => s.insightsOpen);
  const set = usePlayback((s) => s.set);
  const [tab, setTab] = useState<Tab>('laps');
  const [spoilers, setSpoilers] = useState(false);
  const t = useThrottledTime(1000);
  const upto = spoilers ? Infinity : t;
  const isRace = data.meta.kind === 'race';
  const tabs = TABS.filter((x) => isRace || !x.race);

  return (
    <AnimatePresence>
      {open && (
        <motion.section
          className="in-sheet glass glass-strong"
          initial={{ y: 40, opacity: 0, scale: 0.98 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 40, opacity: 0, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 360, damping: 34 }}
          aria-label="Analisi della sessione"
        >
          <header className="in-head">
            <nav className="in-tabs scroll-x" aria-label="Sezioni di analisi">
              {tabs.map((x) => (
                <button key={x.id} aria-pressed={tab === x.id} onClick={() => setTab(x.id)} className="in-tab">
                  {tab === x.id && <motion.span layoutId="in-tab-thumb" className="in-tab-thumb" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
                  <span>{x.label}</span>
                </button>
              ))}
            </nav>
            <label className="in-spoiler" title="Mostra i dati di tutta la sessione, anche oltre il momento del replay">
              <input type="checkbox" checked={spoilers} onChange={(e) => setSpoilers(e.target.checked)} />
              Tutta la sessione
            </label>
            <button className="icon-btn" onClick={() => set({ insightsOpen: false })} aria-label="Chiudi analisi">
              <Icon name="close" />
            </button>
          </header>
          <div className="in-body scroll-y">
            {tab === 'laps' && <LapsTab data={data} upto={upto} />}
            {tab === 'gaps' && <GapsTab data={data} upto={upto} />}
            {tab === 'positions' && <PositionsTab data={data} upto={upto} />}
            {tab === 'tyres' && <TyresTab data={data} upto={upto} rows={rows} />}
            {tab === 'sectors' && <SectorsTab data={data} upto={upto} />}
            {tab === 'pits' && <PitsTab data={data} upto={upto} />}
            {tab === 'rc' && <RaceControlTab data={data} upto={upto} />}
            {tab === 'radio' && <RadioTab data={data} upto={upto} />}
            {tab === 'weather' && <WeatherTab data={data} upto={upto} />}
            {tab === 'champ' && <ChampTab data={data} rows={rows} />}
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}

