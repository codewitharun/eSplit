// src/utils/timeAgo.ts
// Tiny replacement for moment(x).fromNow() (moment was dropped - 300KB for
// one call). Output style matches moment: "a few seconds ago", "5 minutes
// ago", "an hour ago", "3 days ago", "2 months ago", "a year ago".
export function timeAgo(input: string | number | Date, now = Date.now()): string {
  const t = new Date(input).getTime();
  if (!Number.isFinite(t)) {
    return '';
  }
  const s = Math.round((now - t) / 1000);
  const future = s < 0;
  const a = Math.abs(s);
  const m = a / 60, h = m / 60, d = h / 24;
  let txt: string;
  if (a < 45) txt = 'a few seconds';
  else if (a < 90) txt = 'a minute';
  else if (m < 45) txt = `${Math.round(m)} minutes`;
  else if (m < 90) txt = 'an hour';
  else if (h < 22) txt = `${Math.round(h)} hours`;
  else if (h < 36) txt = 'a day';
  else if (d < 26) txt = `${Math.round(d)} days`;
  else if (d < 45) txt = 'a month';
  else if (d < 320) txt = `${Math.round(d / 30.4)} months`;
  else if (d < 548) txt = 'a year';
  else txt = `${Math.round(d / 365)} years`;
  return future ? `in ${txt}` : `${txt} ago`;
}
