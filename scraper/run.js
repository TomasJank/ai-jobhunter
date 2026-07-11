// scraper/run.js — orchestrate: read sources.json -> scrape -> normalize -> dedupe
// -> score -> write live-data.js (which the prototype loads before its mock data.js).
const fs = require('fs');
const path = require('path');
// Load scraper/.env if present (native Node — no dotenv dep). Env vars / CI secrets still win.
try { process.loadEnvFile(path.join(__dirname, '.env')); } catch { /* no .env file — fine */ }
const { matchesKeywords, decodeEntities, loadSources } = require('./lib');
const { scoreJobs, MODEL, loadResumes } = require('./score');
const { notifyTelegram, bestScore } = require('./notify');
const { loadPrefs, passesSeniority, prefsPromptText } = require('./prefs');

const SOURCES = {
  remoteok: require('./sources/remoteok'),
  weworkremotely: require('./sources/weworkremotely'),
  hackernews: require('./sources/hackernews'),
  amazon: require('./sources/amazon'),
  ats: require('./sources/ats'),
  eightfold: require('./sources/eightfold'),
  apple: require('./sources/apple'),
  google: require('./sources/google'),
  jobspy: require('./sources/jobspy'),
  pcsx: require('./sources/pcsx'),
  radancy: require('./sources/radancy'),
  ibm: require('./sources/ibm'),
};

// ponytail: cap per source to bound runtime + LLM cost. Raise JH_PER_CONFIG_CAP if you want more.
const PER_CONFIG_CAP = Number(process.env.JH_PER_CONFIG_CAP || 8);

function sourceUrl(c) {
  if (c.source === 'remoteok') return 'https://remoteok.com/api';
  if (c.source === 'weworkremotely') return `https://weworkremotely.com/categories/${c.category || ''}`;
  if (c.source === 'hackernews') return 'https://news.ycombinator.com/submitted?id=whoishiring';
  if (c.source === 'amazon') return 'https://www.amazon.jobs';
  if (c.source === 'ats') return c.host ? `https://${c.host}` : `${c.provider}:${c.slug}`;
  if (c.source === 'eightfold') return c.base || '';
  if (c.source === 'apple') return 'https://jobs.apple.com';
  if (c.source === 'google') return 'https://www.google.com/about/careers';
  if (c.source === 'jobspy') return `jobspy:${c.site || 'indeed'}`;
  if (c.source === 'pcsx' || c.source === 'radancy') return c.base || '';
  if (c.source === 'ibm') return 'https://www.ibm.com/careers';
  return '';
}

