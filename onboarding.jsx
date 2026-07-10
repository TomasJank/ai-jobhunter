// Jobhunter — first-run onboarding: name → résumé (required) → set up sources.
const _toB64 = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onerror = reject;
  r.onload = () => resolve(String(r.result).split(',')[1] || '');
  r.readAsDataURL(file);
});

const Onboarding = ({ profile, onDone }) => {
  const [name, setName] = React.useState(profile.name || '');
  const [hasResume, setHasResume] = React.useState((profile.resumeCount || 0) > 0);
  const [uploading, setUploading] = React.useState(false);
  const [msg, setMsg] = React.useState(null);
  const [saving, setSaving] = React.useState(false);
  const [warn, setWarn] = React.useState(null);
  const [done, setDone] = React.useState(false);
  const fileRef = React.useRef(null);

  // Step 3 — job sources: pick from defaults + add your own.
  const [sources, setSources] = React.useState([]);
  const [addInput, setAddInput] = React.useState('');
  const [adding, setAdding] = React.useState(false);
  const [srcNote, setSrcNote] = React.useState(null);
  React.useEffect(() => { fetch('/api/sources').then(r => r.json()).then(setSources).catch(() => {}); }, []);
  const saveSources = (next) => { setSources(next); fetch('/api/sources', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) }).catch(() => {}); };
  const toggleSource = (id) => saveSources(sources.map(c => c.id === id ? { ...c, active: !c.active } : c));
  const addSource = async () => {
    if (!addInput.trim()) return;
    setAdding(true); setSrcNote(null);
    try {
      const r = await fetch('/api/detect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input: addInput.trim() }) }).then(x => x.json());
      if (r.blocked) setSrcNote({ kind: 'bad', text: r.reason });
      else if (r.unknown || r.error) setSrcNote({ kind: 'warn', text: r.reason || r.error });
      else {
        const cfg = r.config, label = cfg.company || cfg.slug || cfg.tenant || cfg.source;
        const entry = { id: 'cfg_' + Date.now().toString(36), name: `${label} (${cfg.provider || cfg.source})`, active: true, keywords: ['front', 'react', 'ui', 'web', 'javascript', 'typescript'], query: 'frontend', ...cfg };
        saveSources([...sources, entry]);
        setSrcNote({ kind: 'ok', text: `Added ${entry.name}` }); setAddInput('');
      }
    } catch { setSrcNote({ kind: 'warn', text: 'Could not add — control panel not reachable.' }); }
    finally { setAdding(false); }
  };

  const onFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { setMsg({ ok: false, text: 'File too large (max 8MB).' }); return; }
    setUploading(true); setMsg(null);
    try {
      const data = await _toB64(file);
      const res = await fetch('/api/resume', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, media_type: file.type, data }),
      });
      const d = await res.json();
      if (d.ok) { setHasResume(true); setMsg({ ok: true, text: `Résumé "${d.id}" added.` }); }
      else setMsg({ ok: false, text: d.error || 'Upload failed.' });
    } catch { setMsg({ ok: false, text: 'Upload failed — is the control panel running?' }); }
    finally { setUploading(false); }
  };

  const activeSources = sources.filter(c => c.active).length;

  const finish = async () => {
    if (!name.trim()) { setWarn('Please enter your name.'); return; }
    if (!hasResume) { setWarn('Please add a résumé — jobs are matched against it.'); return; }
    if (sources.length && activeSources === 0) { setWarn('Turn on at least one job source.'); return; }
    setWarn(null); setSaving(true);
    try { await fetch('/api/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim(), onboarded: true }) }); }
    catch { /* offline — proceed anyway */ }
    setSaving(false); setDone(true);
  };

  if (done) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 40 }}>
        <div style={{ maxWidth: 460, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: 'var(--jh-neon)', display: 'grid', placeItems: 'center' }}>
            <Icon name="check" size={30} color="#0a0a0c" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 640, letterSpacing: '-0.01em' }}>You're ready to hunt, {name.trim()}! 🎯</div>
          <div style={{ color: 'var(--jh-fg-muted)', fontSize: 14, lineHeight: 1.5 }}>
            {activeSources} source{activeSources === 1 ? '' : 's'} on, matched against your résumé. New matches land on your dashboard and in Telegram — hit <strong style={{ color: 'var(--jh-fg)' }}>Run now</strong> for the first batch, or wait for the daily scan.
          </div>
          <button className="btn btn-neon" style={{ marginTop: 4, padding: '9px 20px' }} onClick={() => onDone('dashboard', name.trim())}>
            Go to dashboard →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 40 }}>
      <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div className="sidebar-brand-mark">jh</div>
            <span style={{ fontSize: 22, fontWeight: 640, letterSpacing: '-0.01em' }}>Welcome to Jobhunter</span>
          </div>
          <div style={{ color: 'var(--jh-fg-muted)', fontSize: 14 }}>
            A little info to fill in before you start. Jobs are only scraped once you've added a résumé.
          </div>
        </div>

        {/* Step 1 — name */}
        <div style={{ border: '1px solid var(--jh-stroke)', borderRadius: 12, padding: 18, background: 'var(--jh-bg-surface)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>1 · Your name</div>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Alex" style={{ width: '100%' }} />
        </div>

        {/* Step 2 — résumé (required) */}
        <div style={{ border: `1px solid ${hasResume ? 'var(--jh-success)' : 'var(--jh-stroke)'}`, borderRadius: 12, padding: 18, background: 'var(--jh-bg-surface)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
            2 · Résumé <span style={{ color: 'var(--jh-fg-dim)', fontWeight: 400 }}>· required — drives the matching</span>
          </div>
          <input ref={fileRef} type="file" accept=".pdf,.md,.txt,application/pdf,text/plain,text/markdown" style={{ display: 'none' }} onChange={onFile} />
          {hasResume ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--jh-success)', fontSize: 13 }}>
              <Icon name="check" size={14} /> Résumé added
              <button className="btn btn-ghost" style={{ marginLeft: 'auto', fontSize: 12 }} disabled={uploading} onClick={() => fileRef.current.click()}>Replace</button>
            </div>
          ) : (
            <button className="btn btn-neon" disabled={uploading} onClick={() => fileRef.current.click()}>
              <Icon name="upload" size={13} /> {uploading ? 'Extracting…' : 'Upload résumé (PDF, MD, or text)'}
            </button>
          )}
          {msg && <div style={{ marginTop: 8, fontSize: 12, color: msg.ok ? 'var(--jh-success)' : 'var(--jh-amber)' }}>{msg.text}</div>}
        </div>

        {/* Step 3 — sources: pick defaults + add your own */}
        <div style={{ border: '1px solid var(--jh-stroke)', borderRadius: 12, padding: 18, background: 'var(--jh-bg-surface)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>3 · Job sources</div>
          <div style={{ fontSize: 12.5, color: 'var(--jh-fg-muted)', marginBottom: 10 }}>
            Tap to toggle the defaults on/off, or add any company careers URL / name.
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {sources.map(c => (
              <button key={c.id} onClick={() => toggleSource(c.id)} className="btn" title={c.name}
                style={{
                  padding: '4px 11px', fontSize: 12, borderRadius: 999, maxWidth: 200,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  background: c.active ? 'var(--jh-neon)' : 'var(--jh-bg-elevated)',
                  color: c.active ? '#0a0a0c' : 'var(--jh-fg-muted)',
                  border: `1px solid ${c.active ? 'var(--jh-neon)' : 'var(--jh-stroke)'}`,
                  fontWeight: c.active ? 640 : 500,
                }}>{c.active ? '✓ ' : ''}{c.name}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={addInput} onChange={e => setAddInput(e.target.value)} placeholder="Add a careers URL or company name"
              onKeyDown={e => e.key === 'Enter' && addSource()} style={{ flex: 1 }} />
            <button className="btn btn-soft" disabled={adding} onClick={addSource}>{adding ? '…' : 'Add'}</button>
          </div>
          {srcNote && (
            <div style={{ marginTop: 8, fontSize: 12, color: srcNote.kind === 'bad' ? 'var(--jh-danger)' : srcNote.kind === 'ok' ? 'var(--jh-success)' : 'var(--jh-amber)' }}>
              {srcNote.kind === 'bad' && <strong>Can't scrape this. </strong>}{srcNote.text}
            </div>
          )}
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--jh-fg-dim)' }}>
            ⚠ LinkedIn, Glassdoor, Meta, Tesla, Citadel can't be scraped (login walls / anti-bot).
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
          {warn && <div style={{ fontSize: 13, color: 'var(--jh-amber)' }}>⚠ {warn}</div>}
          <button className="btn btn-neon" style={{ padding: '9px 26px' }} disabled={saving} onClick={finish}>
            {saving ? 'Saving…' : 'Finish setup'}
          </button>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { Onboarding });
