// Jobhunter — Dashboard route (split view: job list left, detail right)

const { useState: useStateD, useMemo: useMemoD } = React;

// Render a description that may be HTML (most sources) or Markdown (JobSpy/Indeed).
// ponytail: mirrors scraper/lib.js mdToHtml — browser can't import it, so a small copy.
function mdOrHtml(desc = '') {
  const s = String(desc);
  if (/<(p|ul|li|br|strong|div|h\d)\b/i.test(s)) return s;           // already HTML
  let t = s.replace(/\\([-.*_>#`+!()\[\]])/g, '$1')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  return t.split(/\n{2,}/).map(b => b.trim()).filter(Boolean).map(b => {
    const lines = b.split('\n');
    if (lines.length > 1 && lines.every(l => /^\s*[*-]\s+/.test(l)))
      return '<ul>' + lines.map(l => `<li>${l.replace(/^\s*[*-]\s+/, '')}</li>`).join('') + '</ul>';
    if (/\s\*\s/.test(b)) {
      const [head, ...items] = b.split(/\s\*\s+/);
      return (head.trim() ? `<p>${head.trim()}</p>` : '') + '<ul>' + items.map(i => `<li>${i.trim()}</li>`).join('') + '</ul>';
    }
    return `<p>${b.replace(/\n/g, ' ')}</p>`;
  }).join('');
}

/* ============================================================
   FILTER STRIP
   ============================================================ */
const FILTERS = [
  { key: 'all',       label: 'All' },
  { key: 'new',       label: 'New' },
  { key: 'applied',   label: 'Applied' },
  { key: 'interview', label: 'Interview' },
  { key: 'archived',  label: 'Archived' },
];
const SORTS = [
  { key: 'best',   label: 'Best match' },
  { key: 'recent', label: 'Most recent' },
];

const FilterStrip = ({ filter, setFilter, sort, setSort, maxAge, setMaxAge, query, setQuery, counts }) => (
  <div className="filter-strip">
    {FILTERS.map(f => (
      <button
        key={f.key}
        className={`filter-chip ${filter === f.key ? 'active' : ''}`}
        onClick={() => setFilter(f.key)}
      >
        {f.label}
        {counts[f.key] != null && <span className="count">{counts[f.key]}</span>}
      </button>
    ))}
    <span style={{ width: 1, height: 18, background: 'var(--jh-stroke)', margin: '0 4px' }} />
    {SORTS.map(s => (
      <button
        key={s.key}
        className={`filter-chip ${sort === s.key ? 'active' : ''}`}
        onClick={() => setSort(s.key)}
      >
        <Icon name={s.key === 'best' ? 'sparkle' : 'clock'} size={11} />
        {s.label}
      </button>
    ))}
    <select
      className={`filter-chip ${maxAge ? 'active' : ''}`}
      style={{ appearance: 'none', cursor: 'pointer' }}
      value={maxAge}
      onChange={(e) => setMaxAge(Number(e.target.value))}
    >
      <option value={0}>Any age</option>
      <option value={7}>Last 7 days</option>
      <option value={30}>Last 30 days</option>
      <option value={90}>Last 90 days</option>
    </select>
    <div className="search-field">
      <Icon name="search" size={14} color="var(--jh-fg-dim)" />
      <input
        placeholder="Filter by company, title…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
    </div>
  </div>
);

/* ============================================================
   DETAIL PANE
   ============================================================ */
const STATUS_ACTIONS = [
  { key: 'new', label: 'New' },
  { key: 'applied', label: 'Applied' },
  { key: 'interview', label: 'Interview' },
  { key: 'archived', label: 'Archived' },
];

const Detail = ({ job, resumes, onStatus }) => {
  const [summary, setSummary] = React.useState(null);
  const [summarizing, setSummarizing] = React.useState(false);
  const [draft, setDraft] = React.useState(null);
  const [drafting, setDrafting] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  React.useEffect(() => { setSummary(null); setDraft(null); setCopied(false); }, [job && job.id]);

  const draftApplication = async () => {
    setDrafting(true); setDraft(null);
    try {
      const res = await fetch('/api/draft', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: job.title, company: job.company, location: job.location, description: job.description, resumeId: job.best_resume_id }),
      });
      const d = await res.json();
      setDraft(d.error ? { error: d.error } : d);
    } catch { setDraft({ error: 'Drafting needs the control panel running (localhost:8090).' }); }
    finally { setDrafting(false); }
  };
  const copyLetter = () => {
    if (draft && draft.cover_letter && navigator.clipboard) {
      navigator.clipboard.writeText(draft.cover_letter).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
    }
  };

  const summarize = async () => {
    setSummarizing(true);
    try {
      const res = await fetch('/api/summarize', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: job.title, company: job.company, description: job.description }),
      });
      const d = await res.json();
      setSummary(d.summary ? { ok: true, text: d.summary } : { ok: false, text: d.error || 'No summary returned.' });
    } catch {
      setSummary({ ok: false, text: 'Summarize needs the control panel running — start it with: node scraper/server.js' });
    } finally { setSummarizing(false); }
  };

  if (!job) return (
    <div className="empty" style={{ paddingTop: 140 }}>
      <div className="empty-mark"><Icon name="inbox" size={20} /></div>
      <div>
        <div className="empty-title">Select a job to see details</div>
        <div className="empty-body">Click any row on the left to see why your resume scored the way it did, the full posting, and your activity for it.</div>
      </div>
    </div>
  );

  const initials = job.company.split(/\s+/).slice(0, 2).map(s => s[0]).join('').toUpperCase();

  return (
    <div className="detail">
      <div className="detail-head">
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
            <h1 className="detail-title">{job.title}</h1>
            <div className="detail-company">
              <div className="logo">{initials}</div>
              <span style={{ fontWeight: 599, color: 'var(--jh-fg)' }}>{job.company}</span>
              <span style={{ color: 'var(--jh-fg-faint)' }}>·</span>
              <StatusPill status={job.status} />
            </div>
            <div className="detail-meta-row">
              <span className="item"><Icon name="map-pin" size={13} /> {job.location}</span>
              <span className="item"><Icon name="briefcase" size={13} /> {job.employment_type} · {job.seniority}</span>
              {job.salary && <span className="item"><Icon name="dollar" size={13} /> {job.salary}</span>}
              <span className="item"><Icon name="clock" size={13} /> {job.posted_human}</span>
            </div>
          </div>
          <div className="detail-actions" style={{ flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            {STATUS_ACTIONS.map(s => {
              const on = (job.status || 'new') === s.key;
              return (
                <button key={s.key} className="btn"
                  onClick={() => onStatus && onStatus(job, s.key)}
                  style={{
                    padding: '5px 11px', fontSize: 12,
                    background: on ? 'var(--jh-neon)' : 'var(--jh-bg-elevated)',
                    color: on ? '#0a0a0c' : 'var(--jh-fg-muted)',
                    border: `1px solid ${on ? 'var(--jh-neon)' : 'var(--jh-stroke)'}`,
                    fontWeight: on ? 640 : 500,
                  }}>{s.label}</button>
              );
            })}
            {job.url && job.url !== '#' && (
              <a className="btn btn-soft" href={job.url} target="_blank" rel="noopener noreferrer"
                style={{ textDecoration: 'none', marginLeft: 'auto' }}>
                <Icon name="external" size={13} /> Open posting
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Score section — THE hero moment */}
      <section className="detail-section" style={{
        background: 'linear-gradient(180deg, rgba(140,125,255,0.06), var(--jh-bg-surface))',
        borderColor: 'var(--jh-accent-line)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="detail-section-title">Resume match</div>
          <div style={{ fontSize: 11, color: 'var(--jh-fg-dim)' }}>
            {window.JH_DATA.META && window.JH_DATA.META.scoring_model
              ? `scored · ${window.JH_DATA.META.scoring_model}`
              : 'scored 2h ago · gpt-4o'}
          </div>
        </div>
        <ScoreViz
          scores={job.resume_scores}
          resumes={resumes}
          bestId={job.best_resume_id}
          size="big"
        />
        {job.why && job.why.length > 0 && (
          <div style={{
            marginTop: 6,
            paddingTop: 14,
            borderTop: '1px solid var(--jh-stroke)',
            display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            <div style={{ fontSize: 12, fontWeight: 599, color: 'var(--jh-fg)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="sparkle" size={12} color="var(--jh-accent)" />
              Why this score
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--jh-fg-muted)', fontSize: 13, lineHeight: '20px' }}>
              {job.why.map((w, i) => <li key={i} style={{ marginBottom: 4 }}>{w}</li>)}
            </ul>
          </div>
        )}
      </section>

      {/* Draft application */}
      <section className="detail-section" style={{ background: 'transparent' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="detail-section-title">Application</div>
          <button className="btn btn-neon" style={{ padding: '4px 12px', fontSize: 11.5 }} disabled={drafting} onClick={draftApplication}>
            <Icon name="sparkle" size={11} /> {drafting ? 'Drafting…' : (draft && !draft.error ? 'Redraft' : 'Draft application')}
          </button>
        </div>
        {drafting && <div style={{ fontSize: 12.5, color: 'var(--jh-fg-dim)', marginTop: 8 }}>Writing a tailored cover letter, then reviewing it… (~15s)</div>}
        {draft && draft.error && <div style={{ marginTop: 8, fontSize: 13, color: 'var(--jh-amber)' }}>{draft.error}</div>}
        {draft && !draft.error && (
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ border: '1px solid var(--jh-stroke)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid var(--jh-stroke)', fontSize: 12, fontWeight: 600 }}>
                <span>Cover letter <span style={{ color: 'var(--jh-fg-dim)', fontWeight: 400 }}>· for {draft.resume_name}</span></span>
                <button className="btn btn-ghost" style={{ padding: '2px 10px', fontSize: 11.5 }} onClick={copyLetter}>{copied ? 'Copied ✓' : 'Copy'}</button>
              </div>
              <div style={{ padding: '12px 14px', fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap', color: 'var(--jh-fg-muted)' }}>{draft.cover_letter}</div>
            </div>
            {draft.cv_suggestions && draft.cv_suggestions.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Icon name="check" size={12} color="var(--jh-neon)" /> Tailor your CV for this role
                </div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: '20px', color: 'var(--jh-fg-muted)' }}>
                  {draft.cv_suggestions.map((s, i) => <li key={i} style={{ marginBottom: 4 }}>{s}</li>)}
                </ul>
              </div>
            )}
            {draft.notes && draft.notes.length > 0 && (
              <div style={{ fontSize: 11.5, color: 'var(--jh-fg-dim)' }}>
                <span style={{ fontWeight: 600, color: 'var(--jh-fg-muted)' }}>Reviewer pass:</span> {draft.notes.join(' · ')}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Description */}
      {job.description && (
        <section className="detail-section" style={{ background: 'transparent' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="detail-section-title">Job description</div>
            <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 11.5 }}
              disabled={summarizing} onClick={summarize}>
              <Icon name="sparkle" size={11} /> {summarizing ? 'Summarizing…' : 'Summarize'}
            </button>
          </div>
          {summary && (
            <div style={{
              margin: '10px 0', padding: '12px 14px', borderRadius: 10,
              border: `1px solid ${summary.ok ? 'var(--jh-accent)' : 'var(--jh-amber)'}`,
              background: summary.ok ? 'rgba(90,120,255,0.06)' : 'rgba(181,119,42,0.08)',
              fontSize: 13, lineHeight: '20px', color: 'var(--jh-fg-muted)', whiteSpace: 'pre-wrap',
            }}>
              {summary.ok && <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--jh-accent)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}><Icon name="sparkle" size={11} color="var(--jh-accent)" /> AI summary</div>}
              {summary.text}
            </div>
          )}
          <div className="detail-prose" dangerouslySetInnerHTML={{ __html: mdOrHtml(job.description) }} />
        </section>
      )}

    </div>
  );
};

/* ============================================================
   DASHBOARD
   ============================================================ */
const Dashboard = ({ resumes, jobs }) => {
  const [filter, setFilter] = useStateD('all');
  const [sort, setSort] = useStateD('best');
  const [maxAge, setMaxAge] = useStateD(0);   // days; 0 = any age
  const [query, setQuery] = useStateD('');
  const [selectedId, setSelectedId] = useStateD(jobs[0]?.id);
  const [scanning, setScanning] = useStateD(false);
  const [scanMsg, setScanMsg] = useStateD(null);

  const triggerRun = async () => {
    setScanning(true); setScanMsg(null);
    try {
      const res = await fetch('/api/run-cloud', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      const d = await res.json();
      setScanMsg(d.ok
        ? 'Cloud scan queued on GitHub — results hit Telegram + here in ~2 min (reload after).'
        : (d.error || 'Could not trigger the cloud run.'));
    } catch {
      setScanMsg('Start the control panel first: node scraper/server.js');
    } finally { setScanning(false); }
  };

  // Application-status overlay (new → applied → interview → archived), keyed by job URL,
  // persisted server-side and re-applied on top of whatever the last scrape produced.
  const [statusByUrl, setStatusByUrl] = useStateD({});
  React.useEffect(() => {
    fetch('/api/statuses').then(r => r.json()).then(m => setStatusByUrl(m || {})).catch(() => {});
  }, []);
  const setJobStatus = async (job, status) => {
    setStatusByUrl(m => { const n = { ...m }; if (status === 'new') delete n[job.url]; else n[job.url] = status; return n; });
    try {
      await fetch('/api/status', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: job.url, status }),
      });
    } catch { /* offline — optimistic update stays for this session */ }
  };
  const withStatus = j => statusByUrl[j.url] ? { ...j, status: statusByUrl[j.url] } : j;

  // Read/unread: the "New" badge clears once you open a job.
  const [viewedByUrl, setViewedByUrl] = useStateD({});
  React.useEffect(() => {
    fetch('/api/viewed').then(r => r.json()).then(m => setViewedByUrl(m || {})).catch(() => {});
  }, []);
  const selectJob = (job) => {
    setSelectedId(job.id);
    if (!viewedByUrl[job.url]) {
      setViewedByUrl(m => ({ ...m, [job.url]: true }));
      fetch('/api/view', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: job.url }) }).catch(() => {});
    }
  };
  const ageDays = j => (Date.now() - new Date(j.posted_at)) / 864e5;
  // "New" expires a week after the posting date, even if never opened.
  const isNew = j => (j.status || 'new') === 'new' && !viewedByUrl[j.url] && ageDays(j) < 7;

  const filtered = useMemoD(() => {
    let list = jobs.map(withStatus);
    if (filter !== 'all') list = list.filter(j => filter === 'new' ? isNew(j) : j.status === filter);
    if (maxAge) list = list.filter(j => ageDays(j) <= maxAge);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(j =>
        j.title.toLowerCase().includes(q) ||
        j.company.toLowerCase().includes(q) ||
        j.location.toLowerCase().includes(q)
      );
    }
    list = [...list];
    if (sort === 'best') {
      list.sort((a, b) => Math.max(...Object.values(b.resume_scores)) - Math.max(...Object.values(a.resume_scores)));
    } else {
      list.sort((a, b) => new Date(b.posted_at) - new Date(a.posted_at));
    }
    return list;
  }, [jobs, statusByUrl, viewedByUrl, filter, query, sort, maxAge]);

  const selectedJob = filtered.find(j => j.id === selectedId) || filtered[0];

  const counts = jobs.map(withStatus).reduce((acc, j) => {
    acc.all = (acc.all || 0) + 1;
    acc[j.status] = (acc[j.status] || 0) + 1;
    return acc;
  }, {});
  counts.new = jobs.filter(j => isNew(withStatus(j))).length;   // "New" = unread + not yet actioned

  return (
    <div className="main">
      <div className="page-header">
        <div className="page-header-left">
          <span className="page-eyebrow">Dashboard</span>
          <h1 className="page-title">{counts.new || 0} new · {jobs.length} total</h1>
          <span className="page-subtitle">
            {window.JH_DATA.META && <>Last scrape · {new Date(window.JH_DATA.META.generated_at).toLocaleString()} · </>}
            <span>scored against {resumes.length} resume{resumes.length === 1 ? '' : 's'}</span>
          </span>
        </div>
        <div className="page-actions" style={{ alignItems: 'center', gap: 10 }}>
          {scanMsg && <span style={{ fontSize: 12, color: 'var(--jh-fg-dim)' }}>{scanMsg}</span>}
          <button className="btn btn-neon" disabled={scanning} onClick={triggerRun}>
            <Icon name="play-fill" size={11} /> {scanning ? 'Running…' : 'Run now'}
          </button>
        </div>
      </div>

      <FilterStrip
        filter={filter} setFilter={setFilter}
        sort={sort} setSort={setSort}
        maxAge={maxAge} setMaxAge={setMaxAge}
        query={query} setQuery={setQuery}
        counts={counts}
      />

      <div className="split">
        <div className="split-list">
          {filtered.length === 0 ? (
            <div className="empty" style={{ paddingTop: 100 }}>
              <div className="empty-mark"><Icon name="search" size={20} /></div>
              <div>
                <div className="empty-title">No matches</div>
                <div className="empty-body">
                  {query
                    ? <>No jobs match <code style={{ fontFamily: 'var(--font-family-mono)', fontSize: 12, background: 'var(--jh-bg-active)', padding: '1px 6px', borderRadius: 4 }}>{query}</code> with current filters.</>
                    : 'Try a different filter, or hit Run now to scrape fresh jobs.'}
                </div>
              </div>
              {(query || filter !== 'all' || maxAge !== 0) && (
                <button className="btn btn-soft" onClick={() => { setQuery(''); setFilter('all'); setMaxAge(0); }}>
                  Reset filters
                </button>
              )}
            </div>
          ) : (
            filtered.map(job => (
              <JobRow
                key={job.id}
                job={job}
                resumes={resumes}
                selected={job.id === selectedJob?.id}
                isNew={isNew(job)}
                onClick={() => selectJob(job)}
              />
            ))
          )}
        </div>
        <div className="split-detail">
          {filtered.length === 0 ? (
            <div className="empty" style={{ paddingTop: 140 }}>
              <div className="empty-mark"><Icon name="inbox" size={20} /></div>
              <div>
                <div className="empty-title">Nothing to show</div>
                <div className="empty-body">Pick a different filter on the left, or scrape something new.</div>
              </div>
            </div>
          ) : (
            <Detail job={selectedJob} resumes={resumes} onStatus={setJobStatus} />
          )}
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { Dashboard });
