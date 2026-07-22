// scraper/prefs.js — user preferences: seniority filter (hard) + location/work-mode (soft, via scoring).
const fs = require('fs');
const path = require('path');

const SENIORITY_LEVELS = ['intern', 'junior', 'mid', 'senior', 'staff', 'lead', 'principal'];
const WORK_MODES = ['remote', 'hybrid', 'onsite'];

const DEFAULTS = {
  locations: ['Remote', 'Lithuania', 'EU'],
  work_modes: ['remote', 'hybrid'],
  seniority: ['junior', 'mid', 'senior', 'staff', 'lead', 'principal'], // intern off by default
  notify_min_score: 6,
  telegram_enabled: true,
};

function loadPrefs() {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'prefs.json'), 'utf8'));
    return { ...DEFAULTS, ...raw };
  } catch { return { ...DEFAULTS }; }
}

// Classify a job title into a seniority level, or null if unclear (unknown → never dropped).
function seniorityLevel(title = '') {
  const t = title.toLowerCase();
  if (/\bintern(ship)?\b/.test(t)) return 'intern';
  if (/\b(junior|jr\.?|entry[- ]level|new[- ]?grad|graduate)\b/.test(t)) return 'junior';
  if (/\bprincipal\b/.test(t)) return 'principal';
  if (/\bstaff\b/.test(t)) return 'staff';
  if (/\b(lead|head of|manager|director|vp|chief)\b/.test(t)) return 'lead';
  if (/\b(senior|sr\.?)\b/.test(t)) return 'senior';
  if (/\b(mid[- ]level|intermediate)\b/.test(t)) return 'mid';
  return null;
}

// Hard filter: drop a job only when its level is clearly detected AND deselected.
function passesSeniority(job, prefs) {
  const level = seniorityLevel(job.title);
  if (!level) return true;
  return prefs.seniority.includes(level);
}

// Hard pre-filter: drop jobs whose location is CLEARLY outside the US, before the per-source
// cap eats slots. Only active when prefs prefer the US. Ambiguous locations pass — the LLM
// location_match flag is the accurate backstop downstream.
// ponytail: denylist heuristic (ISO-3 codes + unambiguous names), not a geocoder — extend the list if junk slips through.
const FOREIGN_RE = new RegExp('\\b(' + [
  // country names
  'china', 'india', 'japan', 'korea', 'taiwan', 'singapore', 'ireland', 'germany', 'france',
  'spain', 'italy', 'poland', 'romania', 'czech', 'netherlands', 'belgium', 'sweden', 'denmark',
  'norway', 'finland', 'switzerland', 'austria', 'portugal', 'hungary', 'brazil', 'mexico',
  'canada', 'australia', 'israel', 'united kingdom', 'england', 'scotland', 'uk',
  // unambiguous foreign tech-hub cities
  'bengaluru', 'bangalore', 'shenzhen', 'beijing', 'shanghai', 'hyderabad', 'mumbai', 'pune',
  'chennai', 'gurgaon', 'gurugram', 'noida', 'tokyo', 'osaka', 'seoul', 'taipei', 'warsaw',
  'krakow', 'prague', 'bucharest', 'amsterdam', 'tel aviv', 'sydney', 'melbourne', 'toronto',
  'vancouver', 'montreal', 'zurich', 'munich', 'luxembourg', 'london',
].join('|') + ')\\b', 'i');

function passesLocation(job, prefs) {
  const wantsUS = (prefs.locations || []).join(' ').match(/united states|usa|\bu\.?s\.?\b|america/i);
  if (!wantsUS) return true;
  const loc = job.location || '';
  const iso = loc.match(/,\s*([A-Z]{3})\b/);          // Amazon-style "City, CC" / "City, Region, DEU"
  if (iso && iso[1] !== 'USA') return false;
  return !FOREIGN_RE.test(loc);
}

// Soft signal fed into the scoring prompt so Claude down-ranks (not drops) mismatches.
function prefsPromptText(prefs) {
  const loc = prefs.locations && prefs.locations.length ? prefs.locations.join(', ') : 'any';
  const modes = prefs.work_modes && prefs.work_modes.length ? prefs.work_modes.join('/') : 'any';
  const sen = prefs.seniority && prefs.seniority.length && prefs.seniority.length < SENIORITY_LEVELS.length
    ? ` The candidate ONLY wants these seniority levels: ${prefs.seniority.join('/')} — a role clearly at another level (e.g. a regular full-time position when only "intern" is wanted) must score 4 or lower.`
    : '';
  return `Candidate preferences — preferred locations: ${loc}; preferred work mode: ${modes}.${sen} ` +
    `Lower the score (do NOT zero it) for jobs that clearly don't fit these, e.g. onsite-only in a far ` +
    `location when remote is preferred. A great role that's a mild geographic mismatch should still score well.`;
}

module.exports = { loadPrefs, seniorityLevel, passesSeniority, passesLocation, prefsPromptText, DEFAULTS, SENIORITY_LEVELS, WORK_MODES };
