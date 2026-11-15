/**
 * The referral rules, kept free of the database so they have one definition and a test.
 *
 * A referral earns Recruiter points, which live apart from league points: settlement splits
 * pots by league points, so a reward counted there would move money. Recruiter points only
 * feed the badge on Profile and the Recruiters leaderboard.
 */

/** What one friend is worth once they lock a first lineup. */
export const REFERRAL_POINTS = 25;

export type RecruiterBadge = "Recruiter" | "Top Recruiter" | null;

/** Recruiter at the first friend who locked a lineup, Top Recruiter at three. */
export function badgeFor(lockedFriends: number): RecruiterBadge {
  if (lockedFriends >= 3) return "Top Recruiter";
  if (lockedFriends >= 1) return "Recruiter";
  return null;
}

export function recruiterPoints(lockedFriends: number): number {
  return lockedFriends * REFERRAL_POINTS;
}

/**
 * Whether joining through a link counts as a referral. Only a player new to Lineup (in no
 * league yet) counts, so existing players can't trade links for points; never the inviter
 * themselves; and never a player some earlier link already brought in.
 */
export function countsAsReferral(input: {
  inviterId: string;
  inviteeId: string;
  inviteeLeagues: number;
  alreadyReferred: boolean;
}): boolean {
  return input.inviterId !== input.inviteeId && input.inviteeLeagues === 0 && !input.alreadyReferred;
}

// No 0/O or 1/I/L, so a token read aloud or retyped survives.
const TOKEN_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const TOKEN_LENGTH = 7;

export function makeToken(random: () => number = Math.random): string {
  let token = "";
  for (let i = 0; i < TOKEN_LENGTH; i++) token += TOKEN_ALPHABET[Math.floor(random() * TOKEN_ALPHABET.length)];
  return token;
}

export function isToken(value: string): boolean {
  return value.length === TOKEN_LENGTH && [...value].every((char) => TOKEN_ALPHABET.includes(char));
}

/**
 * The inviter's app link, which the page at /i/<token> opens. The app sends the prefix
 * (Linking.createURL("/invite")) and the token goes on the end. The page redirects at once, so
 * only app schemes and a web build on this machine or the local network are accepted: anything
 * else would let a player turn our short link into a redirect to a site of their choosing.
 */
const APP_LINK = /^(lineup|exps?):\/\/|^https?:\/\/(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+)(:\d+)?\//;

export function appLink(prefix: string | undefined, token: string): string {
  const fallback = `lineup://invite/${token}`;
  if (prefix === undefined) return fallback;
  const trimmed = prefix.replace(/\/+$/, "");
  return APP_LINK.test(`${trimmed}/`) ? `${trimmed}/${token}` : fallback;
}

export function sanitizedAppPrefix(prefix: string | undefined): string | undefined {
  if (prefix === undefined || prefix.length > 300) return undefined;
  return APP_LINK.test(`${prefix.replace(/\/+$/, "")}/`) ? prefix : undefined;
}

export function inviteMessage(input: { inviterName: string; leagueName: string; versus: boolean; inviteCode: string; url: string }): string {
  const first = input.inviterName.split(" ")[0];
  const what = input.versus ? `${first} challenged you to a 1v1 week on Lineup.` : `${first} invited you to ${input.leagueName} on Lineup.`;
  return `${what} Tap to join: ${input.url} (or use code ${input.inviteCode})`;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

const EXPO_GO_APP_STORE = "https://apps.apple.com/app/expo-go/id982107779";

/**
 * The page behind the short link. Text apps only make https links tappable, so the link is a
 * page that hands over to the app at once and keeps the code visible in case it can't.
 */
export function invitePage(input: { inviterName: string; leagueName: string; inviteCode: string; openUrl: string } | null): string {
  if (input === null) {
    return page("Lineup", "<h1>This invite link has expired</h1><p>Ask your friend for a new one.</p>", null);
  }
  const title = `${input.inviterName} invited you to ${input.leagueName}`;
  const open = escapeHtml(input.openUrl);
  const body = `<p class="eyebrow">LINEUP</p>
<h1>${escapeHtml(title)}</h1>
<a class="button" href="${open}">Open in Lineup</a>
<p>Don't have it yet? <a href="${EXPO_GO_APP_STORE}">Get Expo Go</a>, then tap Open again.</p>
<p class="code">Or join with code <b>${escapeHtml(input.inviteCode)}</b></p>`;
  return page(title, body, input.openUrl);
}

function page(title: string, body: string, redirect: string | null): string {
  const safeTitle = escapeHtml(title);
  const script = redirect === null ? "" : `<script>location.href = ${JSON.stringify(redirect).replace(/</g, "\\u003c")};</script>`;
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${safeTitle}</title><meta property="og:title" content="${safeTitle}"><meta property="og:description" content="Draft your week, prove it, beat your friends.">
<style>body{font-family:-apple-system,system-ui,sans-serif;margin:0;padding:48px 24px;text-align:center;color:#111}
.eyebrow{color:#0B69FF;font-weight:800;letter-spacing:2px}h1{font-size:24px}
.button{display:inline-block;background:#0B69FF;color:#fff;padding:14px 28px;border-radius:999px;text-decoration:none;font-weight:700;margin:16px 0}
.code{color:#555}</style></head>
<body>${body}${script}</body></html>`;
}
