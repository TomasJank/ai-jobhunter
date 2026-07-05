// Jobhunter — Scraper Configs route (real manager, backed by scraper/server.js).
// Falls back to a read-only view (with a hint to start the server) when the API is absent.

const SENIORITY = ['intern', 'junior', 'mid', 'senior', 'staff', 'lead', 'principal'];
const WORK_MODES = ['remote', 'hybrid', 'onsite'];
const DEFAULT_KEYWORDS = ['front', 'react', 'vue', 'typescript', 'javascript', 'ui', 'web'];

const api = async (path, opts) => {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
};

const Chip = ({ on, label, onClick }) => (
  <button
    onClick={onClick}
    className="btn"
    style={{
      padding: '5px 12px', fontSize: 12, borderRadius: 999, textTransform: 'capitalize',
      background: on ? 'var(--jh-neon)' : 'var(--jh-bg-elevated)',
      color: on ? '#0a0a0c' : 'var(--jh-fg-muted)',
      border: `1px solid ${on ? 'var(--jh-neon)' : 'var(--jh-stroke)'}`,
      fontWeight: on ? 640 : 500,
    }}
  >{label}</button>
);

const Configs = ({ configs: fallback }) => {
  const [configs, setConfigs] = React.useState(fallback || []);
  const [prefs, setPrefs] = React.useState(null);
  const [online, setOnline] = React.useState(null); // null=checking, true/false
  const [input, setInput] = React.useState('');
  const [detecting, setDetecting] = React.useState(false);
  const [notice, setNotice] = React.useState(null);  // { kind: 'blocked'|'unknown'|'ok', text }
  const [saving, setSaving] = React.useState(false);
  const [run, setRun] = React.useState({ running: false });

  React.useEffect(() => {
    (async () => {
      try {
        const [s, p] = await Promise.all([api('/api/sources'), api('/api/prefs')]);
        setConfigs(s); setPrefs(p); setOnline(true);
      } catch { setOnline(false); }
    })();
  }, []);

  // poll run status while a scan is in progress
  React.useEffect(() => {
    if (!run.running) return;
    const t = setInterval(async () => {
      try { const r = await api('/api/run'); setRun(r); if (!r.running) clearInterval(t); } catch { clearInterval(t); }
    }, 2000);
    return () => clearInterval(t);
  }, [run.running]);

  const saveConfigs = async (next) => {
    setConfigs(next);
    if (online) { setSaving(true); try { await api('/api/sources', { method: 'POST', body: JSON.stringify(next) }); } finally { setSaving(false); } }
  };
  const savePrefs = async (next) => {
    setPrefs(next);
    if (online) { setSaving(true); try { await api('/api/prefs', { method: 'POST', body: JSON.stringify(next) }); } finally { setSaving(false); } }
  };

  const toggleActive = (id) => saveConfigs(configs.map(c => c.id === id ? { ...c, active: !c.active } : c));
  const removeConfig = (id) => saveConfigs(configs.filter(c => c.id !== id));

  const addWebsite = async () => {
    if (!input.trim() || !online) return;
    setDetecting(true); setNotice(null);
    try {
      const r = await api('/api/detect', { method: 'POST', body: JSON.stringify({ input: input.trim() }) });
      if (r.blocked) { setNotice({ kind: 'blocked', text: r.reason }); return; }
      if (r.unknown || r.error) { setNotice({ kind: 'unknown', text: r.reason || r.error }); return; }
      const cfg = r.config;
      const label = cfg.company || cfg.slug || cfg.tenant || cfg.source;
      const entry = {
        id: 'cfg_' + Date.now().toString(36),
        name: `${label} (${cfg.provider || cfg.source})`,
        active: true,
        keywords: DEFAULT_KEYWORDS,
        query: 'frontend',
        ...cfg,
      };
      await saveConfigs([...configs, entry]);
      setNotice({ kind: 'ok', text: `Added ${entry.name}${r.via ? ` — detected via ${r.via}` : ''}` });
      setInput('');
    } catch (e) { setNotice({ kind: 'unknown', text: 'Detection failed: ' + e.message }); }
    finally { setDetecting(false); }
  };

  const toggleInArray = (obj, key, value) => {
    const arr = obj[key] || [];
    return { ...obj, [key]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value] };
  };

  const triggerRun = async () => {
    if (!online) return;
    setRun({ running: true });
    try { await api('/api/run', { method: 'POST' }); } catch { setRun({ running: false }); }
  };

  const active = configs.filter(c => c.active);
  const paused = configs.filter(c => !c.active);

  return (
    <div className="main">
      <div className="page-header">
        <div className="page-header-left">
          <span className="page-eyebrow">Scraper config</span>
          <h1 className="page-title">{configs.length} source{configs.length === 1 ? '' : 's'}</h1>
          <span className="page-subtitle">
            Add job sites, tune what gets scraped, and set your preferences.
            {saving && <span style={{ marginLeft: 8, color: 'var(--jh-neon)' }}>saving…</span>}
          </span>
        </div>
        <div className="page-actions">
          <button className="btn btn-neon" disabled={!online || run.running} onClick={triggerRun}>
            <Icon name="play-fill" size={11} /> {run.running ? 'Running…' : 'Run now'}
          </button>
        </div>
      </div>

      {online === false && (
        <div style={{ margin: '0 0 18px', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--jh-amber)', background: 'rgba(181,119,42,0.08)', fontSize: 13, display: 'flex', gap: 10, alignItems: 'center' }}>
          <Icon name="circle-warn" size={15} color="var(--jh-amber)" />
          <span>Read-only — the control panel isn't running. Start it with <code style={{ color: 'var(--jh-fg)' }}>node scraper/server.js</code> and open <code style={{ color: 'var(--jh-fg)' }}>localhost:8090</code> to edit sources and preferences.</span>
        </div>
      )}

      <div className="configs-wrap" style={{ alignItems: 'flex-start' }}>
        {/* LEFT: sources */}
        <div className="configs-list">
          {/* Add website */}
          <div style={{ marginBottom: 14 }}>
            <div className="sidebar-section-label" style={{ padding: '4px 4px 8px' }}>Add a job site</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                value={input}
                disabled={!online}
                placeholder="Paste a careers URL or type a company name"
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addWebsite()}
                style={{ flex: 1 }}
              />
              <button className="btn btn-primary" disabled={!online || detecting} onClick={addWebsite}>
                <Icon name="plus" size={13} /> {detecting ? '…' : 'Add'}
              </button>
            </div>
            {notice && (
              <div style={{
                marginTop: 8, padding: '8px 10px', borderRadius: 8, fontSize: 12,
                border: `1px solid ${notice.kind === 'blocked' ? 'var(--jh-danger)' : notice.kind === 'ok' ? 'var(--jh-success)' : 'var(--jh-amber)'}`,
                color: 'var(--jh-fg-muted)',
                background: notice.kind === 'blocked' ? 'rgba(220,70,70,0.08)' : notice.kind === 'ok' ? 'rgba(31,157,92,0.08)' : 'rgba(181,119,42,0.08)',
              }}>
                {notice.kind === 'blocked' && <strong style={{ color: 'var(--jh-danger)' }}>Can't scrape this. </strong>}
                {notice.text}
              </div>
            )}
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--jh-fg-dim)', lineHeight: 1.5 }}>
              ⚠ Some sites can't be scraped free: <strong>LinkedIn, Glassdoor, Meta, Microsoft</strong> (login walls / anti-bot).
              Indeed & Google Jobs work via the JobSpy source.
            </div>
          </div>

          <div className="sidebar-section-label" style={{ padding: '10px 4px 8px' }}>Active · {active.length}</div>
          {active.map(c => <SourceItem key={c.id} c={c} online={online} onToggle={toggleActive} onRemove={removeConfig} />)}
          {!active.length && <div style={{ fontSize: 12, color: 'var(--jh-fg-dim)', padding: '4px 6px' }}>No active sources.</div>}

          {paused.length > 0 && <div className="sidebar-section-label" style={{ padding: '14px 4px 8px' }}>Paused · {paused.length}</div>}
          {paused.map(c => <SourceItem key={c.id} c={c} online={online} onToggle={toggleActive} onRemove={removeConfig} />)}
        </div>

        {/* RIGHT: preferences */}
        <div className="config-form">
          <div style={{ fontSize: 15, fontWeight: 620, marginBottom: 4 }}>Preferences</div>
          <div style={{ fontSize: 12, color: 'var(--jh-fg-dim)', marginBottom: 6 }}>
            Seniority you deselect is filtered out. Location & work mode guide the AI match score (mismatches rank lower, not dropped).
          </div>

          {!prefs ? (
            <div style={{ fontSize: 12, color: 'var(--jh-fg-dim)' }}>Start the control panel to edit preferences.</div>
          ) : (
            <>
              <div className="form-row">
                <label>Seniority levels</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {SENIORITY.map(s => (
                    <Chip key={s} label={s} on={prefs.seniority.includes(s)} onClick={() => savePrefs(toggleInArray(prefs, 'seniority', s))} />
                  ))}
                </div>
              </div>

              <div className="form-row">
                <label>Work mode</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {WORK_MODES.map(m => (
                    <Chip key={m} label={m} on={prefs.work_modes.includes(m)} onClick={() => savePrefs(toggleInArray(prefs, 'work_modes', m))} />
                  ))}
                </div>
              </div>

              <div className="form-row">
                <label>Preferred locations</label>
                <input
                  value={(prefs.locations || []).join(', ')}
                  onChange={e => setPrefs({ ...prefs, locations: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                  onBlur={() => savePrefs(prefs)}
                  placeholder="Remote, Lithuania, EU"
                />
                <span className="help">Comma-separated. Used to rank matches, not to hard-filter.</span>
              </div>

              <div className="form-row" style={{ flexDirection: 'row', gap: 18 }}>
                <div style={{ flex: 1 }} className="form-row">
                  <label>Telegram alert threshold</label>
                  <input
                    type="number" min="0" max="10" step="0.5"
                    value={prefs.notify_min_score}
                    onChange={e => setPrefs({ ...prefs, notify_min_score: Number(e.target.value) })}
                    onBlur={() => savePrefs(prefs)}
                  />
                  <span className="help">Only jobs scoring ≥ this are sent.</span>
                </div>
                <div style={{ flex: 1 }} className="form-row">
                  <label>Telegram reports</label>
                  <Chip label={prefs.telegram_enabled ? 'On' : 'Off'} on={prefs.telegram_enabled}
                    onClick={() => savePrefs({ ...prefs, telegram_enabled: !prefs.telegram_enabled })} />
                </div>
              </div>

              {run.lastRun && !run.running && (
                <div style={{ marginTop: 12, padding: '10px 12px', border: '1px dashed var(--jh-stroke-strong)', borderRadius: 8, fontSize: 11.5, color: 'var(--jh-fg-dim)', whiteSpace: 'pre-wrap', maxHeight: 140, overflow: 'auto' }}>
                  <strong style={{ color: 'var(--jh-fg-muted)' }}>Last run</strong>{'\n'}{(run.lastRun.out || '').split('\n').slice(-6).join('\n')}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const SourceItem = ({ c, online, onToggle, onRemove }) => (
  <div className="config-item" style={{ opacity: c.active ? 1 : 0.6, textAlign: 'left', cursor: 'default' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
      <span className="name">{c.name}</span>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <button className="btn btn-ghost" style={{ padding: '2px 9px', fontSize: 11 }} disabled={!online} onClick={() => onToggle(c.id)}>
          {c.active ? 'Pause' : 'Enable'}
        </button>
        <button className="btn btn-ghost" style={{ padding: '2px 7px', color: 'var(--jh-danger)' }} disabled={!online} onClick={() => onRemove(c.id)}>
          <Icon name="trash" size={12} />
        </button>
      </div>
    </div>
    <div className="url">{c.url || c.host || c.base || `${c.provider || c.source}${c.slug ? ' · ' + c.slug : ''}`}</div>
    <div className="meta">
      <span className="status-pill new" style={{ fontSize: 10, padding: '1px 7px' }}>{c.source}{c.provider ? ' · ' + c.provider : ''}</span>
      {typeof c.found_total === 'number' && <span style={{ marginLeft: 'auto' }}>{c.found_total} found</span>}
    </div>
  </div>
);

Object.assign(window, { Configs });
