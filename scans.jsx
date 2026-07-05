// Jobhunter — Scans route: per-run history of what each source scraped and what failed.
const Scans = ({ scans }) => {
  const runs = scans || [];
  return (
    <div className="main">
      <div className="page-header">
        <div className="page-header-left">
          <span className="page-eyebrow">Scans</span>
          <h1 className="page-title">Scan history</h1>
          <span className="page-subtitle">Each run and which sources succeeded or failed. Newest first (last 20 runs).</span>
        </div>
      </div>

      {runs.length === 0 ? (
        <div className="empty" style={{ paddingTop: 100 }}>
          <div className="empty-mark"><Icon name="activity" size={20} /></div>
          <div>
            <div className="empty-title">No scans recorded yet</div>
            <div className="empty-body">Runs appear here after the next scrape (local or the daily cloud run).</div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '0 0 32px' }}>
          {runs.map((run, i) => (
            <div key={i} style={{ border: '1px solid var(--jh-stroke)', borderRadius: 12, background: 'var(--jh-bg-surface)', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--jh-stroke)', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{new Date(run.at).toLocaleString()}</span>
                <span style={{ fontSize: 12, color: 'var(--jh-fg-dim)' }}>
                  {run.ok} ok{run.failed ? ` · ${run.failed} failed` : ''} · {run.unique} jobs · {run.new} new
                  {run.notified ? ` · ${run.notified} to Telegram` : ''}{run.scored ? '' : ' · not scored'}
                </span>
                <span style={{
                  marginLeft: 'auto', fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 999,
                  color: run.failed ? 'var(--jh-amber)' : 'var(--jh-success)',
                  background: run.failed ? 'rgba(181,119,42,0.12)' : 'rgba(31,157,92,0.12)',
                }}>{run.failed ? `${run.failed} failed` : 'all ok'}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
                {run.sources.map((s, j) => (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px',
                    borderBottom: '1px solid var(--jh-stroke-soft)', fontSize: 12.5,
                  }}>
                    <span style={{ color: s.ok ? 'var(--jh-success)' : 'var(--jh-danger)', fontWeight: 700 }}>{s.ok ? '✓' : '✗'}</span>
                    <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</span>
                    {s.ok ? (
                      <span style={{ color: 'var(--jh-fg-dim)', whiteSpace: 'nowrap' }}>{s.count} job{s.count === 1 ? '' : 's'}</span>
                    ) : (
                      <span title={s.error || 'failed'}
                        style={{
                          color: 'var(--jh-danger)', cursor: 'help', maxWidth: 130,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          borderBottom: '1px dotted var(--jh-danger)',
                        }}>
                        {s.error || 'failed'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

Object.assign(window, { Scans });
