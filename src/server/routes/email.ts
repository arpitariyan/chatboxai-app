/**
 * src/server/routes/email.ts
 *
 * Secure server-side email dispatch via Resend:
 * - Keeps RESEND_API_KEY strictly on the server
 * - Rate limits OTP email dispatch (max 5 / 10 minutes per IP/email) to prevent abuse
 * - Formats and dispatches transactional emails
 */

import { Router, Request, Response } from 'express';
import { SlidingWindowLimiter } from '../lib/rate-limit';
import { logger } from '../lib/logger';

export const emailRouter = Router();

const emailLimiter = new SlidingWindowLimiter({
  windowMs: 10 * 60 * 1000, // 10 minutes
  maxRequests: 5,
});

const LOGO_URL = 'https://chatboxai.co.in/Chatboxai_logo_main.png';

function buildEmailHtml(otp: string, recipientEmail: string, type: 'reset' | 'signup'): string {
  const isReset = type === 'reset';
  const title = isReset ? 'Reset your password' : 'Verify your email';
  const subtitle = isReset ? 'Password Reset' : 'Sign-Up Verification';
  const desc = isReset
    ? 'You requested to reset your password for your Chatbox AI account.'
    : 'Welcome to Chatbox AI! Please verify your email address to complete registration.';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#0c0a09;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0c0a09;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#13110f;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);">
          <tr>
            <td style="background:linear-gradient(135deg,#1a1025 0%,#2a1a40 100%);padding:36px 40px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.06);">
              <img src="${LOGO_URL}" alt="Chatbox AI" width="130" height="auto" style="display:block;margin:0 auto 16px auto;filter:brightness(200%);" />
              <p style="margin:0;color:rgba(255,255,255,0.4);font-size:11px;text-transform:uppercase;letter-spacing:0.15em;font-weight:500;">${subtitle}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 40px 32px;">
              <h1 style="margin:0 0 12px;color:#ffffff;font-size:22px;font-weight:700;line-height:1.3;">${title}</h1>
              <p style="margin:0 0 28px;color:rgba(255,255,255,0.55);font-size:14px;line-height:1.7;">
                ${desc} Use the verification code below to proceed.
                This code is valid for <strong style="color:rgba(255,255,255,0.8);">10 minutes</strong>.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td align="center">
                    <div style="display:inline-block;background:linear-gradient(135deg,rgba(90,74,122,0.2),rgba(58,44,90,0.2));border:1.5px solid rgba(90,74,122,0.5);border-radius:12px;padding:24px 40px;text-align:center;">
                      <p style="margin:0 0 6px;color:rgba(255,255,255,0.4);font-size:11px;text-transform:uppercase;letter-spacing:0.12em;font-weight:600;">Your Verification Code</p>
                      <p style="margin:0;font-size:44px;font-weight:700;color:#c4b5e0;letter-spacing:0.3em;font-family:'Courier New',Courier,monospace;">${otp}</p>
                    </div>
                  </td>
                </tr>
              </table>
              <p style="margin:0;color:rgba(255,255,255,0.3);font-size:13px;line-height:1.6;">
                This code was requested for <strong style="color:rgba(255,255,255,0.5);">${recipientEmail}</strong>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

emailRouter.post('/email/send-otp', async (req: Request, res: Response) => {
  const { recipientEmail, otp, type = 'reset' } = req.body || {};

  if (!recipientEmail || typeof recipientEmail !== 'string' || !recipientEmail.includes('@')) {
    return res.status(400).json({ success: false, error: 'Valid recipientEmail is required' });
  }

  if (!otp || typeof otp !== 'string' || otp.trim().length < 4) {
    return res.status(400).json({ success: false, error: 'Valid OTP code is required' });
  }

  const cleanEmail = recipientEmail.trim().toLowerCase();
  const rateKey = `${req.ip || 'ip'}_${cleanEmail}`;
  const rateCheck = emailLimiter.check(rateKey);

  if (!rateCheck.allowed) {
    return res.status(429).json({
      success: false,
      error: `Too many email requests. Please wait ${rateCheck.retryAfter || 60} seconds before requesting another code.`,
    });
  }

  const apiKey = process.env.RESEND_API_KEY || process.env.EXPO_PUBLIC_RESEND_API_KEY;
  if (!apiKey) {
    logger.warn('[EmailRouter] RESEND_API_KEY not configured on server');
    return res.status(503).json({ success: false, error: 'Email delivery service temporarily unconfigured.' });
  }

  try {
    const subject = type === 'reset' ? 'Chatbox AI — Password Reset Code' : 'Chatbox AI — Sign-Up Verification Code';
    const html = buildEmailHtml(otp, cleanEmail, type);

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Chatbox AI <no-reply@chatboxai.co.in>',
        to: [cleanEmail],
        subject,
        html,
      }),
    });

    const data = await response.json();
    if (response.ok && data?.id) {
      logger.info('[EmailRouter] OTP email dispatched successfully', { to: cleanEmail, type });
      return res.status(200).json({ success: true, messageId: data.id });
    }

    logger.error('[EmailRouter] Resend API error response:', data);
    return res.status(response.status || 500).json({
      success: false,
      error: data?.message || 'Failed to dispatch email',
    });
  } catch (err: any) {
    logger.error('[EmailRouter] Resend network error:', { error: err.message });
    return res.status(500).json({ success: false, error: err.message || 'Email delivery failed' });
  }
});
