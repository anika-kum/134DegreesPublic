// SMS alert service using Twilio. Gracefully degrades when credentials are absent —
// alerts are logged to console instead of sent, so the app works fully without
// a Twilio account during development or demos.

import twilio from 'twilio';
import db from '../db/index.js';

// Lazily initialized so the server starts even without Twilio credentials
let twilioClient = null;

// Returns a Twilio client if credentials are configured, otherwise null
function getClient() {
  if (!twilioClient && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return twilioClient;
}

// Sends a one-time confirmation when a user registers or adds their phone number.
// Fires and forgets — a failed confirmation should never block the API response.
export async function sendConfirmationText(phone, name) {
  if (!phone) return;

  const client = getClient();
  if (!client) {
    console.log(`[twilio] Confirmation SMS to ${phone} for ${name} (not sent — no credentials)`);
    return;
  }

  await client.messages.create({
    body: `Hi ${name}! You're signed up for 134 Degrees alerts. We'll text you when projects you follow open for applications.`,
    from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`,
    to: `whatsapp:${phone}`,
  });
}

// Sends an SMS to a user about a specific project update.
// Silently skips if the user has no phone number or has SMS alerts disabled.
// Records the alert in the DB so the same message is never sent twice.
export async function sendProjectAlert(userId, projectId, message) {
  const user = db.prepare('SELECT phone, sms_alerts, name FROM users WHERE id = ?').get(userId);
  if (!user?.phone || !user.sms_alerts) return;

  const client = getClient();
  if (!client) {
    // No-op in development — logs so developers can verify the trigger fired
    console.log(`[twilio] SMS to ${user.phone}: ${message} (not sent — no credentials)`);
    return;
  }

  await client.messages.create({
    body: `134 Degrees: ${message}`,
    from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`,
    to: `whatsapp:${user.phone}`,
  });

  // Log the sent alert so checkAndNotifySubscribers won't fire it again
  db.prepare('INSERT INTO alerts (user_id, project_id, message) VALUES (?, ?, ?)').run(userId, projectId, message);
}

// Runs hourly via cron. Finds subscribed projects with a Planning Commission hearing
// within the next 7 days and sends one SMS per user per project (the NOT EXISTS guard
// prevents duplicate alerts across cron runs).
export async function checkAndNotifySubscribers() {
  const subscriptions = db.prepare(`
    SELECT s.user_id, s.project_id, p.title, p.hearing_date
    FROM subscriptions s
    JOIN projects p ON p.id = s.project_id
    WHERE p.hearing_date IS NOT NULL
      AND date(p.hearing_date) >= date('now')
      AND date(p.hearing_date) <= date('now', '+7 days')
      AND NOT EXISTS (
        SELECT 1 FROM alerts a
        WHERE a.user_id = s.user_id AND a.project_id = s.project_id
      )
  `).all();

  for (const sub of subscriptions) {
    const msg = `"${sub.title}" has a Planning Commission hearing on ${sub.hearing_date}. Make your voice heard — open 134 Degrees to take action.`;
    await sendProjectAlert(sub.user_id, sub.project_id, msg).catch(console.error);
  }
}