async function run() {
  if (!loadResumes().length) {
    console.log('No résumé found in scraper/resumes/ — upload one first. Skipping scrape.');
    return;
  }
  const configs = loadSources(__dirname);
  const prefs = loadPrefs();
  const found = {};
  const runResults = [];   // per-source outcome for the Scans page
  let all = [];

  for (const cfg of configs.filter(c => c.active)) {
    const fn = SOURCES[cfg.source];
    if (!fn) { console.warn(`skip ${cfg.id}: unknown source ${cfg.source}`); continue; }
    try {
      let jobs = await fn(cfg);
      jobs = jobs
        .filter(j => matchesKeywords(j, cfg.keywords))
        .filter(j => passesSeniority(j, prefs))   // drop deselected seniority levels (intern by default)
        .slice(0, PER_CONFIG_CAP);
      found[cfg.id] = jobs.length;
      all = all.concat(jobs);
      runResults.push({ name: cfg.name, source: cfg.source, ok: true, count: jobs.length });
      console.log(`✓ ${cfg.name}: ${jobs.length} jobs`);
    } catch (e) {
      found[cfg.id] = 0;
      runResults.push({ name: cfg.name, source: cfg.source, ok: false, error: String(e.message || e).slice(0, 500) });
      console.warn(`✗ ${cfg.name}: ${e.message}`);
    }
  }

  // clean display fields (decode entities) and drop internal-only keys
  all = all.map(({ _tags, ...j }) => ({
    ...j,
    title: decodeEntities(j.title),
    company: decodeEntities(j.company),
    location: decodeEntities(j.location),
  }));

  // dedupe by url (fall back to id)
  const seen = new Set();
  all = all.filter(j => { const k = j.url || j.id; if (seen.has(k)) return false; seen.add(k); return true; });
  console.log(`\n${all.length} unique jobs; scoring...`);

  const { jobs, resumes, scored } = await scoreJobs(all, m => console.log('  ' + m), prefsPromptText(prefs));

  // Seen-state: only jobs never encountered before count as "new" for notifications.
  const seenPath = path.join(__dirname, 'seen.json');
  let seenState = {};
  try { seenState = JSON.parse(fs.readFileSync(seenPath, 'utf8')); } catch { /* first run */ }
  const fresh = jobs.filter(j => !seenState[j.url || j.id]);
  const now = new Date().toISOString();
  fresh.forEach(j => { seenState[j.url || j.id] = now; });
  fs.writeFileSync(seenPath, JSON.stringify(seenState, null, 2));
  console.log(`${fresh.length} not seen before (${Object.keys(seenState).length} tracked total)`);

  // Telegram: report fresh jobs scoring at or above the threshold. Quiet otherwise.
  const minScore = Number(process.env.JH_NOTIFY_MIN_SCORE || prefs.notify_min_score || 6);
  const notable = scored ? fresh.filter(j => bestScore(j) >= minScore) : [];
  if (!scored && fresh.length) console.log('  (scoring skipped — no Telegram report without scores)');
  let notified = false;
  if (prefs.telegram_enabled === false) {
    console.log('  Telegram disabled in prefs — skipping');
  } else {
    try {
      notified = await notifyTelegram(notable, m => console.log('  ' + m));
    } catch (e) {
      console.warn(`  Telegram failed: ${e.message}`);
    }
  }

  // Carry over application statuses (applied/interview/archived) set in the UI, keyed by URL.
  let statuses = {};
  try { statuses = JSON.parse(fs.readFileSync(path.join(__dirname, 'statuses.json'), 'utf8')); } catch { /* none yet */ }
  jobs.forEach(j => { if (statuses[j.url]) j.status = statuses[j.url]; });

  const CONFIGS = configs.map(c => ({
    id: c.id,
    name: c.name,
    source: c.source,
    url: c.url || sourceUrl(c),
    cron: c.cron || '0 8 * * *',
    last_run: 'just now',
    active: !!c.active,
    found_total: found[c.id] || 0,
  }));

  const RESUMES = resumes.map((r, i) => ({
    id: r.id,
    name: r.name,
    active: i === 0,
    uploaded_at: new Date().toISOString().slice(0, 10),
    tokens: Math.round(r.text.length / 4),
    last_updated_human: 'today',
  }));

  // Scan history for the Scans page (keep the last 20 runs; committed so cloud runs show too).
  const scanRecord = {
    at: new Date().toISOString(),
    sources: runResults,
    ok: runResults.filter(r => r.ok).length,
    failed: runResults.filter(r => !r.ok).length,
    unique: jobs.length,
    new: fresh.length,
    scored,
    notified: notified ? notable.length : 0,
  };
  const scansPath = path.join(__dirname, 'scans.json');
  let scans = [];
  try { scans = JSON.parse(fs.readFileSync(scansPath, 'utf8')); } catch { /* first run */ }
  scans.unshift(scanRecord);
  scans = scans.slice(0, 20);
  fs.writeFileSync(scansPath, JSON.stringify(scans, null, 2));

  const payload = {
    META: { generated_at: new Date().toISOString(), scoring_model: scored ? MODEL : null },
    RESUMES_FULL: RESUMES,
    RESUMES_SINGLE: RESUMES.slice(0, 1),
    RESUMES_FOUR: RESUMES,
    CONFIGS,
    JOBS: jobs,
    SCANS: scans,
  };

  const out = path.join(__dirname, 'live-data.js');
  fs.writeFileSync(out,
    `// Generated by scraper/run.js on ${new Date().toISOString()} — do not edit by hand.\n` +
    `window.JH_DATA = ${JSON.stringify(payload, null, 2)};\n`);
  console.log(`\nWrote ${jobs.length} jobs -> ${out}  (scoring: ${scored ? 'LLM' : 'skipped/neutral'})`);
}

run().catch(e => { console.error(e); process.exit(1); });
