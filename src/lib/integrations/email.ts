type EmailConfig = {
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  fromEmail?: string;
  mock?: boolean;
};

export type EmailAttachment = {
  filename: string;
  content: Buffer;
  contentType?: string;
};

export type EmailSendResult = {
  ok: boolean;
  provider: "email";
  mode: "LIVE" | "MOCK" | "SKIPPED";
  externalId?: string;
  error?: string;
};

/** SMTP via nodemailer when live credentials are set; otherwise MOCK (CRM still records). */
export async function sendEmailMessage(
  config: EmailConfig | null | undefined,
  to: string,
  subject: string,
  body: string,
  attachments?: EmailAttachment[]
): Promise<EmailSendResult> {
  if (!to.includes("@")) {
    return { ok: false, provider: "email", mode: "SKIPPED", error: "Invalid email" };
  }

  const host = config?.smtpHost?.trim();
  const from = config?.fromEmail?.trim();
  const hasLive = Boolean(host && from && config?.smtpUser && config?.smtpPass);

  if (!hasLive || config?.mock !== false) {
    return {
      ok: true,
      provider: "email",
      mode: hasLive && config?.mock === false ? "LIVE" : "MOCK",
      externalId: `email-mock-${Date.now()}`,
    };
  }

  try {
    const nodemailer = await import("nodemailer").catch(() => null);
    if (!nodemailer) {
      return {
        ok: true,
        provider: "email",
        mode: "MOCK",
        externalId: `email-fallback-${Date.now()}`,
        error: "nodemailer not installed — stored in CRM only",
      };
    }
    const transporter = nodemailer.createTransport({
      host,
      port: config?.smtpPort || 587,
      secure: false,
      auth: {
        user: config!.smtpUser!,
        pass: config!.smtpPass!,
      },
    });
    const info = await transporter.sendMail({
      from,
      to,
      subject: subject || "Message from support",
      text: body,
      attachments: attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType || "application/octet-stream",
      })),
    });
    return {
      ok: true,
      provider: "email",
      mode: "LIVE",
      externalId: String(info.messageId || ""),
    };
  } catch (e) {
    return {
      ok: false,
      provider: "email",
      mode: "LIVE",
      error: e instanceof Error ? e.message : "SMTP failed",
    };
  }
}
