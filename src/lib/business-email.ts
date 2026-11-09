/** Common personal / free mailbox providers — not accepted for workspace signup. */
const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "yahoo.co.in",
  "ymail.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "pm.me",
  "mail.com",
  "gmx.com",
  "gmx.net",
  "zoho.com",
  "yandex.com",
  "yandex.ru",
  "qq.com",
  "163.com",
  "126.com",
  "rediffmail.com",
  "inbox.com",
  "fastmail.com",
  "tutanota.com",
  "hey.com",
]);

export function emailDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at < 1) return null;
  return email.slice(at + 1).trim().toLowerCase();
}

/**
 * Workspace signup emails must use a company / official domain
 * (not Gmail, Yahoo, Outlook, etc.).
 */
export function assertBusinessEmail(email: string): string | null {
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@") || !normalized.includes(".")) {
    return "Enter a valid work email address.";
  }
  const domain = emailDomain(normalized);
  if (!domain || !domain.includes(".")) {
    return "Enter a valid work email address.";
  }
  if (FREE_EMAIL_DOMAINS.has(domain)) {
    return "Use your official company email (Gmail, Yahoo, Outlook, etc. are not allowed).";
  }
  // Reject bare disposable-looking single-label hosts without TLD already covered
  if (/^(temp|trash|fake|test)mail\./i.test(domain)) {
    return "Use your official company email domain.";
  }
  return null;
}
