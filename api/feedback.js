// /api/feedback.js
// Handles submissions from the "Share your feedback" form.
// Runs server-side on Vercel (Node.js serverless function) -- the Resend API key
// never reaches the browser; it is read from the RESEND_API_KEY environment
// variable, which must be set in the Vercel project settings.

const TO_EMAIL = 'jipandey668@gmail.com';
const FROM_EMAIL = 'Rahul Pandey Website <onboarding@resend.dev>';

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const { fbName, fbEmail, rating, fbMessage, website, formStartedAt } = body;

  if (website) {
    return res.status(200).json({ ok: true });
  }

  if (formStartedAt) {
    const elapsed = Date.now() - Number(formStartedAt);
    if (Number.isFinite(elapsed) && elapsed >= 0 && elapsed < 2000) {
      return res.status(200).json({ ok: true });
    }
  }

  const errors = [];
  const safeName = typeof fbName === 'string' && fbName.trim() ? fbName.trim() : 'Anonymous';
  const safeEmailRaw = typeof fbEmail === 'string' ? fbEmail.trim() : '';
  const safeMessage = typeof fbMessage === 'string' ? fbMessage.trim() : '';
  const safeRating = typeof rating === 'string' || typeof rating === 'number' ? String(rating).trim() : '';

  if (safeName.length > 200) errors.push('Name is too long.');
  if (safeEmailRaw && !isValidEmail(safeEmailRaw)) errors.push("That email address doesn't look valid.");
  if (!safeMessage) errors.push('Feedback message is required.');
  if (safeMessage.length > 5000) errors.push('Message is too long (5000 character limit).');
  if (safeRating && !['1', '2', '3', '4', '5'].includes(safeRating)) errors.push('Invalid rating.');

  if (errors.length) {
    return res.status(400).json({ ok: false, error: errors.join(' ') });
  }

  if (!process.env.RESEND_API_KEY) {
    console.error('[feedback] RESEND_API_KEY is not configured.');
    return res.status(500).json({
      ok: false,
      error: "Email delivery isn't configured yet. Please try again later.",
    });
  }

  const htmlBody = `
    <div style="font-family:sans-serif;line-height:1.6;">
      <h2 style="margin:0 0 16px;">New website feedback</h2>
      <p><strong>Name:</strong> ${escapeHtml(safeName)}</p>
      ${safeEmailRaw ? `<p><strong>Email:</strong> ${escapeHtml(safeEmailRaw)}</p>` : ''}
      <p><strong>Rating:</strong> ${safeRating ? `${escapeHtml(safeRating)} / 5` : 'Not rated'}</p>
      <p><strong>Feedback:</strong></p>
      <p style="white-space:pre-wrap;">${escapeHtml(safeMessage)}</p>
    </div>
  `;

  try {
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [TO_EMAIL],
        reply_to: safeEmailRaw || undefined,
        subject: `Website feedback from ${safeName}`,
        html: htmlBody,
      }),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      console.error('[feedback] Resend API error:', resendRes.status, errText);
      return res.status(502).json({
        ok: false,
        error: "Couldn't send your feedback right now. Please try again shortly.",
      });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[feedback] Unexpected error:', err);
    return res.status(500).json({
      ok: false,
      error: 'Something went wrong. Please try again shortly.',
    });
  }
};
