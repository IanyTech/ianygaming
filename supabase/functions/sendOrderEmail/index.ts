import { serve } from 'std/server'
import { SmtpClient } from 'https://deno.land/x/smtp/mod.ts'

type Order = {
  orderCode?: string
  id?: number | string
  name: string
  email: string
  address?: string
  items: Record<string, number>
  totals: { subtotal: number; shipping: number; discount?: number; total: number }
  billing?: { name?: string; address?: string; tax?: string } | null
  payMethod?: string
}

// SMTP settings (free option: Gmail with App Password or any free SMTP relay)
const SMTP_HOST = Deno.env.get('SMTP_HOST') || 'smtp.gmail.com';
const SMTP_PORT = Number(Deno.env.get('SMTP_PORT') || '587');
const SMTP_USER = Deno.env.get('SMTP_USER') || '';
const SMTP_PASS = Deno.env.get('SMTP_PASS') || '';
const SMTP_FROM = Deno.env.get('SMTP_FROM') || 'no-reply@iany.store';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

function okJSON(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });
}

function validateEmail(e: string) {
  return typeof e === 'string' && /^\S+@\S+\.\S+$/.test(e);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });
  }
  if (req.method !== 'POST') return okJSON({ ok: false, error: 'Method Not Allowed' }, 405);
  try {
    const data = await req.json();
    const order: Order = data?.order || data;
    if (!order || typeof order !== 'object') return okJSON({ ok: false, error: 'Payload mancante' }, 400);
    if (!order.name || !order.email) return okJSON({ ok: false, error: 'Nome o email mancanti' }, 400);
    if (!validateEmail(order.email)) return okJSON({ ok: false, error: 'Email non valida' }, 400);
    if (!order.items || Object.keys(order.items).length === 0) return okJSON({ ok: false, error: 'Carrello vuoto' }, 400);
    const total = Number(order.totals?.total || 0);
    if (isNaN(total) || total < 0) return okJSON({ ok: false, error: 'Totale non valido' }, 400);

    // Build email content (plain + HTML)
    const subject = `Conferma ordine ${order.orderCode || String(order.id || '')}`.trim();
    const itemsList = Object.entries(order.items || {}).map(([id, qty]) => `<li>${id} × ${qty}</li>`).join('');
    const html = `
      <div style="font-family: Inter, Arial, sans-serif; color:#111">
        <h2>Grazie per il tuo ordine ${order.name}</h2>
        <p>Codice ordine: <strong>${order.orderCode || String(order.id || '')}</strong></p>
        <p>Importo totale: <strong>€${Number(total).toFixed(2)}</strong></p>
        <h3>Dettagli</h3>
        <ul>${itemsList}</ul>
        <p style="margin-top:12px;">Riceverai aggiornamenti via email sullo stato dell'ordine.</p>
      </div>
    `;
    const text = `Grazie ${order.name}\nCodice ordine: ${order.orderCode || String(order.id || '')}\nTotale: €${Number(total).toFixed(2)}\n\nGrazie per aver acquistato con noi.`;

    // Send via SMTP using deno.land/x/smtp (free-friendly)
    if (!SMTP_USER || !SMTP_PASS) {
      console.warn('SMTP credentials non impostate; skip invio email.');
    } else {
      try {
        const client = new SmtpClient();
        await client.connect({ hostname: SMTP_HOST, port: SMTP_PORT, username: SMTP_USER, password: SMTP_PASS });
        await client.send({
          from: SMTP_FROM,
          to: order.email,
          subject,
          content: text,
          html: html,
        });
        await client.close();
      } catch (e) {
        console.error('[smtp] send failed', e);
        return okJSON({ ok: false, error: 'Invio email via SMTP fallito', detail: String(e) }, 502);
      }
    }

    // Optional: log notification in Supabase table 'order_notifications' if service role key is provided
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const note = { order_code: order.orderCode || String(order.id || ''), email: order.email, payload: order, created_at: new Date().toISOString() };
        await fetch(`${SUPABASE_URL}/rest/v1/order_notifications`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }, body: JSON.stringify(note)
        });
      } catch (e) { console.warn('[log order_notification] failed', e); }
    }

    return okJSON({ ok: true });
  } catch (e) {
    console.error(e);
    return okJSON({ ok: false, error: String(e) }, 500);
  }
});
