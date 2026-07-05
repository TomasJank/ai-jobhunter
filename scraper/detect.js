// scraper/detect.js — turn a pasted careers URL (or a company name) into a source config,
// or a clear "can't scrape this" warning. Used by the config server's "Add website" flow.
const { fetchJSON } = require('./lib');

// Sites we deliberately cannot scrape for free — login walls / heavy anti-bot.
const BLOCKED = [
  { host: 'linkedin.com', reason: 'LinkedIn requires login and blocks automation. Not scrapeable on a free tier.' },
  { host: 'glassdoor.', reason: 'Glassdoor uses aggressive anti-bot protection needing paid residential proxies.' },
  { host: 'indeed.com', reason: 'Indeed blocks direct scraping — but it IS available here via the "Indeed (JobSpy)" source. Add that instead.' },
  { host: 'ziprecruiter.', reason: 'ZipRecruiter is anti-bot protected — available via the JobSpy source instead.' },
  { host: 'metacareers.com', reason: 'Meta careers needs session tokens + a headless browser babysitting the login. Not free-tier friendly.' },
  { host: 'facebook.com', reason: 'Meta/Facebook careers needs session tokens + anti-bot handling. Not free-tier friendly.' },
  { host: 'careers.microsoft.com', reason: 'Microsoft careers mints client-side auth tokens that require a headless browser. Not free-tier friendly.' },
  { host: 'microsoft.com/en-us/careers', reason: 'Microsoft careers requires client-minted tokens + a headless browser. Not free-tier friendly.' },
];

const slugify = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

// Pull the company label out of a careers hostname so we can probe its ATS.
// www.hostinger.com/career -> "hostinger", careers.google.com -> "google".
// ponytail: naive TLD strip with a small two-part-TLD list; a miss just falls
// through to the "unknown" message, so no need for a full public-suffix list.
const TWO_PART_TLD = new Set(['co.uk', 'com.au', 'co.nz', 'com.br', 'co.jp', 'com.mx']);
const HOST_JUNK = new Set(['www', 'careers', 'career', 'jobs', 'job', 'apply', 'work', 'join', 'boards']);
function companyFromHost(host) {
  const labels = String(host || '').toLowerCase().split('.').filter(Boolean);
  if (labels.length < 2) return '';
  let end = labels.length - 1;                                    // drop TLD
  if (labels.length >= 3 && TWO_PART_TLD.has(labels.slice(-2).join('.'))) end -= 1;
  const core = labels.slice(0, end);                              // e.g. ['www','hostinger']
  const meaningful = core.filter(l => !HOST_JUNK.has(l));
  return meaningful[meaningful.length - 1] || core[core.length - 1] || '';
}

// Parse a known platform straight out of the URL. Returns a config draft or null.
function detectFromUrl(raw) {
  let u;
  try { u = new URL(raw.includes('://') ? raw : 'https://' + raw); } catch { return null; }
  const host = u.hostname.toLowerCase();
  const parts = u.pathname.split('/').filter(Boolean);

  for (const b of BLOCKED) if ((host + u.pathname).includes(b.host)) return { blocked: true, reason: b.reason };

  if (host.includes('greenhouse.io')) {
    const slug = parts[0] || host.split('.')[0];
    return { config: { source: 'ats', provider: 'greenhouse', slug } };
  }
  if (host.includes('lever.co')) return { config: { source: 'ats', provider: 'lever', slug: parts[0] } };
  if (host.includes('ashbyhq.com')) return { config: { source: 'ats', provider: 'ashby', slug: parts[0] } };
  if (host.includes('smartrecruiters.com')) return { config: { source: 'ats', provider: 'smartrecruiters', slug: parts[0] } };
  if (/\.wd\d+\.myworkdayjobs\.com$/.test(host)) {
    const tenant = host.split('.')[0];
    const site = parts.find(p => !/^[a-z]{2}-[a-z]{2}$/i.test(p) && p !== 'job' && p !== 'jobs') || parts[0];
    return { config: { source: 'ats', provider: 'workday', host, tenant, site } };
  }
  if (host.includes('amazon.jobs')) return { config: { source: 'amazon' } };
  if (host.includes('jobs.apple.com')) return { config: { source: 'apple' } };
  if (host.includes('google.com') && u.pathname.includes('careers')) return { config: { source: 'google' } };
  if (host.includes('eightfold.ai') || /^explore\.jobs\./.test(host)) {
    return { config: { source: 'eightfold', base: u.origin, domain: host.split('.').slice(-2).join('.') } };
  }
  return null;
}

// No known platform in the URL/name — probe the common zero-auth ATSes by company slug.
async function probeCompany(name) {
  const slug = slugify(name);
  if (!slug) return null;
  const tries = [
    ['greenhouse', `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`, d => (d.jobs || []).length],
    ['lever', `https://api.lever.co/v0/postings/${slug}?mode=json&limit=1`, d => (Array.isArray(d) ? d.length : 0)],
    ['ashby', `https://api.ashbyhq.com/posting-api/job-board/${slug}`, d => (d.jobs || []).length],
    ['smartrecruiters', `https://api.smartrecruiters.com/v1/companies/${name.replace(/\s+/g, '')}/postings?limit=1`, d => (d.content || []).length],
  ];
  for (const [provider, url, count] of tries) {
    try {
      const data = await fetchJSON(url);
      if (count(data) > 0) {
        const cfg = provider === 'smartrecruiters'
          ? { source: 'ats', provider, slug: name.replace(/\s+/g, '') }
          : { source: 'ats', provider, slug };
        return { config: cfg, via: provider };
      }
    } catch { /* try next */ }
  }
  return null;
}

// One entry point for the UI: URL → parse; bare name → probe ATSes.
async function detect(input) {
  const trimmed = String(input || '').trim();
  if (!trimmed) return { error: 'empty input' };

  const fromUrl = detectFromUrl(trimmed);
  if (fromUrl) return fromUrl;                       // matched platform or blocked
  if (/\.|\//.test(trimmed) && trimmed.includes('.')) {
    // Looked like a URL but the host isn't a known ATS. Many companies self-host
    // their careers page while the jobs live in a hidden ATS (Hostinger -> Ashby),
    // so probe the domain's company label before giving up.
    let host = '';
    try { host = new URL(trimmed.includes('://') ? trimmed : 'https://' + trimmed).hostname; } catch { /* not a URL */ }
    const company = companyFromHost(host);
    const probed = company ? await probeCompany(company) : null;
    if (probed) return probed;
    return { unknown: true, reason: `Couldn't identify a supported job platform at "${trimmed}". Supported: Greenhouse, Lever, Ashby, SmartRecruiters, Workday, Amazon, Apple, Google, Eightfold.` };
  }
  const probed = await probeCompany(trimmed);        // treat as a company name
  if (probed) return probed;
  return { unknown: true, reason: `No public Greenhouse/Lever/Ashby/SmartRecruiters board found for "${trimmed}". If they have a careers page, paste its URL instead.` };
}

module.exports = { detect, detectFromUrl, probeCompany, companyFromHost, BLOCKED, slugify };
