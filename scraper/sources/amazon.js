const { fetchJSON, relTime, hashId, stripTags } = require('../lib');

// Amazon publishes a hidden JSON search endpoint (amazon.jobs/en/search.json) — plain GET.
async function amazon(config) {
  const q = encodeURIComponent(config.query || 'software');
  const data = await fetchJSON(`https://www.amazon.jobs/en/search.json?base_query=${q}&result_limit=30`);
  return (data.jobs || []).map(j => {
    const url = `https://www.amazon.jobs${j.job_path}`;
    const posted = (j.posted_date || '').replace(/\s+/g, ' ').trim();
    return {
      id: hashId(url),
      title: j.title,
      company: 'Amazon',
      location: j.normalized_location || j.location || '',
      posted_at: posted && !isNaN(Date.parse(posted)) ? new Date(posted).toISOString() : '',
      posted_human: relTime(posted),
      url,
      salary: '',
      employment_type: j.job_schedule_type || 'Full-time',
      seniority: '',
      source: 'amazon',
      config_id: config.id,
      status: 'new',
      description: j.description || `<p>${stripTags(j.description_short || j.title)}</p>`,
      resume_scores: {}, best_resume_id: null, why: [], activity: [],
    };
  });
}

module.exports = amazon;
