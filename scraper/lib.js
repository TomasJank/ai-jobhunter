// scraper/lib.js — shared helpers. Zero deps; Node 18+ built-in fetch.
const UA = 'Mozilla/5.0 (JobhunterScraper; low-volume daily)';

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: '*/*' } });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.text();
}

async function fetchJSON(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

async function postJSON(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'User-Agent': UA, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

// Fetch a JS-rendered page through headless Chrome (for Akamai/anti-bot sites like
// Apple and JS-only pages like Google Careers). Requires Chrome/Chromium installed —
// present on macOS and on GitHub Actions ubuntu runners as `google-chrome`.
function chromeBin() {
  const { execSync } = require('child_process');
  if (process.env.JH_CHROME) return process.env.JH_CHROME;
  const mac = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if (require('fs').existsSync(mac)) return mac;
  for (const name of ['google-chrome', 'chromium-browser', 'chromium']) {
    try { execSync(`command -v ${name}`, { stdio: 'pipe' }); return name; } catch { /* next */ }
  }
  throw new Error('no Chrome/Chromium found (set JH_CHROME)');
}

function chromeFetch(url, budgetMs = 12000) {
  const { execFileSync } = require('child_process');
  return execFileSync(chromeBin(), [
    '--headless=new', '--disable-gpu', '--no-sandbox',
    `--virtual-time-budget=${budgetMs}`, '--dump-dom', url,
  ], { maxBuffer: 32 * 1024 * 1024, timeout: 90000, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
}

// ponytail: naive tag strip + a handful of entities — enough for keyword match + text fallback.
function stripTags(html = '') {
  return String(html)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ').trim();
}

// Minimal Markdown -> HTML for job descriptions from sources that return Markdown
// (JobSpy/Indeed). Covers what those feeds actually emit: escaped punctuation, bold,
// links, and *-bullets — including bullets that run inline in one line.
// ponytail: not a full CommonMark parser; extend if a feed needs more.
function mdToHtml(md = '') {
  let s = String(md).replace(/\r/g, '')
    .replace(/\\([-.*_>#`+!()\[\]])/g, '$1')                       // unescape \- \. \* etc
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>')  // [t](url)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')            // **bold**
    .replace(/__([^_]+)__/g, '<strong>$1</strong>');
  const blocks = s.split(/\n{2,}/).map(b => b.trim()).filter(Boolean);
  return blocks.map(b => {
    const lines = b.split('\n');
    if (lines.length > 1 && lines.every(l => /^\s*[*-]\s+/.test(l))) {   // real bullet block
      return '<ul>' + lines.map(l => `<li>${l.replace(/^\s*[*-]\s+/, '')}</li>`).join('') + '</ul>';
    }
    if (/\s\*\s/.test(b)) {                                              // inline "* a * b" bullets
      const [head, ...items] = b.split(/\s\*\s+/);
      const list = '<ul>' + items.map(i => `<li>${i.trim()}</li>`).join('') + '</ul>';
      return (head.trim() ? `<p>${head.trim()}</p>` : '') + list;
    }
    return `<p>${b.replace(/\n/g, ' ')}</p>`;
  }).join('');
}

function relTime(input) {
  if (!input) return '';
  const then = typeof input === 'number' ? input * 1000 : Date.parse(input);
  if (!then) return '';
  const s = Math.max(0, (Date.now() - then) / 1000);
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  const d = Math.round(s / 86400);
  return d === 1 ? '1d ago' : `${d}d ago`;
}

function decodeEntities(s = '') {
  return String(s)
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ');
}

// stable id from a job's URL (djb2)
function hashId(str) {
  let h = 5381;
  for (let i = 0; i < String(str).length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return 'job_' + h.toString(36);
}

// keep the job if any keyword matches the title or tags (word-start boundary), or if
// no keywords given. We deliberately skip the description — it's too noisy: a plain
// substring "ui" matches "b(ui)lding", "req(ui)rements", etc. Titles hold the role.
function matchesKeywords(job, keywords) {
  if (!keywords || !keywords.length) return true;
  const hay = (job.title + ' ' + (job._tags || []).join(' ')).toLowerCase();
  return keywords.some(k => new RegExp(`\\b${String(k).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(hay));
}

module.exports = { UA, fetchText, fetchJSON, postJSON, chromeFetch, stripTags, decodeEntities, mdToHtml, relTime, hashId, matchesKeywords };
