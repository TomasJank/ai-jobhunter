// Jobhunter — shared components
// Icons are inline SVG (lucide-style, 1.6 stroke, rounded caps) so we don't
// depend on a remote font.

const { useState, useEffect, useMemo, useRef } = React;

/* ============================================================
   ICONS — minimal lucide-style set
   ============================================================ */
const Icon = ({ name, size = 16, color = 'currentColor', strokeWidth = 1.6, style }) => {
  const props = {
    width: size, height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round',
    style: { display: 'block', flexShrink: 0, ...style },
  };
  switch (name) {
    case 'layout':      return <svg {...props}><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>;
    case 'file':        return <svg {...props}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/></svg>;
    case 'sliders':     return <svg {...props}><path d="M4 21v-7"/><path d="M4 10V3"/><path d="M12 21v-9"/><path d="M12 8V3"/><path d="M20 21v-5"/><path d="M20 12V3"/><path d="M1 14h6"/><path d="M9 8h6"/><path d="M17 16h6"/></svg>;
    case 'activity':    return <svg {...props}><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>;
    case 'settings':    return <svg {...props}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
    case 'search':      return <svg {...props}><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>;
    case 'play':        return <svg {...props}><polygon points="6 4 20 12 6 20 6 4" fill={color === 'currentColor' ? 'none' : color}/></svg>;
    case 'play-fill':   return <svg {...props} stroke="none" fill={color}><polygon points="6 4 20 12 6 20 6 4"/></svg>;
    case 'plus':        return <svg {...props}><path d="M12 5v14"/><path d="M5 12h14"/></svg>;
    case 'check':       return <svg {...props}><polyline points="20 6 9 17 4 12"/></svg>;
    case 'x':           return <svg {...props}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>;
    case 'arrow-right': return <svg {...props}><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>;
    case 'arrow-up-right': return <svg {...props}><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>;
    case 'external':    return <svg {...props}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>;
    case 'map-pin':     return <svg {...props}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>;
    case 'clock':       return <svg {...props}><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>;
    case 'briefcase':   return <svg {...props}><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>;
    case 'dollar':      return <svg {...props}><line x1="12" y1="2" x2="12" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>;
    case 'sparkle':     return <svg {...props}><path d="M12 3v3"/><path d="M12 18v3"/><path d="M5.6 5.6l2.1 2.1"/><path d="M16.3 16.3l2.1 2.1"/><path d="M3 12h3"/><path d="M18 12h3"/><path d="M5.6 18.4l2.1-2.1"/><path d="M16.3 7.7l2.1-2.1"/></svg>;
    case 'bell':        return <svg {...props}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>;
    case 'refresh':     return <svg {...props}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"/><path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14"/></svg>;
    case 'star':        return <svg {...props}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
    case 'star-fill':   return <svg {...props} fill={color} stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
    case 'circle-warn': return <svg {...props}><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="13"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
    case 'archive':     return <svg {...props}><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>;
    case 'inbox':       return <svg {...props}><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>;
    case 'filter':      return <svg {...props}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>;
    case 'cron':        return <svg {...props}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
    case 'globe':       return <svg {...props}><circle cx="12" cy="12" r="9"/><line x1="3" y1="12" x2="21" y2="12"/><path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18Z"/></svg>;
    case 'upload':      return <svg {...props}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>;
    case 'eye':         return <svg {...props}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12Z"/><circle cx="12" cy="12" r="3"/></svg>;
    case 'kebab':       return <svg {...props} fill={color} stroke="none"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg>;
    case 'trash':       return <svg {...props}><polyline points="3 6 5 6 21 6"/><path d="M19 6 18 20a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>;
    case 'bolt':        return <svg {...props}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill={color} stroke={color}/></svg>;
    case 'send':        return <svg {...props}><path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/></svg>;
    default: return <svg {...props}><rect x="3" y="3" width="18" height="18" rx="2"/></svg>;
  }
};

/* ============================================================
   SCORE THRESHOLDS — 0-10 scale
   ============================================================ */
const toneForScore = (s) => {
  if (s >= 8) return 'high';
  if (s >= 6) return 'mid';
  return 'low';
};
const colorForScore = (s) => {
  const t = toneForScore(s);
  if (t === 'high') return 'var(--jh-neon)';
  if (t === 'mid')  return 'var(--jh-amber)';
  return 'var(--jh-fg-faint)';
};

/* ============================================================
   DONUT
   ============================================================ */
