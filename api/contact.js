// /api/contact.js
// Handles submissions from the "Let's build something great" project-inquiry form.
// Runs server-side on Vercel (Node.js serverless function) -- the Resend API key
// never reaches the browser; it is read from the RESEND_API_KEY environment
// variable, which must be set in the Vercel project settings.

const TO_EMAIL = 'rahulhttpos@gmail.com';
const FROM_EMAIL = 'Rahul Pandey Website <onboarding@resend.dev>';

const ALLOWED_PROJECT_TYPES = [
  'Business Website',
  'Landing Page',
  'Portfolio Website',
  'E-commerce Website',
  'AI-Powered Website',
  'Website Redesign',
  'Other',
];

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

  const { name, email, projectType, budget, message, website, formStartedAt } = body;

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
  const safeName = typeof name === 'string' ? name.trim() : '';
  const safeEmailRaw = typeof email === 'string' ? email.trim() : '';
  const safeProjectType = typeof projectType === 'string' ? projectType.trim() : '';
  const safeBudget = typeof budget === 'string' ? budget.trim() : '';
  const safeMessage = typeof message === 'string' ? message.trim() : '';

  if (!safeName) errors.push('Name is required.');
  if (safeName.length > 200) errors.push('Name is too long.');
  if (!safeEmailRaw || !isValidEmail(safeEmailRaw)) errors.push('A valid email is required.');
  if (!safeProjectType || !ALLOWED_PROJECT_TYPES.includes(safeProjectType)) errors.push('Please select a valid project type.');
  if (!safeMessage) errors.push('Project details are required.');
  if (safeMessage.length > 5000) errors.push('Message is too long (5000 character limit).');

  if (errors.length) {
    return res.status(400).json({ ok: false, error: errors.join(' ') });
  }

  if (!process.env.RESEND_API_KEY) {
    console.error('[contact] RESEND_API_KEY is not configured.');
    return res.status(500).json({
      ok: false,
      error: "Email delivery isn't configured yet. Please reach out on WhatsApp instead.",
    });
  }

  const htmlBody = `
    <div style="font-family:sans-serif;line-height:1.6;">
      <h2 style="margin:0 0 16px;">New project inquiry</h2>
      <p><strong>Name:</strong> ${escapeHtml(safeName)}</p>
      <p><strong>Email:</strong> ${escapeHtml(safeEmailRaw)}</p>
      <p><strong>Project type:</strong> ${escapeHtml(safeProjectType)}</p>
      <p><strong>Budget:</strong> ${escapeHtml(safeBudget || 'Not specified')}</p>
      <p><strong>Message:</strong></p>
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
        reply_to: safeEmailRaw,
        subject: `New project inquiry from ${safeName} -- ${safeProjectType}`,
        html: htmlBody,
      }),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      console.error('[contact] Resend API error:', resendRes.status, errText);
      return res.status(502).json({
        ok: false,
        error: "Couldn't send your message right now. Please try WhatsApp instead.",
      });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[contact] Unexpected error:', err);
    return res.status(500).json({
      ok: false,
      error: 'Something went wrong. Please try again or reach out on WhatsApp.',
    });
  }
};
