import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const ses = new SESClient({});

// The address to receive consultation requests.
const TO_ADDRESS = 'yung@dtlaw-ep.com';
// Must be a verified SES identity (a verified email, or any address on a verified domain).
const FROM_ADDRESS = 'no-reply@dtlaw-ep.com';

const MAX_LEN = { name: 200, email: 320, phone: 40, message: 5000 };

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}

export const handler = async (event) => {
  try {
    const data = JSON.parse(event.body || '{}');

    // Honeypot: real visitors never fill this in.
    if (data.company) {
      return jsonResponse(200, { ok: true });
    }

    const name = String(data.name || '').trim().slice(0, MAX_LEN.name);
    const email = String(data.email || '').trim().slice(0, MAX_LEN.email);
    const phone = String(data.phone || '').trim().slice(0, MAX_LEN.phone);
    const message = String(data.message || '').trim().slice(0, MAX_LEN.message);

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!name || !email || !message || !emailPattern.test(email)) {
      return jsonResponse(400, { ok: false, error: 'Missing or invalid fields.' });
    }

    const textBody =
      `New consultation request from the website\n\n` +
      `Name: ${name}\n` +
      `Email: ${email}\n` +
      `Phone: ${phone || '(not provided)'}\n\n` +
      `Message:\n${message}\n`;

    const htmlBody =
      `<p><strong>New consultation request from the website</strong></p>` +
      `<p><strong>Name:</strong> ${escapeHtml(name)}<br>` +
      `<strong>Email:</strong> ${escapeHtml(email)}<br>` +
      `<strong>Phone:</strong> ${escapeHtml(phone || '(not provided)')}</p>` +
      `<p><strong>Message:</strong><br>${escapeHtml(message).replace(/\n/g, '<br>')}</p>`;

    await ses.send(new SendEmailCommand({
      Source: FROM_ADDRESS,
      Destination: { ToAddresses: [TO_ADDRESS] },
      ReplyToAddresses: [email],
      Message: {
        Subject: { Data: `New consultation request from ${name}` },
        Body: {
          Text: { Data: textBody },
          Html: { Data: htmlBody }
        }
      }
    }));

    return jsonResponse(200, { ok: true });
  } catch (err) {
    console.error(err);
    return jsonResponse(500, { ok: false, error: 'Internal error.' });
  }
};
