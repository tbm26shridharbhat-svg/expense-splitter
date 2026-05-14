/**
 * Magic-link email — sent via Resend.
 *
 * If RESEND_API_KEY is missing (typical for local dev), we log the link to
 * the server console instead. This keeps the auth flow exercisable without
 * a real email account during development.
 */
import { Resend } from "resend";

export async function sendMagicLinkEmail(to: string, link: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;

  if (!key) {
    console.warn(
      "\n[auth/email] RESEND_API_KEY not set — printing magic link to console.\n" +
        `[auth/email] Pretend you opened this email at <${to}>:\n` +
        `[auth/email] Sign in: ${link}\n`,
    );
    return;
  }

  const resend = new Resend(key);
  const from = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

  const subject = "Your Pocket sign-in link";
  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; color: #0f172a;">
  <h1 style="font-size: 20px; font-weight: 600; margin-bottom: 8px; letter-spacing: -0.01em;">Sign in to Pocket</h1>
  <p style="font-size: 15px; line-height: 1.6; color: #64748b; margin: 0 0 24px;">
    Click the button below to sign in. The link is valid for 15 minutes and works once.
  </p>
  <a href="${link}"
     style="display: inline-block; background: #ec4899; color: #ffffff; padding: 12px 24px; border-radius: 12px;
            text-decoration: none; font-weight: 500; font-size: 15px;">
    Sign in
  </a>
  <p style="font-size: 13px; line-height: 1.6; color: #94a3b8; margin: 32px 0 0;">
    Or paste this link into your browser:<br>
    <span style="word-break: break-all;">${link}</span>
  </p>
  <p style="font-size: 12px; color: #cbd5e1; margin-top: 32px;">
    If you didn't request this, you can ignore this email.
  </p>
</body>
</html>`;

  const text = `Sign in to Pocket\n\n${link}\n\nThis link is valid for 15 minutes and works once.\n`;

  await resend.emails.send({
    from,
    to,
    subject,
    html,
    text,
  });
}
