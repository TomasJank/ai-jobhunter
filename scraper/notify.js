// scraper/notify.js — Telegram reporting. Zero deps (Node 18+ fetch).
// Sends one message per run listing newly-seen jobs above the score threshold.
// Quiet by design: no message when there's nothing new worth seeing.

const escHTML = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const bestScore = j => (j.resume_scores && typeof j.resume_scores[j.best_resume_id] === 'number')
  ? j.resume_scores[j.best_resume_id] : 0;

// Telegram caps one message at 4096 chars — list every job, chunked across messages.
const TG_LIMIT = 4096;

function formatMessages(jobs) {
  const sorted = [...jobs].sort((a, b) => bestScore(b) - bestScore(a));
  const header = `🎯 <b>${sorted.length} new job match${sorted.length === 1 ? '' : 'es'}</b>`;
  const blocks = sorted.map(j =>
    `<b>${bestScore(j).toFixed(1)}</b> — <a href="${escHTML(j.url)}">${escHTML(j.title)}</a>\n` +
    `        ${escHTML(j.company)}${j.location ? ' · ' + escHTML(j.location) : ''}`
  );
  const messages = [];
  let cur = header;
  for (const b of blocks) {
    if (cur.length + 2 + b.length > TG_LIMIT) { messages.push(cur); cur = b; }
    else cur += '\n\n' + b;
  }
  messages.push(cur);
  return messages;
}

async function notifyTelegram(jobs, log = () => {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) { log('no TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID — skipping Telegram'); return false; }
  if (!jobs.length) { log('nothing new above threshold — staying quiet'); return false; }

  for (const text of formatMessages(jobs)) {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.ok) throw new Error(`Telegram sendMessage failed: HTTP ${res.status} ${JSON.stringify(body).slice(0, 200)}`);
  }
  log(`Telegram: sent all ${jobs.length} new matches`);
  return true;
}

module.exports = { notifyTelegram, formatMessages, bestScore, TG_LIMIT };
