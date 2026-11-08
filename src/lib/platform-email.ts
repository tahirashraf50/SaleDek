import { sendEmailMessage, type EmailSendResult } from "@/lib/integrations/email";

export function platformEmailConfig() {
  const host = process.env.SMTP_HOST || process.env.PLATFORM_SMTP_HOST;
  const from =
    process.env.SMTP_FROM ||
    process.env.PLATFORM_FROM_EMAIL ||
    "billing@pulsecrm.com";
  const hasLive = Boolean(
    host && process.env.SMTP_USER && process.env.SMTP_PASS
  );
  return {
    smtpHost: host,
    smtpPort: Number(process.env.SMTP_PORT || 587),
    smtpUser: process.env.SMTP_USER,
    smtpPass: process.env.SMTP_PASS,
    fromEmail: from,
    // Default mock unless SMTP is configured and SMTP_MOCK is explicitly false
    mock: process.env.SMTP_MOCK === "false" && hasLive ? false : true,
  };
}

export async function sendPlatformEmail(
  to: string,
  subject: string,
  body: string
): Promise<EmailSendResult> {
  return sendEmailMessage(platformEmailConfig(), to, subject, body);
}

export const PLATFORM_NAME = process.env.NEXT_PUBLIC_PLATFORM_NAME || "PulseCRM";
