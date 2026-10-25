import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { User } from 'firebase/auth';
import { buildBakeAnalytics, type BakeCompletion } from '../shared/bake-history.mjs';
import { hasChefAccount } from '../shared/chef-session.mjs';
import { toUsText } from '../shared/us-recipe-text.mjs';
import './analytics-page.css';

type Props = {
  user: User | null;
  authReady: boolean;
  events: BakeCompletion[];
  syncState: string;
  onProfile: () => void;
  onRemove: (id: string) => void;
  onRetry?: () => void;
};
type Metric = 'total' | 'difficulty' | 'category' | 'unique';
type Interval = 'day' | 'week' | 'month';
type ChartData = ReturnType<typeof buildBakeAnalytics>;

const levelColors: Record<string, string> = { Novice: '#a3782f', Intermediate: '#b05d3b', Experienced: '#796198', Challenges: '#3f6a89' };
const colors = ['#af6a40', '#557c68', '#766297', '#426b8c', '#a47f35', '#9d5563', '#477d7c', '#746e43', '#826147', '#5b6a95', '#a36c91', '#74884b', '#a25b49'];
const metricLabels: Record<Metric, string> = { total: 'Total bakes', difficulty: 'Bakes by difficulty', category: 'Bakes by category', unique: 'Distinct recipes' };
const metricHelp: Record<Metric, string> = {
  total: 'Every logged completion counts, including recipes you bake again.',
  difficulty: 'See how each skill level contributes to your baking history.',
  category: 'Compare the kinds of recipes you have been making.',
  unique: 'Bars count different recipes in each period. The line counts each recipe once across the selected range.',
};
const number = (value: number) => new Intl.NumberFormat().format(value);
const date = (value: string, full = false) => new Intl.DateTimeFormat(undefined, { year: full ? 'numeric' : undefined, month: 'short', day: 'numeric' }).format(new Date(value));
const credit = <footer className="kitchen-footer">An app made for curious bakers by Pixel &amp; Principle.</footer>;

export default function AnalyticsPage({ user, authReady, events, syncState, onProfile, onRemove, onRetry }: Props) {
  if (!authReady || !hasChefAccount(user)) return <div className="page-content analytics-page">
    <section className="panel analytics-shell">
      <header className="page-heading"><h1>Analytics</h1><p>A little practice, a story of progress.</p></header>
      <section className="analytics-account-gate" aria-labelledby="analytics-gate-title">
        <svg className="analytics-gate-icon" viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="M11 50V32h9v18m7 0V21h9v29m7 0V12h9v38" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" /><path d="m11 23 17-9 12 2L53 6M48 6h5v5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <h2 id="analytics-gate-title">{authReady ? 'Your baking journey, in view' : 'Checking your baking profile…'}</h2>
        <p>{authReady ? 'Create a profile or sign in to explore your baking history, follow your progress and see which recipes you return to.' : 'Your progress will be ready once your profile has loaded.'}</p>
        {authReady && <><p className="analytics-gate-note">You can keep logging bakes on this device while signed out.</p><button type="button" className="completion-button" onClick={onProfile}>Create a profile / Sign in</button></>}
      </section>
    </section>{credit}
  </div>;
  return <BakingAnalytics key={user!.uid} events={events} syncState={syncState} onRemove={onRemove} onRetry={onRetry} />;
}

