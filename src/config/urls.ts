// src/config/urls.ts
// The ONE place the app's web/backend address lives. To move to a new
// domain, change WEB_BASE_URL here - every invite link, QR code, deep-link
// prefix, push-notification call and AI call reads from this file.
//
// Two things outside JS also contain the host and must be updated by hand
// in the same release (native config can't read this file):
//   1. app.config.ts - the App Links hosts in android.intentFilters
//      (android/ is generated from it by expo prebuild)
//   2. the new domain must serve /.well-known/assetlinks.json (esplit-backend
//      already serves it) so Android verifies the App Links.
// Keep the OLD domain working (redirect) for a while: invite links and QR
// codes already shared by users point at it.

// No trailing slash.
export const WEB_BASE_URL = 'https://ezysplit.techtiten.com';

// esplit-backend (push notifications, AI assistant, deep-link pages) is
// served from the same host today. Split this out if that ever changes.
export const API_BASE_URL = WEB_BASE_URL;

// Old domain (until 5 Nov 2026). Invite links / QR codes shared before 2.5.0
// point here, so the app still opens them. Remove once it has expired.
export const LEGACY_WEB_BASE_URL = 'https://ezysplit.arun.codes';

// Deep links the app opens (React Navigation `linking.prefixes`).
export const DEEP_LINK_PREFIXES = ['ezysplit://', `${WEB_BASE_URL}/app/`, `${LEGACY_WEB_BASE_URL}/app/`];

// Link that opens a group's join flow (invite messages, QR codes).
export function groupInviteUrl(groupId: string): string {
  return `${WEB_BASE_URL}/app/Group-Check/${groupId}`;
}

// Public pages on esplit-backend, opened in the browser from Profile.
// Also the URLs entered in Play Console (privacy policy, data deletion).
export const PRIVACY_POLICY_URL = `${WEB_BASE_URL}/privacy`;
export const DELETE_ACCOUNT_URL = `${WEB_BASE_URL}/delete-account`;
export const SUPPORT_URL = `${WEB_BASE_URL}/support`;
