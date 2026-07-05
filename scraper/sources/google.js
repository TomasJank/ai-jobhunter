const { chromeFetch, decodeEntities, hashId } = require('../lib');

// Google Careers — JS-rendered page (their old JSON API is gone; the current backend is
// an unfriendly batchexecute RPC). Headless Chrome renders the cards; we parse the DOM.
// ponytail: regex over rendered cards; if Google reships the page, update the card regexes.

function parseGoogle(html) {
  const cards = html.split('class="lLd3Je"').slice(1);
  const jobs = [];
  for (const card of cards) {
    const link = card.match(/href="(jobs\/results\/\d+[^"?]*)/);
    const title = card.match(/<h3 class="QJPWVe">([^<]+)/);
    if (!link || !title) continue;
    // location spans follow a "place" material icon; grab the first plausible one
    const loc = (card.match(/class="r0wTof ?"[^>]*>([^<]+)/) || [])[1] || '';
    jobs.push({
      url: `https://www.google.com/about/careers/applications/${link[1]}`,
      title: decodeEntities(title[1].trim()),
      location: decodeEntities(loc.replace(/;.*$/, '').trim()),
    });
  }
  return jobs;
}

async function google(config) {
  const q = encodeURIComponent(`"${config.query || 'frontend'}"`);
  const html = chromeFetch(`https://www.google.com/about/careers/applications/jobs/results/?q=${q}`);
  return parseGoogle(html).map(r => ({
    id: hashId(r.url),
    title: r.title,
    company: 'Google',
    location: r.location,
    posted_at: '',
    posted_human: '',
    url: r.url,
    salary: '',
    employment_type: 'Full-time',
    seniority: '',
    source: 'google',
    config_id: config.id,
    status: 'new',
    description: `<p>${r.title}${r.location ? ' · ' + r.location : ''} (Google)</p>`,
    resume_scores: {}, best_resume_id: null, why: [], activity: [],
  }));
}

module.exports = google;
module.exports.parseGoogle = parseGoogle;
