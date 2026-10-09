import { resolveBackendBaseUrl } from '@/config/mobileApi';

const RESEND_API_KEY =
  typeof __DEV__ !== 'undefined' && __DEV__
    ? (process.env.EXPO_PUBLIC_RESEND_API_KEY || '')
    : '';

const LOGO_URL = 'https://chatboxai.co.in/Chatboxai_logo_main.png';

/**
 * HTML Email Template for ChatBox AI Password Reset Code
 */
function buildResetEmailHtml(otp: string, recipientEmail: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset your Chatbox AI Password</title>
</head>
<body style="margin:0;padding:0;background-color:#0c0a09;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0c0a09;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#13110f;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);">
          <tr>
            <td style="background:linear-gradient(135deg,#1a1025 0%,#2a1a40 100%);padding:36px 40px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.06);">
              <img src="${LOGO_URL}" alt="Chatbox AI" width="130" height="auto" style="display:block;margin:0 auto 16px auto;filter:brightness(200%);" />
              <p style="margin:0;color:rgba(255,255,255,0.4);font-size:11px;text-transform:uppercase;letter-spacing:0.15em;font-weight:500;">Password Reset</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 40px 32px;">
              <h1 style="margin:0 0 12px;color:#ffffff;font-size:22px;font-weight:700;line-height:1.3;">Reset your password</h1>
              <p style="margin:0 0 28px;color:rgba(255,255,255,0.55);font-size:14px;line-height:1.7;">
                You requested to reset your password for your Chatbox AI account.
                Use the code below to complete the reset process.
                This code is valid for <strong style="color:rgba(255,255,255,0.8);">10 minutes</strong>.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td align="center">
                    <div style="display:inline-block;background:linear-gradient(135deg,rgba(90,74,122,0.2),rgba(58,44,90,0.2));border:1.5px solid rgba(90,74,122,0.5);border-radius:12px;padding:24px 40px;text-align:center;">
                      <p style="margin:0 0 6px;color:rgba(255,255,255,0.4);font-size:11px;text-transform:uppercase;letter-spacing:0.12em;font-weight:600;">Your Reset Code</p>
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
          <tr>
            <td style="background:#0c0a09;padding:20px 40px;text-align:center;border-top:1px solid rgba(255,255,255,0.04);">
              <p style="margin:0;color:rgba(255,255,255,0.2);font-size:12px;line-height:1.6;">
                © 2026 Chatbox AI by Technon Pvt Ltd. All rights reserved.
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

/**
 * Send password reset email via Resend API
 */
export async function sendPasswordResetEmailViaResend(
  recipientEmail: string,
  otp: string
): Promise<{ success: boolean; message?: string }> {
  // 1. Try secure backend route first (zero secret keys in mobile app)
  try {
    const backendUrl = `${resolveBackendBaseUrl()}/api/mobile/email/send-otp`;
    const res = await fetch(backendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipientEmail, otp, type: 'reset' }),
    });
    if (res.ok) {
      return { success: true };
    }
  } catch (err: any) {
    console.warn('[emailService] Backend email proxy unavailable:', err.message);
  }

  // 2. Development fallback only
  if (!RESEND_API_KEY) {
    return { success: false, message: 'Email service unavailable.' };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Chatbox AI <no-reply@chatboxai.co.in>',
        to: [recipientEmail],
        subject: 'Chatbox AI — Password Reset Code',
        html: buildResetEmailHtml(otp, recipientEmail),
      }),
    });

    const data = await response.json();

    if (response.ok && data?.id) {
      return { success: true };
    }

    console.warn('[Resend API Warning]', data?.message || data?.error || 'Email send failed');
    return { success: false, message: data?.message || 'Email delivery failed' };
  } catch (error: any) {
    console.error('[Resend Service Error]', error?.message || error);
    return { success: false, message: error?.message || 'Network error sending email' };
  }
}

/**
 * HTML Email Template for ChatBox AI Signup Verification Code (Matching Website)
 */
function buildSignupEmailHtml(otp: string, recipientEmail: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify your Chatbox AI account</title>
</head>
<body style="margin:0;padding:0;background-color:#0c0a09;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0c0a09;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#13110f;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);">
          <tr>
            <td style="background:linear-gradient(135deg,#1a1025 0%,#2a1a40 100%);padding:36px 40px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.06);">
              <img src="${LOGO_URL}" alt="Chatbox AI" width="130" height="auto" style="display:block;margin:0 auto 16px auto;filter:brightness(200%);" />
              <p style="margin:0;color:rgba(255,255,255,0.4);font-size:11px;text-transform:uppercase;letter-spacing:0.15em;font-weight:500;">Email Verification</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 40px 32px;">
              <h1 style="margin:0 0 12px;color:#ffffff;font-size:22px;font-weight:700;line-height:1.3;">Verify your email address</h1>
              <p style="margin:0 0 28px;color:rgba(255,255,255,0.55);font-size:14px;line-height:1.7;">
                You're almost there! Enter the 6-digit code below to complete your Chatbox AI account setup.
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
          <tr>
            <td style="background:#0c0a09;padding:20px 40px;text-align:center;border-top:1px solid rgba(255,255,255,0.04);">
              <p style="margin:0;color:rgba(255,255,255,0.2);font-size:12px;line-height:1.6;">
                © 2026 Chatbox AI by Technon Pvt Ltd. All rights reserved.
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

/**
 * Send signup verification email via Resend API
 */
export async function sendSignupVerificationEmailViaResend(
  recipientEmail: string,
  otp: string
): Promise<{ success: boolean; message?: string }> {
  // 1. Try secure backend route first (zero secret keys in mobile app)
  try {
    const backendUrl = `${resolveBackendBaseUrl()}/api/mobile/email/send-otp`;
    const res = await fetch(backendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipientEmail, otp, type: 'signup' }),
    });
    if (res.ok) {
      return { success: true };
    }
  } catch (err: any) {
    console.warn('[emailService] Backend email proxy unavailable:', err.message);
  }

  // 2. Development fallback only
  if (!RESEND_API_KEY) {
    return { success: false, message: 'Email service unavailable.' };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Chatbox AI <no-reply@chatboxai.co.in>',
        to: [recipientEmail],
        subject: 'Verify your Chatbox AI account',
        html: buildSignupEmailHtml(otp, recipientEmail),
      }),
    });

    const data = await response.json();

    if (response.ok && data?.id) {
      return { success: true };
    }

    console.warn('[Resend API Warning]', data?.message || data?.error || 'Email send failed');
    return { success: false, message: data?.message || 'Email delivery failed' };
  } catch (error: any) {
    console.error('[Resend Service Error]', error?.message || error);
    return { success: false, message: error?.message || 'Network error sending email' };
  }
}

