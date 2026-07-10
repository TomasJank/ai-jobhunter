const { postJSON, hashId } = require('../lib');

// IBM careers — public Elasticsearch-style search API behind www.ibm.com/careers/search.
// field_keyword_19 is "City, CC", field_keyword_05 the country. Config: { query }
async function ibm(config) {
  const data = await postJSON('https://www-api.ibm.com/search/api/v2', {
    appId: 'careers',
    scopes: ['careers2'],
    query: { bool: { must: [{ query_string: { query: config.query || 'software engineer', fields: ['title'] } }] } },
    size: 20,
    from: 0,
    _source: ['title', 'url', 'description', 'field_keyword_05', 'field_keyword_19'],
  });
  return ((data.hits && data.hits.hits) || []).map(h => h._source || {}).filter(s => s.url && s.title).map(s => ({
    id: hashId(s.url),
    title: s.title,
    company: 'IBM',
    location: s.field_keyword_19 || s.field_keyword_05 || '',
    posted_at: '',
    posted_human: '',
    url: s.url,
    salary: '',
    employment_type: 'Full-time',
    seniority: '',
    source: 'ibm',
    config_id: config.id,
    status: 'new',
    description: s.description ? `<p>${s.description}</p>` : `<p>${s.title}</p>`,
    resume_scores: {}, best_resume_id: null, why: [], activity: [],
  }));
}

module.exports = ibm;
