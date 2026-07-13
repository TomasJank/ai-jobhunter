// scraper/test.js — assert-based self-check for the pure logic (no network). `node test.js`.
const assert = require('assert');
const { stripTags, relTime, hashId, matchesKeywords, mdToHtml } = require('./lib');

// Markdown -> HTML (JobSpy/Indeed descriptions): bold, unescape, inline bullets, no raw **
const md = mdToHtml("**About** youbloom hires. **Do** * build components * ship real\\-world code");
assert.ok(md.includes('<strong>About</strong>'), 'bold rendered');
assert.ok(md.includes('<li>build components</li>'), 'inline bullets -> li');
assert.ok(md.includes('real-world'), 'backslash-escape removed');
assert.ok(!md.includes('**'), 'no raw ** left');
assert.strictEqual(mdToHtml('<p>already html</p>').includes('<p>already html'), true);

// stripTags: tags gone, entities decoded, whitespace collapsed
assert.strictEqual(stripTags('<p>Hello&nbsp;<b>world</b> &amp; more</p>'), 'Hello world & more');

// relTime: deterministic buckets
assert.strictEqual(relTime(Math.floor(Date.now() / 1000) - 7200), '2h ago');
assert.strictEqual(relTime(Math.floor(Date.now() / 1000) - 172800), '2d ago');
assert.strictEqual(relTime(''), '');

// hashId: stable + collision-avoiding
assert.strictEqual(hashId('https://x/1'), hashId('https://x/1'));
assert.notStrictEqual(hashId('a'), hashId('b'));

// keyword filter: whole-word by default, trailing '*' = prefix match
assert.ok(matchesKeywords({ title: 'Senior Frontend Engineer', description: '' }, ['front*']), 'front* matches Frontend');
assert.ok(!matchesKeywords({ title: 'Senior Frontend Engineer', description: '' }, ['front']), 'front (whole word) must not match Frontend');
assert.ok(matchesKeywords({ title: 'Software Engineer Intern', description: '' }, ['intern']));
assert.ok(!matchesKeywords({ title: 'Fullstack Engineer, Internal Tools', description: '' }, ['intern']), 'intern must not match Internal');
assert.ok(!matchesKeywords({ title: 'International Strategy Manager', description: '' }, ['intern', 'internship*']), 'intern must not match International');
assert.ok(matchesKeywords({ title: 'Summer 2027 Internships - Data', description: '' }, ['internship*']), 'internship* matches Internships');
assert.ok(matchesKeywords({ title: '2027 Summer Analyst Program', description: '' }, ['summer analyst']));
assert.ok(!matchesKeywords({ title: 'Line Cook', description: 'kitchen' }, ['react']));
assert.ok(matchesKeywords({ title: 'Anything', description: '' }, []));

// "Company: Role" title split (WeWorkRemotely convention)
const raw = 'Acme Corp: Senior Frontend Engineer';
const idx = raw.indexOf(':');
assert.strictEqual(raw.slice(0, idx).trim(), 'Acme Corp');
assert.strictEqual(raw.slice(idx + 1).trim(), 'Senior Frontend Engineer');

// Telegram message formatting: HTML-escaped, sorted by score, chunked at the 4096 limit
const { formatMessages, bestScore, TG_LIMIT } = require('./notify');
const mk = (title, score) => ({
  title, company: 'A&B <Co>', location: 'Kaunas', url: 'https://x/' + title,
  resume_scores: { r1: score }, best_resume_id: 'r1',
});
const [msg] = formatMessages([mk('low', 6.1), mk('high', 9.3)]);
assert.ok(msg.includes('A&amp;B &lt;Co&gt;'), 'company must be HTML-escaped');
assert.ok(msg.indexOf('high') < msg.indexOf('low'), 'higher score listed first');
assert.ok(msg.includes('<b>9.3</b>'), 'score rendered');
const many = Array.from({ length: 120 }, (_, i) => mk('a-fairly-long-job-title-to-fill-space ' + i, 7));
const chunks = formatMessages(many);
assert.ok(chunks.length > 1, 'long lists split into multiple messages');
assert.ok(chunks.every(c => c.length <= TG_LIMIT), 'every chunk fits the Telegram limit');
assert.strictEqual(chunks.join('\n\n').split('<b>7.0</b>').length - 1, 120, 'every job listed, none dropped');
assert.strictEqual(bestScore({ resume_scores: {}, best_resume_id: 'x' }), 0);

