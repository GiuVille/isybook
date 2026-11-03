// Avviso alla redazione quando arriva qualcosa di nuovo in "Da approvare": un messaggio Telegram tramite bot.
// Gratis e immediato: il drop si approva in pochi minuti invece che al mattino.
// Secret facoltativi TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID (gruppo o chat della redazione): senza, non fa nulla.
// Mai dati personali nei messaggi, solo titoli pubblici e il link al pannello.

const token = process.env.TELEGRAM_BOT_TOKEN;
const chat = process.env.TELEGRAM_CHAT_ID;
const site = process.env.PUBLIC_SITE_URL || 'https://isybooks.it';

export async function notifyEditors(title: string, items: string[] = []): Promise<void> {
  if (!token || !chat) return;
  const list = items.filter(Boolean).slice(0, 8);
  const more = items.length > list.length ? `\n…e altre ${items.length - list.length}` : '';
  const text = `${title}\n${list.map((t) => `• ${t}`).join('\n')}${more}\n\n${new URL('/admin/#/review', site)}`;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }),
    });
    if (!res.ok) console.warn(`Avviso Telegram non inviato (${res.status}).`);
  } catch (err) {
    // l'avviso è un di più: se Telegram non risponde la lettura delle fonti è comunque andata a buon fine
    console.warn(`Avviso Telegram non inviato: ${(err as Error).message}`);
  }
}