const Donut = ({ value, max = 10, size = 38, thickness = 4, dim = false }) => {
  const r = (size - thickness) / 2;
  const C = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(value, max)) / max;
  const color = colorForScore(value);
  const trackColor = 'rgba(255,255,255,0.07)';
  return (
    <div className="donut" style={{ width: size, height: size, opacity: dim ? 0.55 : 1 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={trackColor} strokeWidth={thickness} />
        <circle
          cx={size/2} cy={size/2} r={r}
          fill="none" stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={`${C * pct} ${C}`}
          transform={`rotate(-90 ${size/2} ${size/2})`}
          style={{ transition: 'stroke-dasharray .6s cubic-bezier(.2,.8,.2,1), stroke .3s' }}
        />
      </svg>
      <span className="num" style={{ fontSize: size <= 32 ? 10 : 11 }}>{value.toFixed(1)}</span>
    </div>
  );
};

/* ============================================================
   SCORE VIZ — résumé match donuts (props: scores, resumes, bestId, size)
   ============================================================ */
const ScoreViz = ({ scores, resumes, bestId, size = 'normal' }) => {
  // 1-resume edge case
  if (resumes.length === 1) {
    const r = resumes[0];
    const s = scores[r.id];
    if (s == null) {
      return (
        <span className="score-placeholder">
          <Icon name="circle-warn" size={12} />
          Not scored yet
        </span>
      );
    }
    return (
      <span className="score-single">
        <Donut value={s} size={32} thickness={3.5} />
        <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ fontSize: 11.5, color: 'var(--jh-fg-muted)', fontWeight: 499 }}>{r.name}</span>
          <span style={{ fontSize: 10, color: 'var(--jh-fg-faint)' }}>match score</span>
        </span>
      </span>
    );
  }

  const visible = resumes;
  const donutSize = size === 'big' ? 44 : visible.length >= 4 ? 32 : 36;
  return (
    <div className={`score-strip ${size === 'big' ? 'big' : ''} ${visible.length >= 4 ? 'compact' : ''}`}>
      {visible.map(r => {
        const s = scores[r.id];
        const isBest = r.id === bestId;
        return (
          <div key={r.id} className="score-donut">
            <Donut value={s} size={donutSize} thickness={donutSize >= 40 ? 4 : 3.5} />
            <div className="score-meta">
              <span className="name">{r.name}</span>
              {isBest && toneForScore(s) === 'high' ? (
                <span className="best-flag"><Icon name="star-fill" size={9} color="var(--jh-neon)" /> Best</span>
              ) : (
                <span className="delta">
                  {toneForScore(s) === 'high' ? 'Great match' : toneForScore(s) === 'mid' ? 'Worth a look' : 'Low fit'}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

/* ============================================================
   STATUS PILL
   ============================================================ */
const STATUS_LABEL = {
  new: 'New',
  applied: 'Applied',
  interview: 'Interview',
  archived: 'Archived',
};
const StatusPill = ({ status }) => (
  <span className={`status-pill ${status}`}>
    <span className="dot" />
    {STATUS_LABEL[status]}
  </span>
);

/* ============================================================
   SIDEBAR
   ============================================================ */
const Sidebar = ({ route, setRoute, counts, name }) => {
  const items = [
    { key: 'dashboard', label: 'Dashboard',     icon: 'layout',  count: counts.new },
    { key: 'resumes',   label: 'Resumes',       icon: 'file',    count: counts.resumes },
    { key: 'configs',   label: 'Scraper config', icon: 'sliders', count: counts.configs },
    { key: 'scans',     label: 'Scans',         icon: 'activity' },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-mark">jh</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span className="sidebar-brand-name">Jobhunter</span>
          <span className="sidebar-brand-tag">v0.7 · local</span>
        </div>
      </div>

      <div>
        <div className="sidebar-section-label">Workspace</div>
        <nav className="sidebar-nav">
          {items.map(it => (
            <button
              key={it.key}
              className={`nav-item ${route === it.key ? 'active' : ''}`}
              onClick={() => setRoute(it.key)}
            >
              <span className="nav-icon"><Icon name={it.icon} size={16} /></span>
              <span>{it.label}</span>
              {it.count != null && it.count > 0 && (
                <span className="nav-count">{it.count}</span>
              )}
            </button>
          ))}
        </nav>
      </div>

      <div className="sidebar-spacer" />

      <div className="sidebar-status">
        <div className="sidebar-status-row">
          <span className="dot" />
          <span style={{ fontWeight: 599, color: 'var(--jh-fg)' }}>All systems go</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--jh-fg-dim)' }}>
          {window.JH_DATA.META
            ? `Last scrape ${new Date(window.JH_DATA.META.generated_at).toLocaleDateString()}`
            : 'No scrape yet'}
        </div>
      </div>

      <div className="sidebar-user">
        <div className="sidebar-avatar">
          {(name || '').trim().split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'JH'}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 599 }}>{name || 'you'}</span>
          <span style={{ fontSize: 11, color: 'var(--jh-fg-dim)' }}>self-hosted</span>
        </div>
      </div>
    </aside>
  );
};

/* ============================================================
   JOB ROW (list item)
   ============================================================ */
const JobRow = ({ job, resumes, selected, isNew, onClick }) => {
  // "New" badge only while unread; once actioned, show the status pill instead.
  const showStatus = (job.status && job.status !== 'new') ? job.status : (isNew ? 'new' : null);
  return (
    <button className={`job-row ${selected ? 'selected' : ''}`} onClick={onClick}>
      <div className="top-line">
        <div className="title-block">
          <span className="title">{job.title}</span>
          <span className="company">
            {job.company}
            <span className="meta">{job.location}</span>
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          {showStatus && <StatusPill status={showStatus} />}
          <span style={{ fontSize: 11, color: 'var(--jh-fg-faint)' }}>{job.posted_human}</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <ScoreViz
          scores={job.resume_scores}
          resumes={resumes}
          bestId={job.best_resume_id}
        />
      </div>
    </button>
  );
};

Object.assign(window, {
  Icon, Donut, ScoreViz, StatusPill, Sidebar, JobRow,
  toneForScore, colorForScore, STATUS_LABEL,
});