function BakingAnalytics({ events, syncState, onRemove, onRetry }: Pick<Props, 'events' | 'syncState' | 'onRemove' | 'onRetry'>) {
  const [metric, setMetric] = useState<Metric>('difficulty');
  const [interval, setInterval] = useState<Interval>('week');
  const [range, setRange] = useState('90');
  const [category, setCategory] = useState('');
  const [historyCount, setHistoryCount] = useState(20);
  const today = new Date().toDateString();
  const chart = useMemo(() => buildBakeAnalytics(events, { metric, interval, rangeDays: range === 'all' ? null : Number(range), category: category || undefined }), [events, metric, interval, range, category, today]);
  const visibleEvents = useMemo(() => events.filter(event => !event.deletedAt && (!category || event.category === category) && Date.parse(event.completedAt) >= Date.parse(chart.rangeStart) && Date.parse(event.completedAt) <= Date.parse(chart.rangeEnd)).sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt)), [events, category, chart.rangeStart, chart.rangeEnd]);
  useEffect(() => { setHistoryCount(20); }, [range, category]);
  useEffect(() => { if (category && !chart.categories.includes(category)) setCategory(''); }, [chart.categories, category]);
  const syncing = ['loading', 'syncing'].includes(syncState);
  const syncError = ['error', 'offline'].includes(syncState);
  const syncLabel = syncing ? 'Syncing baking history…' : syncError ? 'Saved on this device · sync needs attention' : ['ready', 'synced'].includes(syncState) ? 'Baking history synced' : 'Saved on this device';
  const latest = visibleEvents[0];

  return <div className="page-content analytics-page">
    <section className="panel analytics-shell">
      <header className="page-heading analytics-heading"><div><h1>Analytics</h1><p>Your practice, one bake at a time.</p></div><span className={`analytics-sync ${syncError ? 'needs-attention' : ''}`}>{syncLabel}</span></header>
      {syncError && <div className="analytics-sync-retry"><p>Your baking history is kept on this device. Retry syncing when your connection is ready.</p>{onRetry && <button type="button" className="secondary-button" onClick={onRetry}>Retry sync</button>}</div>}
      <div className="analytics-controls">
        <label className="field-label">Metric<select aria-label="Analytics metric" value={metric} onChange={event => setMetric(event.target.value as Metric)}><option value="total">Total bakes</option><option value="difficulty">By difficulty</option><option value="category">By category</option><option value="unique">Distinct recipes</option></select></label>
        <label className="field-label">Date range<select aria-label="Analytics date range" value={range} onChange={event => { setRange(event.target.value); if (event.target.value === 'all') setInterval('month'); }}><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last year</option><option value="all">All history</option></select></label>
        <label className="field-label">Group by<select aria-label="Analytics period" value={interval} onChange={event => setInterval(event.target.value as Interval)}><option value="day">Day</option><option value="week">Week</option><option value="month">Month</option></select></label>
        <label className="field-label">Category<select aria-label="Analytics category" value={category} onChange={event => setCategory(event.target.value)}><option value="">All categories</option>{chart.categories.map(item => <option key={item}>{item}</option>)}</select></label>
      </div>
      <div className="analytics-totals" aria-label="Progress in selected date range">
        <div><span>Bakes logged</span><strong>{number(chart.totalCompletions)}</strong></div>
        <div><span>Different recipes</span><strong>{number(chart.uniqueRecipes)}</strong></div>
        <div><span>Most recent bake</span><strong className="analytics-latest-date">{latest ? date(latest.completedAt, true) : 'Still to come'}</strong></div>
      </div>
      <section className="analytics-chart-card" aria-labelledby="analytics-chart-title">
        <header><h2 id="analytics-chart-title">{metricLabels[metric]}</h2><p>{metricHelp[metric]}</p></header>
        {visibleEvents.length ? <BakeChart data={chart} metric={metric} interval={interval} /> : <div className="analytics-empty"><span aria-hidden="true">✦</span><h3>{events.some(event => !event.deletedAt) ? 'No bakes in this view yet' : 'Your first bake starts the story'}</h3><p>{events.some(event => !event.deletedAt) ? 'Try a different date range or category.' : 'Finish a recipe and choose “Log as completed” below its instructions. Bake it again and log it again—both visits belong here.'}</p></div>}
        <p className="analytics-range-note">{date(chart.rangeStart, true)} – {date(chart.rangeEnd, true)} · Weeks start on Monday.</p>
      </section>
      <section className="analytics-history" aria-labelledby="analytics-history-title">
        <header><h2 id="analytics-history-title">Bake history</h2><p>{visibleEvents.length ? `${number(visibleEvents.length)} ${visibleEvents.length === 1 ? 'completion' : 'completions'} in this view. Every repeat bake has its own date.` : 'Your dated recipe completions will appear here.'}</p></header>
        {visibleEvents.length > 0 && <ol>{visibleEvents.slice(0, historyCount).map(event => <li key={event.id} data-completion-id={event.id}><div><strong>{toUsText(event.title)}</strong><time dateTime={event.completedAt}>{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(event.completedAt))}</time><p><span>{event.difficulty}</span><span>{event.category}</span></p></div><button type="button" className="analytics-remove" aria-label={`Remove completion of ${toUsText(event.title)} on ${date(event.completedAt, true)}`} title="Remove this completion" onClick={() => onRemove(event.id)}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6" /></svg></button></li>)}</ol>}
        {visibleEvents.length > historyCount && <button type="button" className="secondary-button analytics-show-more" onClick={() => setHistoryCount(count => count + 20)}>Show more bakes</button>}
      </section>
    </section>{credit}
  </div>;
}

function axisMaximum(value: number) {
  if (value <= 4) return 4;
  const step = 10 ** Math.floor(Math.log10(value / 4));
  const unit = [1, 2, 5, 10].find(candidate => candidate * step >= value / 4) ?? 10;
  return unit * step * 4;
}

function BakeChart({ data, metric, interval }: { data: ChartData; metric: Metric; interval: Interval }) {
  const id = useId().replace(/:/g, '');
  const wrap = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const [availableWidth, setAvailableWidth] = useState(760);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  useEffect(() => {
    if (!wrap.current) return;
    const observer = new ResizeObserver(entries => setAvailableWidth(entries[0]?.contentRect.width ?? 760));
    observer.observe(wrap.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => { setActiveIndex(null); }, [data]);
  const margin = { left: 40, right: 42, top: 36, bottom: 46 };
  const width = Math.max(220, availableWidth, data.buckets.length * 8 + margin.left + margin.right);
  const height = 300;
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const step = plotWidth / Math.max(1, data.buckets.length);
  const barWidth = Math.max(2, Math.min(44, step * .67));
  const maximum = axisMaximum(data.buckets.reduce((highest, bucket) => Math.max(highest, bucket.total), 0));
  const cumulativeMaximum = axisMaximum(data.buckets.reduce((highest, bucket) => Math.max(highest, bucket.cumulative), 0));
  const y = (value: number) => margin.top + plotHeight * (1 - value / maximum);
  const lineY = (value: number) => margin.top + plotHeight * (1 - value / cumulativeMaximum);
  const x = (index: number) => margin.left + step * (index + .5);
  const palette = Object.fromEntries(data.seriesKeys.map((key, index) => [key, metric === 'difficulty' ? levelColors[key] ?? colors[index % colors.length] : colors[index % colors.length]]));
  const line = data.buckets.map((bucket, index) => `${index ? 'L' : 'M'}${x(index)},${lineY(bucket.cumulative)}`).join(' ');
  const selectedIndex = Math.min(activeIndex ?? data.buckets.length - 1, data.buckets.length - 1);
  const selected = data.buckets[selectedIndex];
  const labelCount = Math.min(data.buckets.length, Math.max(2, Math.floor(plotWidth / 85) + 1));
  const labelIndices = new Set(Array.from({ length: labelCount }, (_, index) => labelCount === 1 ? 0 : Math.round(index * (data.buckets.length - 1) / (labelCount - 1))));
  const horizontal = width > availableWidth + 1;

  function explore(event: KeyboardEvent<SVGGElement>, index: number) {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setActiveIndex(index); return; }
    const next = event.key === 'ArrowLeft' ? Math.max(0, index - 1) : event.key === 'ArrowRight' ? Math.min(data.buckets.length - 1, index + 1) : event.key === 'Home' ? 0 : event.key === 'End' ? data.buckets.length - 1 : null;
    if (next === null) return;
    event.preventDefault(); setActiveIndex(next);
    svg.current?.querySelector<SVGGElement>(`[data-bucket-index="${next}"]`)?.focus({ preventScroll: true });
    svg.current?.querySelector<SVGGElement>(`[data-bucket-index="${next}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  return <>
    <div ref={wrap} className="analytics-chart-viewport">
      <svg ref={svg} viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="group" aria-labelledby={`${id}-title ${id}-description`} className="analytics-chart">
        <title id={`${id}-title`}>{metricLabels[metric]} over time</title><desc id={`${id}-description`}>Bars show completions in each {interval}; the blue line shows the running total in the selected date range. Bar counts use the left axis; running totals use the right axis. Focus a period and use arrow keys to explore, or open the data table below.</desc>
        <text className="analytics-axis-caption" x={margin.left} y={16}>Per {interval}</text><text className="analytics-axis-caption analytics-line-caption" x={width - margin.right} y={16} textAnchor="end">Running total</text>
        {[0, 1, 2, 3, 4].map(index => <g key={index} aria-hidden="true"><line className="analytics-grid-line" x1={margin.left} x2={width - margin.right} y1={y(maximum * index / 4)} y2={y(maximum * index / 4)} /><text className="analytics-axis-label" x={margin.left - 9} y={y(maximum * index / 4) + 4} textAnchor="end">{number(maximum * index / 4)}</text><text className="analytics-axis-label analytics-line-caption" x={width - margin.right + 9} y={y(maximum * index / 4) + 4}>{number(cumulativeMaximum * index / 4)}</text></g>)}
        {data.buckets.map((bucket, index) => {
          let offset = 0;
          return <g key={bucket.key} data-bucket-index={index} role="button" tabIndex={0} aria-pressed={selectedIndex === index} aria-label={`${bucket.label}: ${number(bucket.total)} ${metric === 'unique' ? 'distinct recipes' : 'bakes'}, running total ${number(bucket.cumulative)}`} className={`analytics-bucket ${selectedIndex === index ? 'is-selected' : ''}`} onFocus={() => setActiveIndex(index)} onMouseEnter={() => setActiveIndex(index)} onClick={() => setActiveIndex(index)} onKeyDown={event => explore(event, index)}>
            <title>{bucket.label}: {number(bucket.total)} {metric === 'unique' ? 'distinct recipes' : 'bakes'}</title>
            <rect className="analytics-bucket-hit" x={margin.left + step * index} y={margin.top} width={step} height={plotHeight} fill="transparent" />
            {data.seriesKeys.map(key => { const value = bucket.values[key] ?? 0; const bottom = offset; offset += value; return value > 0 ? <rect key={key} className="analytics-bar" x={x(index) - barWidth / 2} y={y(offset)} width={barWidth} height={Math.max(0, y(bottom) - y(offset))} fill={palette[key]} /> : null; })}
          </g>;
        })}
        <path className="analytics-trend-line" d={line} fill="none" stroke="#24577e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />
        {selected && <circle cx={x(selectedIndex)} cy={lineY(selected.cumulative)} r="4.5" fill="#24577e" stroke="#fffcf7" strokeWidth="2" pointerEvents="none" />}
        {data.buckets.map((bucket, index) => labelIndices.has(index) ? <text key={bucket.key} className="analytics-axis-label" x={x(index)} y={height - margin.bottom + 23} textAnchor="middle" aria-hidden="true">{date(bucket.start)}</text> : null)}
      </svg>
    </div>
    {horizontal && <p className="analytics-scroll-hint">Scroll the chart sideways to explore every period.</p>}
    <div className="analytics-legend" aria-label="Chart legend">{data.seriesKeys.map(key => <span key={key}><i style={{ background: palette[key] }} aria-hidden="true" />{key}</span>)}<span><i className="analytics-legend-line" aria-hidden="true" />Running total</span></div>
    {selected && <div className="analytics-period-detail" aria-live="polite" aria-atomic="true"><strong>{selected.label}</strong><span>{number(selected.total)} {metric === 'unique' ? 'distinct recipes' : selected.total === 1 ? 'bake' : 'bakes'} <span aria-hidden="true">·</span> Running total: {number(selected.cumulative)}</span>{data.seriesKeys.length > 1 && selected.total > 0 && <p>{data.seriesKeys.filter(key => selected.values[key] > 0).map(key => `${key}: ${number(selected.values[key])}`).join(' · ')}</p>}</div>}
    <details className="analytics-data-table"><summary>View chart data</summary><div className="analytics-table-scroll"><table><caption>{metricLabels[metric]} by {interval}</caption><thead><tr><th scope="col">Period</th>{data.seriesKeys.map(key => <th key={key} scope="col">{key}</th>)}<th scope="col">Total</th><th scope="col">Running total</th></tr></thead><tbody>{data.buckets.map(bucket => <tr key={bucket.key}><th scope="row">{bucket.label}</th>{data.seriesKeys.map(key => <td key={key}>{number(bucket.values[key] ?? 0)}</td>)}<td>{number(bucket.total)}</td><td>{number(bucket.cumulative)}</td></tr>)}</tbody></table></div></details>
  </>;
}
