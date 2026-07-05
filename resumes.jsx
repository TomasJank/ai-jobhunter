// Jobhunter — Resumes route
// Shows the user's resume PDFs. One is "active" — used to rank new jobs.
// Handles 1 / 3 / 4-resume cases driven by the scenario tweak.

const { useState: useStateR } = React;

// Read a File as base64 (no data: prefix) for the upload API.
const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onerror = reject;
  r.onload = () => resolve(String(r.result).split(',')[1] || '');
  r.readAsDataURL(file);
});

const Resumes = ({ resumes, jobs }) => {
  const [uploading, setUploading] = React.useState(false);
  const [uploadMsg, setUploadMsg] = React.useState(null);
  const [live, setLive] = React.useState(null);       // résumés from the server, if running
  const [openId, setOpenId] = React.useState(null);   // which résumé's matches are expanded
  const fileRef = React.useRef(null);

  React.useEffect(() => {
    fetch('/api/resumes').then(r => r.json()).then(setLive).catch(() => setLive(null));
  }, []);

  const pickFile = () => fileRef.current && fileRef.current.click();

  const onFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { setUploadMsg({ ok: false, text: 'File too large (max 8MB).' }); return; }
    setUploading(true); setUploadMsg(null);
    try {
      const data = await fileToBase64(file);
      const res = await fetch('/api/resume', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, media_type: file.type, data }),
      });
      const d = await res.json();
      if (d.ok) {
        setUploadMsg({ ok: true, text: `Added "${d.id}". Hit Run now (or wait for the daily scan) to score jobs against it.` });
        fetch('/api/resumes').then(r => r.json()).then(setLive).catch(() => {});
      } else {
        setUploadMsg({ ok: false, text: d.error || 'Upload failed.' });
      }
    } catch {
      setUploadMsg({ ok: false, text: 'Upload needs the control panel running (localhost:8090).' });
    } finally { setUploading(false); }
  };

  const deleteResume = async (id) => {
    try { await fetch('/api/resume?id=' + encodeURIComponent(id), { method: 'DELETE' }); } catch { /* offline */ }
    fetch('/api/resumes').then(r => r.json()).then(setLive).catch(() => {});
  };

  // Compute per-resume stats from the job dataset.
  const stats = (id) => {
    const matchScores = jobs.map(j => j.resume_scores[id]).filter(s => s != null);
    const avg = matchScores.length ? matchScores.reduce((a, b) => a + b, 0) / matchScores.length : 0;
    const greatMatches = matchScores.filter(s => s >= 8).length;
    return { avg, greatMatches, total: matchScores.length };
  };

  // Prefer the live list from the server (shows newly-uploaded résumés immediately);
  // fall back to the baked-in dataset when the control panel isn't running.
  const activeId = (resumes.find(r => r.active) || resumes[0] || {}).id;
  const items = (live && live.length ? live : resumes).map(r => ({
    tokens: 0, last_updated_human: 'recently', ...r,
    active: r.active != null ? r.active : r.id === activeId,
  }));

  return (
    <div className="main">
      <div className="page-header">
        <div className="page-header-left">
          <span className="page-eyebrow">Resumes</span>
          <h1 className="page-title">Resumes</h1>
          <span className="page-subtitle">
            One active resume drives the ranking. Adding more lets you compare matches per role.
          </span>
        </div>
        <input ref={fileRef} type="file" accept=".pdf,.md,.txt,application/pdf,text/plain,text/markdown"
          style={{ display: 'none' }} onChange={onFile} />
      </div>

      {uploadMsg && (
        <div style={{
          margin: '0 0 16px', padding: '10px 14px', borderRadius: 10, fontSize: 13,
          border: `1px solid ${uploadMsg.ok ? 'var(--jh-success)' : 'var(--jh-amber)'}`,
          background: uploadMsg.ok ? 'rgba(31,157,92,0.08)' : 'rgba(181,119,42,0.08)',
          color: 'var(--jh-fg-muted)',
        }}>{uploadMsg.text}</div>
      )}

      {items.length === 0 ? (
        <div className="empty" style={{ paddingTop: 100 }}>
          <div className="empty-mark"><Icon name="file" size={20} /></div>
          <div>
            <div className="empty-title">No resumes yet</div>
            <div className="empty-body">Upload a PDF, Markdown, or text file. PDFs are extracted with Claude in ~15s.</div>
          </div>
          <button className="btn btn-neon" disabled={uploading} onClick={pickFile}>
            <Icon name="upload" size={13} /> {uploading ? 'Extracting…' : 'Upload resume'}
          </button>
        </div>
      ) : (
       <>
        <div className="resumes-grid">
          {items.map(r => {
            const s = stats(r.id);
            const open = openId === r.id;
            return (
              <div key={r.id}
                className={`resume-card ${r.active ? 'active' : ''}`}
                style={{ cursor: s.total > 0 ? 'pointer' : 'default', outline: open ? '2px solid var(--jh-accent)' : 'none' }}
                onClick={() => s.total > 0 && setOpenId(open ? null : r.id)}>
                <div className="doc-mark"><Icon name="file" size={18} /></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h4>{r.name}</h4>
                    <div style={{ fontSize: 11.5, color: 'var(--jh-fg-dim)', marginTop: 2 }}>
                      {(r.tokens || 0).toLocaleString()} tokens{r.active ? ' · active' : ''}
                    </div>
                  </div>
                  {live && (
                    <button className="btn btn-ghost" title="Delete résumé"
                      style={{ padding: '3px 7px', color: 'var(--jh-danger)' }}
                      onClick={(e) => { e.stopPropagation(); deleteResume(r.id); }}>
                      <Icon name="trash" size={12} />
                    </button>
                  )}
                </div>
                <div className="desc">
                  {s.total > 0
                    ? (open ? 'Hiding matches ↑' : `Scored against ${s.total} jobs — click to see matches ↓`)
                    : 'Not scored yet — run a scan to rank jobs against this résumé.'}
                </div>
                <div className="stats">
                  <div className="stat">
                    <span className="v">{s.avg.toFixed(1)}</span>
                    <span>Avg match</span>
                  </div>
                  <div className="stat">
                    <span className="v">{s.greatMatches}</span>
                    <span>Great matches</span>
                  </div>
                  <div className="stat">
                    <span className="v">{s.total}</span>
                    <span>Scored</span>
                  </div>
                  <div style={{ flex: 1 }} />
                </div>
              </div>
            );
          })}

          {/* Upload card */}
          <div className="upload-card" style={{ cursor: uploading ? 'default' : 'pointer' }} onClick={() => !uploading && pickFile()}>
            <div className="plus"><Icon name="plus" size={16} /></div>
            <div style={{ fontWeight: 599, color: 'var(--jh-fg)' }}>{uploading ? 'Extracting…' : 'Upload resume'}</div>
            <div className="hint">PDF, Markdown or text · max 8MB</div>
          </div>
        </div>

        {openId && (() => {
          const r = items.find(x => x.id === openId);
          if (!r) return null;
          const matches = jobs
            .map(j => ({ ...j, _score: j.resume_scores[openId] }))
            .filter(j => typeof j._score === 'number')
            .sort((a, b) => b._score - a._score);
          return (
            <div style={{ margin: '18px 0 8px', border: '1px solid var(--jh-stroke)', borderRadius: 12, background: 'var(--jh-bg-surface)', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--jh-stroke)', fontSize: 13, fontWeight: 600 }}>
                Top matches for {r.name}
                <span style={{ color: 'var(--jh-fg-dim)', fontWeight: 400 }}> · {matches.length} scored, best first</span>
              </div>
              {matches.slice(0, 15).map(j => (
                <a key={j.id} href={j.url && j.url !== '#' ? j.url : undefined} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid var(--jh-stroke-soft)', textDecoration: 'none', color: 'inherit' }}>
                  <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', width: 30, textAlign: 'right', color: j._score >= 8 ? 'var(--jh-neon)' : j._score >= 6 ? 'var(--jh-amber)' : 'var(--jh-fg-dim)' }}>{j._score.toFixed(1)}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: 'var(--jh-fg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{j.title}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--jh-fg-dim)' }}>{j.company}{j.location ? ' · ' + j.location : ''}</div>
                  </span>
                  <Icon name="external" size={12} color="var(--jh-fg-dim)" />
                </a>
              ))}
            </div>
          );
        })()}
       </>
      )}
    </div>
  );
};

Object.assign(window, { Resumes });