// Source detection: known platforms, Workday host parse, and blocked sites
const { detectFromUrl, companyFromHost } = require('./detect');
assert.strictEqual(detectFromUrl('https://boards.greenhouse.io/figma').config.provider, 'greenhouse');
assert.strictEqual(detectFromUrl('jobs.lever.co/netlify').config.provider, 'lever');
const wd = detectFromUrl('https://nvidia.wd5.myworkdayjobs.com/en-US/NVIDIAExternalCareerSite/jobs').config;
assert.strictEqual(wd.provider, 'workday');
assert.strictEqual(wd.tenant, 'nvidia');
assert.strictEqual(wd.site, 'NVIDIAExternalCareerSite');
assert.ok(detectFromUrl('https://www.linkedin.com/jobs').blocked, 'LinkedIn must be blocked');
assert.ok(detectFromUrl('https://www.tesla.com/careers/search').blocked, 'Tesla must be blocked (Akamai)');
assert.ok(detectFromUrl('https://www.citadel.com/careers').blocked, 'Citadel must be blocked (Cloudflare)');
assert.strictEqual(detectFromUrl('https://example.com/careers'), null, 'unknown site → null');
// Eightfold PCSX sites (Microsoft, Qualcomm) — scraped via headless Chrome
const ms = detectFromUrl('https://apply.careers.microsoft.com/careers/job/123').config;
assert.strictEqual(ms.source, 'pcsx');
assert.strictEqual(ms.company, 'Microsoft');
assert.strictEqual(detectFromUrl('https://careers.qualcomm.com/careers').config.source, 'pcsx');
// Oracle Recruiting Cloud — site number parsed from candidate URL
const ora = detectFromUrl('https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/job/210755745').config;
assert.strictEqual(ora.provider, 'oracle');
assert.strictEqual(ora.site, 'CX_1001');
assert.strictEqual(detectFromUrl('https://www.ibm.com/careers/search').config.source, 'ibm');
// Company label extraction (feeds the URL-that-isn't-a-known-ATS probe fallback)
assert.strictEqual(companyFromHost('www.hostinger.com'), 'hostinger');
assert.strictEqual(companyFromHost('careers.google.com'), 'google');
assert.strictEqual(companyFromHost('jobs.example.co.uk'), 'example');

// PCSX card parse (Microsoft/Qualcomm DOM shape)
const { parsePcsx } = require('./sources/pcsx');
const pcsxHtml = `<div data-test-id="job-listing"><a aria-label="View job: Software Engineer II" href="/careers/job/123">
<div class="title-1aNJK">Software Engineer II</div><div class="fieldValue-3kEar">Redmond, WA</div>
<div class="subData-13Lm1">Posted a month ago</div></a></div>`;
const pcsxJobs = parsePcsx(pcsxHtml, 'https://apply.careers.microsoft.com');
assert.strictEqual(pcsxJobs.length, 1);
assert.strictEqual(pcsxJobs[0].title, 'Software Engineer II');
assert.strictEqual(pcsxJobs[0].url, 'https://apply.careers.microsoft.com/careers/job/123');
assert.strictEqual(pcsxJobs[0].location, 'Redmond, WA');
assert.strictEqual(pcsxJobs[0].posted_human, 'a month ago');

// Radancy anchor parse — location inside the anchor (Intuit) and after it (Barclays)
const { parseRadancy } = require('./sources/radancy');
const radIn = parseRadancy('<a href="/job/mtv/swe/1/2"><h2>Staff Engineer</h2><span class="job-location">Mountain View</span></a>', 'https://jobs.intuit.com');
assert.strictEqual(radIn[0].title, 'Staff Engineer');
assert.strictEqual(radIn[0].location, 'Mountain View');
const radAfter = parseRadancy('<a href="/job/ny/net-eng/3/4"><strong>Network Engineer</strong></a>\n<p class="job-location">Whippany (United States)</p>', 'https://search.jobs.barclays');
assert.strictEqual(radAfter[0].title, 'Network Engineer');
assert.strictEqual(radAfter[0].location, 'Whippany (United States)');
assert.strictEqual(parseRadancy('<a href="/job/a/b/1/2"><h2>X</h2></a><a href="/job/a/b/1/2"><h2>X</h2></a>', 'x').length, 1, 'duplicate job urls collapse');

// loadSources: personal sources.json wins; fresh checkout falls back to defaults
const { loadSources } = require('./lib');
const os = require('os'), fsT = require('fs'), pathT = require('path');
const tmp = fsT.mkdtempSync(pathT.join(os.tmpdir(), 'jh-src-'));
fsT.writeFileSync(pathT.join(tmp, 'sources.default.json'), '[{"id":"d1"}]');
assert.strictEqual(loadSources(tmp)[0].id, 'd1', 'falls back to defaults');
fsT.writeFileSync(pathT.join(tmp, 'sources.json'), '[{"id":"p1"},{"id":"p2"}]');
assert.strictEqual(loadSources(tmp).length, 2, 'personal file wins');
assert.strictEqual(loadSources(tmp)[0].id, 'p1');
assert.deepStrictEqual(loadSources(fsT.mkdtempSync(pathT.join(os.tmpdir(), 'jh-none-'))), [], 'neither file -> []');

// Seniority preferences: classify + hard filter
const { seniorityLevel, passesSeniority } = require('./prefs');
assert.strictEqual(seniorityLevel('Senior Frontend Engineer'), 'senior');
assert.strictEqual(seniorityLevel('React Developer Intern'), 'intern');
assert.strictEqual(seniorityLevel('Staff Software Engineer'), 'staff');
assert.strictEqual(seniorityLevel('Frontend Engineer'), null, 'unclassified stays null (never dropped)');
const prefsNoIntern = { seniority: ['junior', 'mid', 'senior', 'staff', 'lead', 'principal'] };
assert.ok(!passesSeniority({ title: 'Frontend Intern' }, prefsNoIntern), 'intern dropped when deselected');
assert.ok(passesSeniority({ title: 'Frontend Engineer' }, prefsNoIntern), 'unknown level kept');
assert.ok(passesSeniority({ title: 'Senior Engineer' }, prefsNoIntern), 'selected level kept');

console.log('ok — all self-checks passed');
