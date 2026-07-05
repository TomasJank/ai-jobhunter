const { fetchJSON, relTime, hashId, stripTags } = require('../lib');

// https://remoteok.com/api — JSON array; element 0 is a legal/attribution notice.
// (Their ToS asks for a visible link back to Remote OK when republishing.)
async function remoteok(config) {
  const rows = await fetchJSON('https://remoteok.com/api');
  let out = rows
    .filter(r => r && r.id && r.position)
    .map(r => {
      const url = r.url || `https://remoteok.com/remote-jobs/${r.slug || r.id}`;
      const salary = r.salary_min && r.salary_max
        ? `$${Math.round(r.salary_min / 1000)}–${Math.round(r.salary_max / 1000)}K`
        : '';
      return {
        id: hashId(url),
        title: r.position,
        company: r.company || '—',
        location: r.location || 'Remote',
        posted_at: r.date || (r.epoch ? new Date(r.epoch * 1000).toISOString() : ''),
        posted_human: relTime(r.date || r.epoch),
        url,
        salary,
        employment_type: 'Full-time',
        seniority: '',
        source: 'remoteok',
        config_id: config.id,
        status: 'new',
        description: r.description || `<p>${stripTags(r.description || r.position)}</p>`,
        _tags: (r.tags || []).map(t => String(t).toLowerCase()),
        resume_scores: {}, best_resume_id: null, why: [], activity: [],
      };
    });

  if (config.tags && config.tags.length) {
    const want = config.tags.map(t => t.toLowerCase());
    out = out.filter(j => j._tags.some(t => want.includes(t)));
  }
  return out;
}

module.exports = remoteok;
