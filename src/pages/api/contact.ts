import type { APIRoute } from 'astro';
import { saveContactMessage, logAudit } from '../../lib/db.ts';
import { checkRateLimit } from '../../lib/auth.ts';

export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    const ip = clientAddress || request.headers.get('x-forwarded-for') || '127.0.0.1';

    // 1. Rate limiting: 5 contact submissions per 10 minutes
    const rateCheck = checkRateLimit(`contact:${ip}`, 5, 10 * 60 * 1000);
    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({
          error: `Too many inquiries submitted from this connection. Please try again in ${rateCheck.resetInSec} seconds.`,
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json();
    const { name, email, organization, inquiry_type, message, website_hp } = body;

    // 2. Honeypot check for bots
    if (website_hp) {
      // Return 200 silently to confuse bot
      return new Response(
        JSON.stringify({ success: true, message: 'Inquiry received.' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. Validation
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return new Response(
        JSON.stringify({ error: 'Please provide a valid contact name.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || typeof email !== 'string' || !emailRegex.test(email.trim())) {
      return new Response(
        JSON.stringify({ error: 'Please provide a valid email address for our response.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!message || typeof message !== 'string' || message.trim().length < 10) {
      return new Response(
        JSON.stringify({ error: 'Please include an inquiry description of at least 10 characters.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 4. Save to persistent database
    const saved = saveContactMessage({
      name: name.trim().slice(0, 100),
      email: email.trim().toLowerCase().slice(0, 120),
      organization: (organization || '').trim().slice(0, 120),
      inquiry_type: (inquiry_type || 'general').trim().slice(0, 50),
      message: message.trim().slice(0, 4000),
      ip_address: ip,
    });

    logAudit({
      action: 'contact_submitted',
      entity_type: 'contact_message',
      entity_id: saved.id,
      details: { email: saved.email, inquiry_type: saved.inquiry_type },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Your inquiry has been received by the 0served research desk.',
        id: saved.id,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Contact API error:', err);
    return new Response(
      JSON.stringify({ error: 'A server error occurred while transmitting your inquiry. Please try again.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
