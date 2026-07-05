const { fetchJSON, relTime, hashId, stripTags } = require('../lib');

// Latest "Ask HN: Who is hiring?" thread (posted monthly by user `whoishiring`).
// Its top-level comments are the job posts. Header convention: "Company | Role | Location | ...".
// ponytail: pipe-delimited header parse is best-effort — freeform comments won't all fit the mold.
async function hackernews(config) {
  const story = await fetchJSON(
    'https://hn.algolia.com/api/v1/search_by_date?tags=story,author_whoishiring&query=hiring&hitsPerPage=5'
  );
  const hit = (story.hits || []).find(h => /who is hiring/i.test(h.title || ''));
  if (!hit) return [];

  const res = await fetchJSON(
    `https://hn.algolia.com/api/v1/search?tags=comment,story_${hit.objectID}&hitsPerPage=100`
  );

  return (res.hits || [])
    .filter(c => c.comment_text)
    .map(c => {
      const text = stripTags(c.comment_text);
      const parts = text.split('|').map(s => s.trim());
      const company = (parts[0] || 'HN post').slice(0, 60);
      const title = (parts[1] || text.slice(0, 60)).slice(0, 80);
      const location = (parts[2] || '').slice(0, 40);
      const url = `https://news.ycombinator.com/item?id=${c.objectID}`;
      return {
        id: hashId(url),
        title, company, location,
        posted_at: c.created_at || '',
        posted_human: relTime(c.created_at),
        url,
        salary: '',
        employment_type: '',
        seniority: '',
        source: 'hackernews',
        config_id: config.id,
        status: 'new',
        description: `<p>${text.replace(/</g, '&lt;')}</p>`,
        resume_scores: {}, best_resume_id: null, why: [], activity: [],
      };
    });
}

module.exports = hackernews;
