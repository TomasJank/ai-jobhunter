// scraper/notify.js — Telegram reporting. Zero deps (Node 18+ fetch).
// Sends one message per run listing newly-seen jobs above the score threshold.
// Quiet by design: no message when there's nothing new worth seeing.

const escHTML = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const bestScore = j => (j.resume_scores && typeof j.resume_scores[j.best_resume_id] === 'number')
  ? j.resume_scores[j.best_resume_id] : 0;

const MAX_LISTED = 10;

function formatMessage(jobs) {
  const sorted = [...jobs].sort((a, b) => bestScore(b) - bestScore(a));
  const lines = sorted.slice(0, MAX_LISTED).map(j =>
    `<b>${bestScore(j).toFixed(1)}</b> — <a href="${escHTML(j.url)}">${escHTML(j.title)}</a>\n` +
    `        ${escHTML(j.company)}${j.location ? ' · ' + escHTML(j.location) : ''}`
  );
  const more = sorted.length > MAX_LISTED ? `\n\n…and ${sorted.length - MAX_LISTED} more in the dashboard.` : '';
  return `🎯 <b>${sorted.length} new job match${sorted.length === 1 ? '' : 'es'}</b>\n\n${lines.join('\n\n')}${more}`;
}

async function notifyTelegram(jobs, log = () => {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) { log('no TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID — skipping Telegram'); return false; }
  if (!jobs.length) { log('nothing new above threshold — staying quiet'); return false; }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: formatMessage(jobs),
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.ok) throw new Error(`Telegram sendMessage failed: HTTP ${res.status} ${JSON.stringify(body).slice(0, 200)}`);
  log(`Telegram: sent ${Math.min(jobs.length, MAX_LISTED)} of ${jobs.length} new matches`);
  return true;
}

module.exports = { notifyTelegram, formatMessage, bestScore, MAX_LISTED };
