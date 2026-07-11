// scraper/server.js — local control panel: serves the prototype AND a small JSON API so the
// "Scraper config" page can add/toggle sources, edit preferences, and trigger a run.
// Zero deps. Run:  node server.js   →   http://localhost:8090
try { require('process').loadEnvFile(require('path').join(__dirname, '.env')); } catch { /* no .env */ }

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { detect } = require('./detect');
const { DEFAULTS } = require('./prefs');

const ROOT = path.join(__dirname, '..');            // the prototype lives one level up
const PORT = Number(process.env.JH_PORT || 8090);
const SOURCES = path.join(__dirname, 'sources.json');
const PREFS = path.join(__dirname, 'prefs.json');

const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.jsx': 'text/babel',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.png': 'image/png', '.ico': 'image/x-icon',
};
const readJSON = (p, fb) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fb; } };
const RESUMES = path.join(__dirname, 'resumes');
const STATUSES = path.join(__dirname, 'statuses.json');   // local overlay: {jobUrl: status}
const VIEWED = path.join(__dirname, 'viewed.json');       // local overlay: {jobUrl: true} (read/unread)
const PROFILE = path.join(__dirname, 'profile.json');     // { name, onboarded }
const resumeCount = () => { try { return fs.readdirSync(RESUMES).filter(f => /\.(md|txt)$/i.test(f)).length; } catch { return 0; } };
const { loadResumes } = require('./score');
const hasKey = () => !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
const anthropic = () => new (require('@anthropic-ai/sdk'))();
const plain = s => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
const jsonOut = (r) => { try { return JSON.parse((r.content.find(b => b.type === 'text') || {}).text || '{}'); } catch { return {}; } };
const safeId = s => String(s || '').toLowerCase().replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'resume';
const send = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }); res.end(JSON.stringify(obj)); };

function body(req) {
  return new Promise((resolve) => { let b = ''; req.on('data', d => (b += d)); req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch { resolve({}); } }); });
}

let running = false, lastRun = null;

