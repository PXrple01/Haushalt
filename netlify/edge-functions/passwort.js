// Passwortschutz für die ganze Seite. Das Passwort steht NICHT im Code,
// sondern in Netlify unter "Environment variables" als SITE_PASSWORD.
// Ist keins gesetzt, ist die Seite offen.

const COOKIE = 'hb_zugang';

async function sha(text) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('hb:' + text));
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
}

const page = (fehler = '') => `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes"><title>Haushaltsbuch</title>
<style>:root{color-scheme:light dark}body{margin:0;min-height:100vh;display:grid;place-items:center;font:17px -apple-system,system-ui,sans-serif;background:#f3f4f8;color:#0f172a}
@media(prefers-color-scheme:dark){body{background:#0b0d12;color:#f1f5f9}input{background:#161a22!important;color:#f1f5f9}}
form{width:min(340px,90vw);text-align:center}.e{font-size:56px}input,button{width:100%;min-height:54px;border-radius:16px;border:0;font-size:18px;margin-top:12px;box-sizing:border-box;padding:0 16px}
input{background:#fff}button{background:#2563eb;color:#fff;font-weight:700}.f{color:#e11d48;margin-top:10px}</style></head>
<body><form method="post" action="/__login"><div class="e">🔒</div><h2>Haushaltsbuch</h2>
<input type="password" name="pw" placeholder="Passwort" autofocus autocomplete="current-password">
<button>Öffnen</button>${fehler ? `<div class="f">${fehler}</div>` : ''}</form></body></html>`;

export default async (req, context) => {
  const pw = Netlify.env.get('SITE_PASSWORD');
  if (!pw) return context.next();
  const token = await sha(pw);
  const url = new URL(req.url);

  if (url.pathname === '/__login' && req.method === 'POST') {
    const form = await req.formData();
    if (form.get('pw') === pw) {
      return new Response(null, { status: 303, headers: {
        Location: '/',
        'Set-Cookie': `${COOKIE}=${token}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax`,
      } });
    }
    await new Promise(r => setTimeout(r, 800)); // bremst Raten
    return new Response(page('Falsches Passwort'), { status: 401, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  const cookie = req.headers.get('cookie') || '';
  if (cookie.split(/;\s*/).includes(`${COOKIE}=${token}`)) return context.next();
  return new Response(page(), { status: 401, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
};

export const config = { path: '/*' };
