const { chromeFetch, decodeEntities, hashId } = require('../lib');

// Apple careers — Akamai blocks plain HTTP (TLS fingerprinting), but the search page
// renders fine in real headless Chrome, so we parse the rendered DOM.
// ponytail: regex over rendered rows; if Apple reships the page, update the row regexes.

function parseApple(html) {
  const rows = html.split('rc-accordion-item"').slice(1);
  const jobs = [];
  for (const row of rows) {
    const m = row.match(/<h3><a[^>]*href="(\/[a-z-]+\/details\/[^"]+)"[^>]*>([^<]+)<\/a><\/h3>/);
    if (!m) continue;
    const team = (row.match(/class="team-name[^"]*">([^<]+)/) || [])[1] || '';
    const date = (row.match(/class="job-posted-date"[^>]*>([^<]+)/) || [])[1] || '';
    const loc = (row.match(/id="search-store-name-container-\d+">([^<]+)/) || [])[1] || '';
    jobs.push({
      url: `https://jobs.apple.com${m[1].split('?')[0]}`,
      title: decodeEntities(m[2].trim()),
      team: decodeEntities(team.trim()),
      location: decodeEntities(loc.trim()),
      posted: date.trim(),
    });
  }
  return jobs;
}

async function apple(config) {
  const q = encodeURIComponent(config.query || 'software engineer');
  const html = chromeFetch(`https://jobs.apple.com/en-us/search?search=${q}&sort=newest`);
  return parseApple(html).map(r => ({
    id: hashId(r.url),
    title: r.title,
    company: 'Apple',
    location: r.location,
    posted_at: r.posted && !isNaN(Date.parse(r.posted)) ? new Date(r.posted).toISOString() : '',
    posted_human: r.posted,
    url: r.url,
    salary: '',
    employment_type: 'Full-time',
    seniority: '',
    source: 'apple',
    config_id: config.id,
    status: 'new',
    description: `<p>${r.title}${r.team ? ' — ' + r.team : ''}${r.location ? ' · ' + r.location : ''} (Apple)</p>`,
    resume_scores: {}, best_resume_id: null, why: [], activity: [],
  }));
}

module.exports = apple;
module.exports.parseApple = parseApple;
