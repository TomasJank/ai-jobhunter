// Jobhunter — root app. Plain state routing; each route is its own component.
function App() {
  const [route, setRoute] = React.useState('dashboard');
  const [profile, setProfile] = React.useState(undefined);   // undefined = still loading

  React.useEffect(() => {
    // If the control panel isn't running (static file open), skip the gate and show the app.
    fetch('/api/profile').then(r => r.json()).then(setProfile).catch(() => setProfile({ onboarded: true, offline: true }));
  }, []);

  const data = window.JH_DATA;
  const resumes = data.RESUMES_FULL || [];
  const jobs = data.JOBS || [];

  if (profile === undefined) return null;   // brief blank while /api/profile resolves

  // First run: no profile yet -> onboarding (name + résumé required, then sources).
  if (!profile.onboarded) {
    return <Onboarding profile={profile} onDone={(r, nm) => { setProfile({ ...profile, onboarded: true, name: nm != null ? nm : profile.name }); setRoute(r || 'dashboard'); }} />;
  }

  const counts = {
    new: jobs.filter(j => j.status === 'new').length,
    resumes: resumes.length,
    configs: (data.CONFIGS || []).length,
  };

  return (
    <div className="app">
      <Sidebar route={route} setRoute={setRoute} counts={counts} name={profile.name} />
      {route === 'dashboard' && <Dashboard resumes={resumes} jobs={jobs} />}
      {route === 'resumes' && <Resumes resumes={resumes} jobs={jobs} />}
      {route === 'configs' && <Configs configs={data.CONFIGS || []} />}
      {route === 'scans' && <Scans scans={data.SCANS || []} />}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
