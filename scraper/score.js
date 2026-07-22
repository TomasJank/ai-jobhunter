// scraper/score.js — LLM match scoring via the official Anthropic SDK (Claude).
// One call per job: scores the job against every résumé at once. Defaults to Haiku 4.5
// (a cheap classifier — matches the approved design); override with JH_SCORING_MODEL.
const fs = require('fs');
const path = require('path');
const { stripTags } = require('./lib');

const MODEL = process.env.JH_SCORING_MODEL || 'claude-haiku-4-5';
const SCORED_V = 2;   // bump when the scoring prompt/schema changes to invalidate cached scores

function loadResumes() {
  const dir = path.join(__dirname, 'resumes');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => /\.(md|txt)$/i.test(f))
    .map(f => {
      const text = fs.readFileSync(path.join(dir, f), 'utf8');
      const firstLine = text.split('\n').find(l => l.trim()) || f;
      return {
        id: f.replace(/\.(md|txt)$/i, ''),
        name: firstLine.replace(/^#\s*/, '').trim().slice(0, 40),
        text,
      };
    });
}

function hasCredentials() {
  return !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

let _client;
function client() {
  if (!_client) {
    const Anthropic = require('@anthropic-ai/sdk');
    _client = new Anthropic();
  }
  return _client;
}

function schemaFor(resumes) {
  return {
    type: 'object',
    properties: {
      scores: {
        type: 'object',
        properties: Object.fromEntries(resumes.map(r => [r.id, { type: 'number' }])),
        required: resumes.map(r => r.id),
        additionalProperties: false,
      },
      best_resume_id: { type: 'string', enum: resumes.map(r => r.id) },
      why: { type: 'array', items: { type: 'string' } },
      location_match: { type: 'boolean' },
    },
    required: ['scores', 'best_resume_id', 'why', 'location_match'],
    additionalProperties: false,
  };
}

async function scoreJob(job, resumes, schema, prefsText) {
  const resumeBlock = resumes.map(r => `### Résumé "${r.name}"  (return its score under the JSON key "${r.id}")\n${r.text}`).join('\n\n');
  const jobText = `${job.title} at ${job.company}\nLocation: ${job.location}\n\n${stripTags(job.description).slice(0, 4000)}`;
  const res = await client().messages.create({
    model: MODEL,
    max_tokens: 1024,
    system:
      'You score how well each résumé fits a job on a 0–10 scale (10 = perfect fit, <6 = weak). ' +
      'Score the fit both ways: penalize roles clearly below the candidate\'s seniority (e.g. intern/junior ' +
      'roles for a senior profile) as well as roles above or outside their experience. ' +
      (prefsText ? prefsText + ' ' : '') +
      'Set "location_match" by comparing ONLY the job\'s posted location against the candidate\'s preferred ' +
      'locations: true if the job is located in (or remote-open to) a preferred location, false if it is ' +
      'clearly somewhere else. Ignore the candidate\'s current residence, seniority, visa, or overall fit — ' +
      'this flag is about the job\'s geography only. If unclear, or no preferred locations are stated, set true. ' +
      'In "why", give 2–3 short reasons for the best-matching résumé, and refer to each résumé by its ' +
      'quoted name (e.g. "AI / Frontend Developer") — never by its JSON key/id. Output only the requested JSON.',
    messages: [{ role: 'user', content: `RESUMES:\n${resumeBlock}\n\nJOB:\n${jobText}` }],
    output_config: { format: { type: 'json_schema', schema } },
  });
  const text = res.content.find(b => b.type === 'text')?.text || '{}';
  return JSON.parse(text);
}

function neutral(job, resumes) {
  return {
    ...job,
    resume_scores: Object.fromEntries(resumes.map(r => [r.id, 0])),
    best_resume_id: resumes[0].id,
    location_match: true,   // unscored jobs stay visible
    why: ['Not yet scored — set ANTHROPIC_API_KEY to enable AI matching.'],
  };
}

async function scoreJobs(jobs, log = () => {}, prefsText = '') {
  const resumes = loadResumes();
  if (!resumes.length) { log('no résumés found — skipping scoring'); return { jobs, resumes: [], scored: false }; }
  if (!hasCredentials()) {
    log('no ANTHROPIC_API_KEY — skipping LLM scoring (neutral scores)');
    return { jobs: jobs.map(j => neutral(j, resumes)), resumes, scored: false };
  }

  const schema = schemaFor(resumes);
  const out = [];
  for (const job of jobs) {
    try {
      let r;
      try {
        r = await scoreJob(job, resumes, schema, prefsText);
      } catch (e) {
        log(`score failed for "${job.title}" (${e.message}) — retrying once`);
        r = await scoreJob(job, resumes, schema, prefsText);
      }
      out.push({ ...job, resume_scores: r.scores, best_resume_id: r.best_resume_id, why: r.why || [], location_match: r.location_match !== false, scored_v: SCORED_V });
    } catch (e) {
      log(`score failed for "${job.title}": ${e.message}`);
      out.push(neutral(job, resumes));
    }
  }
  return { jobs: out, resumes, scored: true };
}

module.exports = { scoreJobs, loadResumes, MODEL, SCORED_V };
