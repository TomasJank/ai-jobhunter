const { fetchJSON, postJSON, relTime, hashId } = require('../lib');

// Applicant-tracking-system public job boards. Each returns clean JSON per company.
function decodeEntities(s) {
  return String(s)
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"');
}
const cap = s => String(s).charAt(0).toUpperCase() + String(s).slice(1);

async function greenhouse(config) {
  const data = await fetchJSON(`https://boards-api.greenhouse.io/v1/boards/${config.slug}/jobs?content=true`);
  return (data.jobs || []).map(j => ({
    title: j.title,
    company: config.company || cap(config.slug),
    location: (j.location && j.location.name) || '',
    posted_at: j.updated_at || '',
    url: j.absolute_url,
    description: decodeEntities(j.content || ''),
    employment_type: 'Full-time',
  }));
}

async function ashby(config) {
  const data = await fetchJSON(`https://api.ashbyhq.com/posting-api/job-board/${config.slug}`);
  return (data.jobs || []).map(j => ({
    title: j.title,
    company: config.company || cap(config.slug),
    location: j.location || '',
    posted_at: j.publishedAt || '',
    url: j.jobUrl,
    description: j.descriptionHtml || `<p>${j.descriptionPlain || ''}</p>`,
    employment_type: j.employmentType || 'Full-time',
  }));
}

async function lever(config) {
  const data = await fetchJSON(`https://api.lever.co/v0/postings/${config.slug}?mode=json`);
  return (data || []).map(j => ({
    title: j.text,
    company: config.company || cap(config.slug),
    location: (j.categories && j.categories.location) || '',
    posted_at: j.createdAt ? new Date(j.createdAt).toISOString() : '',
    url: j.hostedUrl,
    description: j.descriptionPlain ? `<p>${j.descriptionPlain}</p>` : (j.description || ''),
    employment_type: (j.categories && j.categories.commitment) || 'Full-time',
  }));
}

// Workday powers ~39% of the Fortune 500 — every tenant shares this cxs POST shape.
// Config: { host: "nvidia.wd5.myworkdayjobs.com", tenant: "nvidia", site: "NVIDIAExternalCareerSite" }
// ponytail: the list endpoint has no full description — that needs a per-job fetch (N calls);
// title+location is enough for scoring, so we skip it.
async function workday(config) {
  const { host, tenant, site } = config;
  if (!host || !tenant || !site) throw new Error('workday needs host, tenant, site');
  const locale = config.locale || 'en-US';
  const data = await postJSON(`https://${host}/wday/cxs/${tenant}/${site}/jobs`,
    { appliedFacets: {}, limit: 20, offset: 0, searchText: config.query || '' });
  return (data.jobPostings || []).map(j => ({
    title: j.title,
    company: config.company || cap(tenant),
    location: j.locationsText || '',
    posted_at: '',
    posted_human: (j.postedOn || '').replace(/^Posted\s+/i, '').replace(/\s+Ago$/i, ' ago').toLowerCase(),
    url: `https://${host}/${locale}/${site}${j.externalPath}`,
    description: `<p>${j.title} — ${j.locationsText || ''}</p>`,
    employment_type: 'Full-time',
  }));
}

// SmartRecruiters Posting API (public, no auth). Config: { slug: "Visa" }
async function smartrecruiters(config) {
  const data = await fetchJSON(`https://api.smartrecruiters.com/v1/companies/${config.slug}/postings?limit=50`);
  return (data.content || []).map(j => ({
    title: j.name,
    company: (j.company && j.company.name) || cap(config.slug),
    location: (j.location && j.location.fullLocation) || '',
    posted_at: j.releasedDate || '',
    url: `https://jobs.smartrecruiters.com/${config.slug}/${j.id}`,
    description: `<p>${j.name}${j.location && j.location.fullLocation ? ` — ${j.location.fullLocation}` : ''}</p>`,
    employment_type: (j.typeOfEmployment && j.typeOfEmployment.label) || 'Full-time',
  }));
}

const providers = { greenhouse, ashby, lever, workday, smartrecruiters };

async function ats(config) {
  const fn = providers[config.provider];
  if (!fn) throw new Error(`unknown ATS provider: ${config.provider}`);
  const raw = await fn(config);
  return raw.map(r => ({
    id: hashId(r.url),
    title: r.title,
    company: r.company,
    location: r.location || '',
    posted_at: r.posted_at || '',
    posted_human: r.posted_human || relTime(r.posted_at),
    url: r.url,
    salary: '',
    employment_type: r.employment_type || 'Full-time',
    seniority: '',
    source: config.provider,
    config_id: config.id,
    status: 'new',
    description: r.description || '',
    resume_scores: {}, best_resume_id: null, why: [], activity: [],
  }));
}

module.exports = ats;
