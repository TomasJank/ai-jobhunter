const { fetchText, stripTags, decodeEntities, hashId } = require('../lib');

// Radancy-powered career sites (Intuit, Barclays, ...) — server-rendered HTML, so a
// plain fetch works. Job anchors look like <a href="/job/<city>/<slug>/<id>/<id>">.
// Intuit puts the location span inside the anchor, Barclays right after it, so we
// look in both places. Config: { base: "https://jobs.intuit.com", company, query }
function parseRadancy(html, base) {
  const aRe = /<a[^>]*href="(\/job\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  const seen = new Set();
  const jobs = [];
  let m;
  while ((m = aRe.exec(html))) {
    if (seen.has(m[1])) continue;
    seen.add(m[1]);
    const near = m[2] + html.slice(aRe.lastIndex, aRe.lastIndex + 400);
    const loc = (near.match(/class="job-location"[^>]*>([^<]+)/) || [])[1] || '';
    const title = stripTags(m[2].replace(/<[a-z]+[^>]*class="job-location"[\s\S]*?>[^<]*<\/[a-z]+>/, ''));
    if (!title) continue;
    jobs.push({ url: base + m[1], title, location: decodeEntities(loc.trim()) });
  }
  return jobs;
}

async function radancy(config) {
  if (!config.base) throw new Error('radancy needs base');
  const q = encodeURIComponent(config.query || '');
  const html = await fetchText(`${config.base}/search-jobs/${q}`);
  return parseRadancy(html, config.base).map(r => ({
    id: hashId(r.url),
    title: r.title,
    company: config.company || '',
    location: r.location,
    posted_at: '',
    posted_human: '',
    url: r.url,
    salary: '',
    employment_type: 'Full-time',
    seniority: '',
    source: 'radancy',
    config_id: config.id,
    status: 'new',
    description: `<p>${r.title}${r.location ? ' · ' + r.location : ''}</p>`,
    resume_scores: {}, best_resume_id: null, why: [], activity: [],
  }));
}

module.exports = radancy;
module.exports.parseRadancy = parseRadancy;
