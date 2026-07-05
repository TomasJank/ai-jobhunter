const { fetchJSON, relTime, hashId, stripTags } = require('../lib');

// Eightfold AI job boards (Netflix and others) — plain GET JSON.
// Config: { base: "https://explore.jobs.netflix.net", domain: "netflix.com", company: "Netflix", query }
async function eightfold(config) {
  const { base, domain } = config;
  if (!base || !domain) throw new Error('eightfold needs base + domain');
  const q = encodeURIComponent(config.query || '');
  const data = await fetchJSON(`${base}/api/apply/v2/jobs?domain=${domain}&start=0&num=20&query=${q}`);
  return (data.positions || []).map(p => ({
    id: hashId(p.canonicalPositionUrl || String(p.id)),
    title: p.name,
    company: config.company || domain.replace(/\..*$/, ''),
    location: p.location || (p.locations || [])[0] || '',
    posted_at: p.t_create ? new Date(p.t_create * 1000).toISOString() : '',
    posted_human: relTime(p.t_create),
    url: p.canonicalPositionUrl || `${base}/careers/job/${p.id}`,
    salary: '',
    employment_type: p.type || 'Full-time',
    seniority: '',
    source: 'eightfold',
    config_id: config.id,
    status: 'new',
    description: p.job_description || `<p>${stripTags(p.name)}</p>`,
    resume_scores: {}, best_resume_id: null, why: [], activity: [],
  }));
}

module.exports = eightfold;
