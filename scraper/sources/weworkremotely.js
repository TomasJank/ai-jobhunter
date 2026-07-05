const { fetchText, relTime, hashId, stripTags } = require('../lib');

// WeWorkRemotely publishes per-category RSS. Titles are "Company: Role".
// ponytail: regex RSS parse — fine for this well-formed feed; swap in a parser if a source breaks it.
function tag(block, name) {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  if (!m) return '';
  return m[1].replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '').trim();
}

async function weworkremotely(config) {
  const cat = config.category || 'remote-front-end-programming-jobs';
  const xml = await fetchText(`https://weworkremotely.com/categories/${cat}.rss`);
  const items = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
  return items.map(block => {
    const rawTitle = tag(block, 'title');
    const link = tag(block, 'link');
    const pub = tag(block, 'pubDate');
    const region = tag(block, 'region');
    const desc = tag(block, 'description');
    const idx = rawTitle.indexOf(':');
    const company = idx > 0 ? rawTitle.slice(0, idx).trim() : '—';
    const title = idx > 0 ? rawTitle.slice(idx + 1).trim() : rawTitle;
    return {
      id: hashId(link || rawTitle),
      title, company,
      location: region || 'Remote',
      posted_at: pub ? new Date(pub).toISOString() : '',
      posted_human: relTime(pub),
      url: link,
      salary: '',
      employment_type: 'Full-time',
      seniority: '',
      source: 'weworkremotely',
      config_id: config.id,
      status: 'new',
      description: desc || `<p>${stripTags(desc)}</p>`,
      resume_scores: {}, best_resume_id: null, why: [], activity: [],
    };
  });
}

module.exports = weworkremotely;
