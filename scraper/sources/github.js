const { fetchText, fetchJSON, stripTags, hashId, relTime } = require('../lib');

// Community internship-list repos. Two shapes:
//   *.json  — SimplifyJobs/vanshb03 listings schema
//   *.md    — a Markdown table; columns are read from the header row, so the same
//             parser handles speedyapply, sndsh404, etc. without per-repo config.
// Repos whose "Apply" column links to `(#)` (zapplyjobs) yield no URLs and are unusable.

const FIELDS = {
  company: 'company',
  position: 'title', role: 'title', title: 'title', job: 'title',
  location: 'location', locations: 'location',
  salary: 'salary', pay: 'salary', compensation: 'salary',
  age: 'date', added: 'date', posted: 'date', date: 'date', dateposted: 'date',
};
const LINK_COLS = /apply|posting|link/;

function cellText(c) {
  return stripTags(c.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')).replace(/\*\*|__|`/g, '').trim();
}

// "26d" / "45m" / "3h" / "2w" relative, or an ISO date. Anything else -> no date.
function cellDate(s) {
  const rel = /^(\d+)\s*([mhdw])/i.exec(s);
  if (rel) {
    const mins = { m: 1, h: 60, d: 1440, w: 10080 }[rel[2].toLowerCase()] * Number(rel[1]);
    return new Date(Date.now() - mins * 60000).toISOString();
  }
  const iso = /\d{4}-\d{2}-\d{2}/.exec(s);
  return iso ? new Date(iso[0]).toISOString() : '';
}

function splitRow(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|');
}

function parseTable(md) {
  const lines = md.split('\n');
  const out = [];
  let cols = null, lastCompany = '';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim().startsWith('|')) { cols = null; continue; }
    if (/^\s*\|[\s:|-]+\|?\s*$/.test(line)) continue;            // separator row
    const cells = splitRow(line);
    if (!cols) {                                                  // header row
      if (!/^\s*\|[\s:|-]+\|?\s*$/.test(lines[i + 1] || '')) continue;
      cols = cells.map(c => cellText(c).toLowerCase().replace(/[^a-z]/g, ''));
      lastCompany = '';
      continue;
    }
    const row = {};
    let url = '';
    cells.forEach((c, k) => {
      const head = cols[k] || '';
      const link = /https?:\/\/[^\s"')<>]+/.exec(c);
      if (link && !url && (LINK_COLS.test(head) || !FIELDS[head])) url = link[0];
      const f = FIELDS[head];
      if (f) row[f] = cellText(c);
    });
    if (!url || !row.title) continue;
    // SimplifyJobs-style "↳" means: same company as the row above.
    if (!row.company || row.company === '↳') row.company = lastCompany;
    else lastCompany = row.company;
    out.push({ ...row, url });
  }
  return out;
}

async function github(config) {
  const repo = config.repo;
  if (!repo) throw new Error('github source needs "repo": "owner/name"');
  const file = config.file || 'README.md';
  const raw = `https://raw.githubusercontent.com/${repo}/${config.branch || 'main'}/${file}`;

  let rows;
  if (file.endsWith('.json')) {
    rows = (await fetchJSON(raw))
      .filter(r => r && r.url && r.title && r.active !== false && r.is_visible !== false)
      .map(r => ({
        title: r.title,
        company: r.company_name || '',
        location: (r.locations || []).join(' / '),
        url: r.url,
        posted_at: r.date_posted ? new Date(r.date_posted * 1000).toISOString() : '',
      }));
  } else {
    rows = parseTable(await fetchText(raw)).map(r => ({ ...r, posted_at: cellDate(r.date || '') }));
  }

  return rows
    .sort((a, b) => (b.posted_at || '').localeCompare(a.posted_at || ''))
    .map(r => ({
      id: hashId(r.url),
      title: r.title,
      company: r.company || '—',
      location: r.location || '',
      posted_at: r.posted_at,
      posted_human: relTime(r.posted_at),
      url: r.url,
      salary: r.salary || '',
      employment_type: 'Internship',
      seniority: '',
      source: 'github',
      config_id: config.id,
      status: 'new',
      description: `<p>Listed in <a href="https://github.com/${repo}">${repo}</a> — open the posting for the full description.</p>`,
      _tags: [],
      resume_scores: {}, best_resume_id: null, why: [], activity: [],
    }));
}

module.exports = github;
module.exports.parseTable = parseTable;
module.exports.cellDate = cellDate;
