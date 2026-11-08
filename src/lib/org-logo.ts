/** Public URL for a tenant logo (safe for client + server). */
export function orgLogoPublicUrl(orgSlug: string) {
  return `/api/org-logo/${encodeURIComponent(orgSlug)}`;
}
