const { chromeFetch, decodeEntities, hashId } = require('../lib');

// Eightfold "PCSX" career sites (Microsoft, Qualcomm, ...). The classic Eightfold JSON
// API is gated ("Not authorized for PCSX"), but the search page renders fine in headless
// Chrome, so we parse the job cards from the DOM — same approach as the Google source.
// Config: { base: "https://apply.careers.microsoft.com", company: "Microsoft", query }
// ponytail: regex over rendered cards; if Eightfold reships the frontend, update these.
function parsePcsx(html, base) {
  const cards = html.split('data-test-id="job-listing"').slice(1);
  const jobs = [];
  for (const card of cards) {
    const link = card.match(/href="(\/careers\/job\/[^"]+)"/);
    const title = card.match(/aria-label="View job: ([^"]+)"/);
    if (!link || !title) continue;
    jobs.push({
      url: base + link[1],
      title: decodeEntities(title[1]),
      location: decodeEntities((card.match(/class="fieldValue[^"]*"[^>]*>([^<]+)/) || [])[1] || '').trim(),
      posted_human: ((card.match(/class="subData[^"]*"[^>]*>\s*Posted\s+([^<]+)/i) || [])[1] || '').trim(),
    });
  }
  return jobs;
}

async function pcsx(config) {
  if (!config.base) throw new Error('pcsx needs base');
  const q = encodeURIComponent(config.query || '');
  const html = chromeFetch(`${config.base}/careers?query=${q}`, 15000);
  return parsePcsx(html, config.base).map(r => ({
    id: hashId(r.url),
    title: r.title,
    company: config.company || '',
    location: r.location,
    posted_at: '',
    posted_human: r.posted_human,
    url: r.url,
    salary: '',
    employment_type: 'Full-time',
    seniority: '',
    source: 'pcsx',
    config_id: config.id,
    status: 'new',
    description: `<p>${r.title}${r.location ? ' · ' + r.location : ''}</p>`,
    resume_scores: {}, best_resume_id: null, why: [], activity: [],
  }));
}

module.exports = pcsx;
module.exports.parsePcsx = parsePcsx;