// Trigger the daily scrape in the cloud (GitHub Actions workflow_dispatch).
// Uses the gh CLI if installed+authed, else a GITHUB_TOKEN + GITHUB_REPO from .env.
async function triggerCloud() {
  const wf = process.env.GITHUB_WORKFLOW_FILE || 'scrape.yml';
  const ref = process.env.GITHUB_REF || 'main';
  try {
    require('child_process').execFileSync('gh', ['workflow', 'run', wf, '--ref', ref],
      { cwd: ROOT, timeout: 20000, stdio: 'pipe' });
    return { ok: true, via: 'gh' };
  } catch (e) {
    if (e.code !== 'ENOENT') throw new Error((e.stderr ? e.stderr.toString() : e.message).slice(0, 250));
  }
  const token = process.env.GITHUB_TOKEN || process.env.GH_DISPATCH_TOKEN;
  const repo = process.env.GITHUB_REPO;
  if (!token || !repo)
    throw new Error('Cloud runs not set up. Either install & log in to the GitHub CLI (`gh auth login`), or add GITHUB_TOKEN and GITHUB_REPO to scraper/.env.');
  const r = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/${wf}/dispatches`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'jobhunter', 'X-GitHub-Api-Version': '2022-11-28' },
    body: JSON.stringify({ ref }),
  });
  if (r.status === 204) return { ok: true, via: 'api' };
  throw new Error(`GitHub API ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

async function api(req, res, url) {
  if (req.method === 'OPTIONS') return send(res, 204, {});

  // Reads fall back to sources.default.json on a fresh checkout; the first save
  // below materializes the personal (gitignored) sources.json.
  if (url.pathname === '/api/sources' && req.method === 'GET') return send(res, 200, require('./lib').loadSources(__dirname));
  if (url.pathname === '/api/sources' && req.method === 'POST') {
    const list = await body(req);
    if (!Array.isArray(list)) return send(res, 400, { error: 'expected an array' });
    fs.writeFileSync(SOURCES, JSON.stringify(list, null, 2) + '\n');
    return send(res, 200, { ok: true, count: list.length });
  }

  if (url.pathname === '/api/prefs' && req.method === 'GET') return send(res, 200, { ...DEFAULTS, ...readJSON(PREFS, {}) });
  if (url.pathname === '/api/prefs' && req.method === 'POST') {
    const p = await body(req);
    fs.writeFileSync(PREFS, JSON.stringify(p, null, 2) + '\n');
    return send(res, 200, { ok: true });
  }

  if (url.pathname === '/api/detect' && req.method === 'POST') {
    const { input } = await body(req);
    try { return send(res, 200, await detect(input)); }
    catch (e) { return send(res, 200, { error: e.message }); }
  }

  // First-run profile + onboarding gate
  if (url.pathname === '/api/profile' && req.method === 'GET')
    return send(res, 200, { ...readJSON(PROFILE, { name: '', onboarded: false }), resumeCount: resumeCount() });
  if (url.pathname === '/api/profile' && req.method === 'POST') {
    const p = await body(req);
    fs.writeFileSync(PROFILE, JSON.stringify({ name: p.name || '', onboarded: !!p.onboarded }, null, 2));
    return send(res, 200, { ok: true });
  }

  // Read/unread overlay — the "New" badge clears once a job is opened
  if (url.pathname === '/api/viewed' && req.method === 'GET') return send(res, 200, readJSON(VIEWED, {}));
  if (url.pathname === '/api/view' && req.method === 'POST') {
    const { url: jobUrl } = await body(req);
    if (!jobUrl) return send(res, 400, { error: 'need {url}' });
    const v = readJSON(VIEWED, {});
    if (!v[jobUrl]) { v[jobUrl] = true; fs.writeFileSync(VIEWED, JSON.stringify(v, null, 2)); }
    return send(res, 200, { ok: true });
  }

  // Application status overlay: new | applied | interview | archived (browser applies it)
  if (url.pathname === '/api/statuses' && req.method === 'GET') return send(res, 200, readJSON(STATUSES, {}));
  if (url.pathname === '/api/status' && req.method === 'POST') {
    const { url: jobUrl, status } = await body(req);
    if (!jobUrl || !['new', 'applied', 'interview', 'archived'].includes(status))
      return send(res, 400, { error: 'need {url, status in new/applied/interview/archived}' });
    const st = readJSON(STATUSES, {});
    if (status === 'new') delete st[jobUrl]; else st[jobUrl] = status;
    fs.writeFileSync(STATUSES, JSON.stringify(st, null, 2));
    return send(res, 200, { ok: true });
  }

  // Résumés: list / upload (PDF extracted via Claude, no extra deps) / delete
  if (url.pathname === '/api/resumes' && req.method === 'GET') {
    let files = [];
    try { files = fs.readdirSync(RESUMES).filter(f => /\.(md|txt)$/i.test(f)); } catch { /* dir missing */ }
    return send(res, 200, files.map(f => {
      const text = fs.readFileSync(path.join(RESUMES, f), 'utf8');
      const first = (text.split('\n').find(l => l.trim()) || f).replace(/^#\s*/, '').trim();
      return { id: f.replace(/\.(md|txt)$/i, ''), name: first.slice(0, 60), tokens: Math.round(text.length / 4) };
    }));
  }
  if (url.pathname === '/api/resume' && req.method === 'POST') {
    const { filename, media_type, data } = await body(req);
    if (!data) return send(res, 400, { error: 'no file data' });
    const id = safeId(filename);
    const isPdf = /pdf/i.test(media_type || '') || /\.pdf$/i.test(filename || '');
    fs.mkdirSync(RESUMES, { recursive: true });
    try {
      let md;
      if (isPdf) {
        if (!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN))
          return send(res, 200, { error: 'PDF extraction needs ANTHROPIC_API_KEY in .env — or upload a .md/.txt.' });
        const client = new (require('@anthropic-ai/sdk'))();
        const r = await client.messages.create({
          model: process.env.JH_SCORING_MODEL || 'claude-haiku-4-5',
          max_tokens: 2500,
          messages: [{ role: 'user', content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: String(data).replace(/\s/g, '') } },
            { type: 'text', text: 'Extract this résumé as clean Markdown. First line is "# <Name / headline>", then contact, summary, skills, experience, education. Preserve all facts; no commentary. Output only the Markdown.' },
          ] }],
        });
        md = (r.content.find(b => b.type === 'text') || {}).text || '';
        if (!md.trim()) return send(res, 200, { error: 'Could not extract text from that PDF.' });
      } else {
        md = Buffer.from(String(data), 'base64').toString('utf8');
      }
      fs.writeFileSync(path.join(RESUMES, id + '.md'), md);
      return send(res, 200, { ok: true, id, chars: md.length });
    } catch (e) { return send(res, 200, { error: e.message }); }
  }
  if (url.pathname === '/api/resume' && req.method === 'DELETE') {
    // Delete by the exact id GET /api/resumes listed (filename minus extension) —
    // running it through safeId() would mangle spaces/case and miss the file.
    const id = path.basename(String(url.searchParams.get('id') || ''));   // basename blocks ../ traversal
    let removed = false;
    for (const ext of ['md', 'txt']) { const p = path.join(RESUMES, id + '.' + ext); if (id && fs.existsSync(p)) { fs.unlinkSync(p); removed = true; } }
    return send(res, 200, removed ? { ok: true } : { ok: false, error: `No résumé file named "${id}".` });
  }

  if (url.pathname === '/api/summarize' && req.method === 'POST') {
    const { title, company, description } = await body(req);
    if (!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN))
      return send(res, 200, { error: 'No ANTHROPIC_API_KEY set — add it to scraper/.env' });
    try {
      const Anthropic = require('@anthropic-ai/sdk');
      const client = new Anthropic();
      const text = String(description || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 6000);
      const r = await client.messages.create({
        model: process.env.JH_SCORING_MODEL || 'claude-haiku-4-5',
        max_tokens: 400,
        system: 'Summarize this job posting for a candidate as 4–6 short bullet points starting with "- ": ' +
          'the role focus, key requirements, location/comp if stated, and how to apply. Be concise, no preamble.',
        messages: [{ role: 'user', content: `${title || ''} at ${company || ''}\n\n${text}` }],
      });
      const summary = (r.content.find(b => b.type === 'text') || {}).text || '';
      return send(res, 200, { summary });
    } catch (e) { return send(res, 200, { error: e.message }); }
  }

  // Draft a tailored application: drafter → fresh-context reviewer.
  if (url.pathname === '/api/draft' && req.method === 'POST') {
    if (!hasKey()) return send(res, 200, { error: 'Drafting needs ANTHROPIC_API_KEY in scraper/.env.' });
    const { title, company, location, description, resumeId } = await body(req);
    const resumes = loadResumes();
    const r = resumes.find(x => x.id === resumeId) || resumes[0];
    if (!r) return send(res, 200, { error: 'No résumé to draft from — upload one first.' });
    const model = process.env.JH_DRAFT_MODEL || 'claude-opus-4-8';
    const jobText = `${title} at ${company}${location ? ' · ' + location : ''}\n\n${plain(description).slice(0, 6000)}`;
    try {
      const client = anthropic();
      // 1) Drafter
      const drafted = jsonOut(await client.messages.create({
        model, max_tokens: 2000,
        system: 'You are an expert career writer. Given a candidate résumé and a job posting, write a tailored cover letter ' +
          '(230–330 words: concrete achievements from the résumé mapped to this job\'s actual needs, specific, no clichés, no "I am writing to apply"). ' +
          'Also give 3–5 concrete CV suggestions — bullets the candidate should add or emphasise FOR THIS ROLE, grounded in their real experience. Output only the requested JSON.',
        messages: [{ role: 'user', content: `RÉSUMÉ (${r.name}):\n${r.text}\n\nJOB:\n${jobText}` }],
        output_config: { format: { type: 'json_schema', schema: {
          type: 'object', additionalProperties: false, required: ['cover_letter', 'cv_suggestions'],
          properties: { cover_letter: { type: 'string' }, cv_suggestions: { type: 'array', items: { type: 'string' } } },
        } } },
      }));
      // 2) Reviewer — fresh context, hiring-side critique
      const reviewed = jsonOut(await client.messages.create({
        model, max_tokens: 2000,
        system: 'You are a hiring-side reviewer reading a candidate\'s draft cover letter for a specific job. ' +
          'Tighten it: cut generic/filler lines, keep concrete achievements, make sure it addresses the posting\'s real requirements, ' +
          'and weave in any important keywords from the job it missed. Return the improved letter plus 2–4 short review notes on what you changed/why. Output only JSON.',
        messages: [{ role: 'user', content: `JOB:\n${jobText}\n\nDRAFT COVER LETTER:\n${drafted.cover_letter || ''}` }],
        output_config: { format: { type: 'json_schema', schema: {
          type: 'object', additionalProperties: false, required: ['cover_letter', 'notes'],
          properties: { cover_letter: { type: 'string' }, notes: { type: 'array', items: { type: 'string' } } },
        } } },
      }));
      return send(res, 200, {
        resume_name: r.name,
        cover_letter: reviewed.cover_letter || drafted.cover_letter || '',
        cv_suggestions: drafted.cv_suggestions || [],
        notes: reviewed.notes || [],
      });
    } catch (e) { return send(res, 200, { error: e.message }); }
  }

  if (url.pathname === '/api/run-cloud' && req.method === 'POST') {
    try { return send(res, 200, await triggerCloud()); }
    catch (e) { return send(res, 200, { error: e.message }); }
  }

  if (url.pathname === '/api/run' && req.method === 'POST') {
    if (running) return send(res, 200, { running: true, note: 'a run is already in progress' });
    running = true;
    let out = '';
    const child = spawn(process.execPath, [path.join(__dirname, 'run.js')], { cwd: __dirname });
    child.stdout.on('data', d => (out += d));
    child.stderr.on('data', d => (out += d));
    child.on('close', code => { running = false; lastRun = { at: new Date().toISOString(), code, out: out.slice(-4000) }; });
    return send(res, 202, { started: true });
  }
  if (url.pathname === '/api/run' && req.method === 'GET') return send(res, 200, { running, lastRun });

  return send(res, 404, { error: 'unknown endpoint' });
}

function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/') rel = '/Jobhunter.html';
  const abs = path.join(ROOT, rel);
  if (!abs.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); }  // no path traversal
  fs.readFile(abs, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(abs)] || 'application/octet-stream' });
    res.end(buf);
  });
}

http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname.startsWith('/api/')) return api(req, res, url).catch(e => send(res, 500, { error: e.message }));
  serveStatic(req, res, url);
}).listen(PORT, () => {
  console.log(`Jobhunter control panel → http://localhost:${PORT}`);
  console.log('Open it, go to "Scraper config" to add sites, set preferences, and Run now.');
});
