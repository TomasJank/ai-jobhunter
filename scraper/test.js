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

// keyword filter
assert.ok(matchesKeywords({ title: 'Senior Frontend Engineer', description: '' }, ['front']));
assert.ok(!matchesKeywords({ title: 'Line Cook', description: 'kitchen' }, ['react']));
assert.ok(matchesKeywords({ title: 'Anything', description: '' }, []));

// "Company: Role" title split (WeWorkRemotely convention)
const raw = 'Acme Corp: Senior Frontend Engineer';
const idx = raw.indexOf(':');
assert.strictEqual(raw.slice(0, idx).trim(), 'Acme Corp');
assert.strictEqual(raw.slice(idx + 1).trim(), 'Senior Frontend Engineer');

// Telegram message formatting: HTML-escaped, sorted by score, capped list
const { formatMessage, bestScore, MAX_LISTED } = require('./notify');
const mk = (title, score) => ({
  title, company: 'A&B <Co>', location: 'Kaunas', url: 'https://x/' + title,
  resume_scores: { r1: score }, best_resume_id: 'r1',
});
const msg = formatMessage([mk('low', 6.1), mk('high', 9.3)]);
assert.ok(msg.includes('A&amp;B &lt;Co&gt;'), 'company must be HTML-escaped');
assert.ok(msg.indexOf('high') < msg.indexOf('low'), 'higher score listed first');
assert.ok(msg.includes('<b>9.3</b>'), 'score rendered');
const many = Array.from({ length: MAX_LISTED + 3 }, (_, i) => mk('job' + i, 7));
assert.ok(formatMessage(many).includes(`and 3 more`), 'overflow note when over cap');
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
assert.ok(detectFromUrl('https://careers.microsoft.com/us/en').blocked, 'Microsoft must be blocked');
assert.strictEqual(detectFromUrl('https://example.com/careers'), null, 'unknown site → null');
// Company label extraction (feeds the URL-that-isn't-a-known-ATS probe fallback)
assert.strictEqual(companyFromHost('www.hostinger.com'), 'hostinger');
assert.strictEqual(companyFromHost('careers.google.com'), 'google');
assert.strictEqual(companyFromHost('jobs.example.co.uk'), 'example');

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
