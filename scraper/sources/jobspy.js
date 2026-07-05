const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { relTime, hashId, mdToHtml } = require('../lib');

// Indeed / Google Jobs boards via the JobSpy Python library (hidden-API, no browser).
// Setup once: python3 -m venv .venv && .venv/bin/pip install python-jobspy
// Config: { site: "indeed" | "google" | "zip_recruiter", query, location? }

function pythonBin() {
  const venv = path.join(__dirname, '..', '.venv', 'bin', 'python');
  return fs.existsSync(venv) ? venv : 'python3';
}

async function jobspy(config) {
  const site = config.site || 'indeed';
  const args = [
    path.join(__dirname, '..', 'jobspy_fetch.py'),
    site,
    config.query || 'frontend developer',
    String(config.limit || 15),
  ];
  if (config.location) args.push(config.location);

  const out = execFileSync(pythonBin(), args,
    { maxBuffer: 32 * 1024 * 1024, timeout: 240000, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  const rows = JSON.parse(out.trim().split('\n').pop()); // last line = the JSON (jobspy logs above it)

  return rows.filter(r => r.title && r.job_url).map(r => {
    const salary = r.min_amount && r.max_amount
      ? `${r.currency || '$'}${Math.round(r.min_amount / 1000)}–${Math.round(r.max_amount / 1000)}K${r.interval === 'hourly' ? '/hr' : ''}`
      : '';
    return {
      id: hashId(r.job_url),
      title: r.title,
      company: r.company || '—',
      location: (r.location || '') + (r.is_remote ? ' · Remote' : ''),
      posted_at: r.date_posted || '',
      posted_human: relTime(r.date_posted),
      url: r.job_url,
      salary,
      employment_type: r.job_type || 'Full-time',
      seniority: '',
      source: site === 'google' ? 'google-jobs' : site,
      config_id: config.id,
      status: 'new',
      description: r.description
        ? mdToHtml(String(r.description).slice(0, 6000))
        : `<p>${r.title} at ${r.company || ''}</p>`,
      resume_scores: {}, best_resume_id: null, why: [], activity: [],
    };
  });
}

module.exports = jobspy;
