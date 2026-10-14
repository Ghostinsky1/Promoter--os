/**
 * The "Before You Send the Deposit" email copy and timing. Pure: no network, no database,
 * so it can be rendered for review without sending anything.
 */

export const SITE = 'https://promoteros.com';
export const H = 3_600_000;
// deno-lint-ignore no-explicit-any
export type Any = any;
export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

export interface Episode { episode: string; title: string; starts_at: string; minutes: number; deal_ends_at: string | null; deal_label: string | null }
export interface Lead { id: string; email: string; first_name: string | null; registered_at: string }

// ── links ──
const utm = (ep: string, step: string) => `utm_source=live&utm_medium=email&utm_campaign=bysd_${ep}&utm_content=${step}`;
const JOIN = (ep: string, s: string) => `${SITE}/live/join/?${utm(ep, s)}`;
const REPLAY = (ep: string, s: string) => `${SITE}/live/replay/?${utm(ep, s)}`;
const DEAL = (ep: string, s: string, email: string) => `${SITE}/live/deal/?e=${encodeURIComponent(email)}&${utm(ep, s)}`;
const TRIAL = (ep: string, s: string, email: string) => `${SITE}/signup?email=${encodeURIComponent(email)}&${utm(ep, s)}`;
function gcal(e: Episode) {
  const start = new Date(e.starts_at), end = new Date(start.getTime() + e.minutes * 60_000);
  const f = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const q = new URLSearchParams({
    action: 'TEMPLATE', text: `Before You Send the Deposit — EP. ${e.episode.replace(/\D/g, '')}: ${e.title}`,
    dates: `${f(start)}/${f(end)}`, details: `Free live for working promoters. Join here: ${SITE}/live/join/`, location: `${SITE}/live/join/`,
  });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

// ── dates in Central ──
const day = (iso: string) => new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/Chicago' }).format(new Date(iso));
const dayShort = (iso: string) => new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/Chicago' }).format(new Date(iso));
const time = (iso: string) => new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' }).format(new Date(iso));
const weekday = (iso: string) => new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'America/Chicago' }).format(new Date(iso));

/** Same dark shell as the playbook emails. */
function shell(o: { kicker: string; title: string; body: string; cta?: { text: string; href: string }; cta2?: { text: string; href: string }; ps?: string }) {
  const btn = (c: { text: string; href: string }, ghost = false) => `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:${ghost ? '10px' : '24px'} 0 4px 0;"><tr>
    <td style="${ghost ? 'border:2px solid #2A3040;' : 'background:#8FD3FF;'}border-radius:12px;">
      <a href="${c.href}" style="display:inline-block;padding:15px 28px;color:${ghost ? '#FFFFFF' : '#04214D'};font-size:16px;font-weight:bold;text-decoration:none;text-transform:uppercase;letter-spacing:.5px;">${esc(c.text)}</a>
    </td></tr></table>`;
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#0B0D12;font-family:Arial,Helvetica,sans-serif;color:#E7EDF7;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0B0D12;padding:24px 0;">
<tr><td align="center">
  <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#14171E;border-radius:16px;overflow:hidden;border:1px solid #2A3040;">
    <tr><td style="background:#1140F0;padding:26px 30px;">
      <img src="${SITE}/promoter-os-lockup.png" width="160" alt="PROMOTER OS" style="display:block;width:160px;height:auto;border:0;margin-bottom:16px;">
      <div style="font-size:11px;letter-spacing:3px;color:#CFE4FF;text-transform:uppercase;">${esc(o.kicker)}</div>
      <div style="font-size:26px;font-weight:900;color:#FFFFFF;line-height:1.12;margin-top:6px;text-transform:uppercase;">${esc(o.title)}</div>
    </td></tr>
    <tr><td style="height:4px;background:#8FD3FF;"></td></tr>
    <tr><td style="padding:30px;font-size:16px;line-height:1.6;color:#D7E0EE;">
      ${o.body}
      ${o.cta ? btn(o.cta) : ''}
      ${o.cta2 ? btn(o.cta2, true) : ''}
      <p style="margin:26px 0 0 0;color:#93A2B8;font-size:14px;">— Jose<br>Promoter OS</p>
      ${o.ps ? `<p style="margin:18px 0 0 0;color:#93A2B8;font-size:14px;">${o.ps}</p>` : ''}
    </td></tr>
    <tr><td style="padding:18px 30px;background:#0B0D12;border-top:1px solid #2A3040;font-size:11px;color:#6C7A90;line-height:1.7;">
      You're getting this because you registered for Before You Send the Deposit at promoteros.com/live.<br>
      <a href="${SITE}" style="color:#8FD3FF;text-decoration:none;">PROMOTEROS.COM</a> &nbsp;·&nbsp; <%asm_global_unsubscribe_raw_url%>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

const P = (s: string) => `<p style="margin:0 0 14px;">${s}</p>`;
const B = (s: string) => `<b style="color:#fff;">${s}</b>`;
const box = (label: string, inner: string, color = '#8FD3FF') => `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0B0D12;border-left:5px solid ${color};border-radius:0 12px 12px 0;margin:0 0 14px;">
  <tr><td style="padding:16px 20px;"><div style="font-size:11px;letter-spacing:2px;color:${color};text-transform:uppercase;margin-bottom:6px;">${label}</div>${inner}</td></tr></table>`;
const hi = (n: string) => (n ? `Hey ${esc(n)},` : 'Hey,');
/** Plain-text twin: strip tags. Good enough for the text/plain part. */
export const plain = (html: string) => html.replace(/<br\s*\/?>/g, '\n').replace(/<\/(p|div|tr|li)>/g, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&divide;/g, '÷').replace(/\n{3,}/g, '\n\n').trim();

export interface Step {
  key: string;
  /** When it becomes due. */
  at: (e: Episode, l: Lead) => number;
  /** Last moment it is still worth sending. */
  until: (e: Episode, l: Lead) => number;
  /** Extra condition (registered early enough, etc.). */
  when?: (e: Episode, l: Lead) => boolean;
  /** Deal emails: skip people who already pay. */
  deal?: boolean;
  subject: (e: Episode) => string;
  render: (e: Episode, name: string, email: string) => { html: string; links: string[] };
}

export const T = (e: Episode) => new Date(e.starts_at).getTime();
export const R = (l: Lead) => new Date(l.registered_at).getTime();
export const END = (e: Episode) => new Date(e.deal_ends_at ?? e.starts_at).getTime();
const EXAMPLE = { artist: 10000, venue: 5000, ticket: 35 };
const breakEven = Math.ceil((EXAMPLE.artist + EXAMPLE.venue) / EXAMPLE.ticket); // 429

export const STEPS: Step[] = [
  // ───────── confirmation ─────────
  {
    key: 'confirm',
    at: (_e, l) => R(l), until: (e) => T(e) + e.minutes * 60_000,
    subject: (e) => `You're in — ${dayShort(e.starts_at)}, ${time(e.starts_at)} CT`,
    render: (e, n, email) => {
      const html = shell({
        kicker: `EP. ${e.episode.replace(/\D/g, '')} · Seat saved`,
        title: `You're in.`,
        body: P(hi(n)) +
          P(`Your seat is saved for ${B(`Before You Send the Deposit — ${esc(e.title)}`)}`) +
          box('When', `<div style="color:#fff;font-size:17px;font-weight:bold;">${day(e.starts_at)} · ${time(e.starts_at)} Central</div><div style="color:#93A2B8;margin-top:4px;">One hour, live on Zoom. Free.</div>`) +
          box('Your link', `<div style="color:#fff;font-size:17px;font-weight:bold;"><a href="${JOIN(e.episode, 'confirm')}" style="color:#8FD3FF;">promoteros.com/live/join</a></div><div style="color:#93A2B8;margin-top:4px;">Same link all the way. It opens the room when we go live.</div>`) +
          P(`${B('Your homework — two minutes.')} Hit reply and send me three numbers from the deal you're looking at right now: the artist's price, the venue's price, your ticket price. I'll pick some and run them live in the Q&amp;A.`),
        cta: { text: 'Add it to my calendar', href: gcal(e) },
        ps: `P.S. Want to show up with your show already in? Promoter OS is free for 7 days — put the deal in before ${weekday(e.starts_at)} and you'll follow along on your own numbers. <a href="${TRIAL(e.episode, 'confirm', email)}" style="color:#8FD3FF;">Start free</a>.`,
      });
      return { html, links: [] };
    },
  },
  // ───────── indoctrination ─────────
  {
    key: 'story1',
    at: (_e, l) => R(l) + 22 * H, until: (_e, l) => R(l) + 34 * H,
    when: (e, l) => R(l) + 22 * H <= T(e) - 36 * H,
    subject: () => 'Sold out. Still lost money.',
    render: (e, n, email) => ({
      links: [],
      html: shell({
        kicker: 'Before you send the deposit · 1 of 3',
        title: 'The packed room that paid nothing',
        body: P(hi(n)) +
          P(`The worst night in this business isn't the empty one. It's the packed room — and at 2 a.m. you count it and the money isn't there.`) +
          P(`That night was almost never decided that night. It was decided weeks earlier, in the offer: a flat fee priced for the best possible night, a venue sheet with costs on page 3 nobody read, a ticket ladder that looked fine until the cheap tier was the only one that sold.`) +
          P(`Here's the show we're running live on ${weekday(e.starts_at)}:`) +
          box('EP. 01 show', `<div style="color:#fff;font-size:17px;font-weight:bold;">Artist $10,000 · Venue $5,000 · Tickets $35</div>`) +
          P(`Do the first piece of math with me: $15,000 &divide; $35 = ${B(`${breakEven} tickets`)}. That's how many you sell before you've paid for one security guard, one speaker, one ad. Most promoters never run that number before the deposit goes out.`) +
          P(`${weekday(e.starts_at)} we run the rest of it, on screen.`),
        cta: { text: `Save ${weekday(e.starts_at)} on my calendar`, href: gcal(e) },
        ps: `P.S. Tomorrow: what the soft night really costs — with a real deal we priced this month. <a href="${TRIAL(e.episode, 'story1', email)}" style="color:#8FD3FF;">Or run your own show now, free for 7 days.</a>`,
      }),
    }),
  },
  {
    key: 'story2',
    at: (_e, l) => R(l) + 46 * H, until: (_e, l) => R(l) + 58 * H,
    when: (e, l) => R(l) + 46 * H <= T(e) - 36 * H,
    subject: () => 'What half a house really costs',
    render: (e, n, email) => ({
      links: [],
      html: shell({
        kicker: 'Before you send the deposit · 2 of 3',
        title: 'Everyone prices the sellout',
        body: P(hi(n)) +
          P(`Everyone plans the sellout. Almost nobody prices the soft night — and the soft night is the one that puts promoters out of business.`) +
          P(`A real one: a ${B('$25,000 flat offer')} we were pricing this month. Sold out, it made money. At half a house it ${B('lost $1,738')}.`) +
          P(`Same artist, same room, same tickets — restructured as a smaller guarantee plus a percentage. At half a house, that version ${B('came out in the green')}, and the artist still did better on a big night.`) +
          box('The only thing that changed', `<div style="color:#fff;font-size:17px;font-weight:bold;">The offer.</div><div style="color:#93A2B8;margin-top:4px;">Not the lineup. Not the ads. Not the room.</div>`, '#F2B640') +
          P(`That's ${weekday(e.starts_at)}. No mindset slides — the math, live, before the money moves.`),
        cta: { text: 'Run my own show free', href: TRIAL(e.episode, 'story2', email) },
        ps: `P.S. Your link for ${weekday(e.starts_at)}: <a href="${JOIN(e.episode, 'story2')}" style="color:#8FD3FF;">promoteros.com/live/join</a>`,
      }),
    }),
  },
  {
    key: 'story3',
    at: (_e, l) => R(l) + 70 * H, until: (_e, l) => R(l) + 82 * H,
    when: (e, l) => R(l) + 70 * H <= T(e) - 36 * H,
    subject: () => 'Bring me your deal',
    render: (e, n, email) => ({
      links: [],
      html: shell({
        kicker: 'Before you send the deposit · 3 of 3',
        title: 'The last 15 minutes are yours',
        body: P(hi(n)) +
          P(`The last fifteen minutes on ${weekday(e.starts_at)} are for your shows. Hit reply with:`) +
          `<ul style="margin:0 0 14px;padding-left:20px;color:#D7E0EE;">
            <li style="margin-bottom:6px;">the artist's price</li>
            <li style="margin-bottom:6px;">the venue's price — and what it includes</li>
            <li style="margin-bottom:6px;">your ticket price(s)</li>
            <li style="margin-bottom:6px;">the room's capacity</li>
          </ul>` +
          P(`I'll run as many as we have time for, live: the ticket you break even on, what a half-full night costs you, and what you'd walk away with.`) +
          P(`Or run it yourself before then. Promoter OS is the exact screen we'll be on, and it's free for 7 days.`),
        cta: { text: 'Put my show in — free', href: TRIAL(e.episode, 'story3', email) },
        ps: `P.S. ${day(e.starts_at)}, ${time(e.starts_at)} CT. <a href="${JOIN(e.episode, 'story3')}" style="color:#8FD3FF;">Your link.</a>`,
      }),
    }),
  },
  // ───────── show-up ─────────
  {
    key: 'remind24',
    at: (e) => T(e) - 24 * H, until: (e) => T(e) - 12 * H,
    when: (e, l) => R(l) < T(e) - 26 * H,
    subject: (e) => `Tomorrow, ${time(e.starts_at)} Central`,
    render: (e, n) => ({
      links: [],
      html: shell({
        kicker: `EP. ${e.episode.replace(/\D/g, '')} · Tomorrow`,
        title: 'Tomorrow. One hour.',
        body: P(hi(n)) +
          P(`Tomorrow at ${B(`${time(e.starts_at)} Central`)} we run one real show from the offer to the settlement — before the deposit goes out.`) +
          box('Bring', `<div style="color:#fff;font-weight:bold;">The artist's price, the venue's price, your ticket price.</div><div style="color:#93A2B8;margin-top:4px;">That's enough to know whether to send the deposit.</div>`),
        cta: { text: 'My link for tomorrow', href: JOIN(e.episode, 'remind24') },
        cta2: { text: 'Add to calendar', href: gcal(e) },
      }),
    }),
  },
  {
    key: 'morning',
    at: (e) => T(e) - 9 * H, until: (e) => T(e) - 2 * H,
    when: (e, l) => R(l) < T(e) - 11 * H,
    subject: (e) => `Tonight, ${time(e.starts_at)} CT — your link`,
    render: (e, n) => ({
      links: [],
      html: shell({
        kicker: `EP. ${e.episode.replace(/\D/g, '')} · Tonight`,
        title: 'Tonight.',
        body: P(hi(n)) +
          P(`Tonight at ${B(`${time(e.starts_at)} Central`)}: ${esc(e.title)}`) +
          P(`Artist $10,000. Venue $5,000. Tickets $35. Does it clear at half a house? We run it live — then we run yours.`),
        cta: { text: 'My link for tonight', href: JOIN(e.episode, 'morning') },
      }),
    }),
  },
  {
    key: 'hour',
    at: (e) => T(e) - 1 * H, until: (e) => T(e) - 10 * 60_000,
    when: (e, l) => R(l) < T(e) - 75 * 60_000,
    subject: () => 'One hour',
    render: (e, n) => ({
      links: [],
      html: shell({
        kicker: `EP. ${e.episode.replace(/\D/g, '')} · 1 hour`,
        title: 'We start in one hour',
        body: P(hi(n)) + P(`${time(e.starts_at)} Central. Have your deal's three numbers handy.`),
        cta: { text: 'Join here', href: JOIN(e.episode, 'hour') },
      }),
    }),
  },
  {
    key: 'live',
    at: (e) => T(e) - 2 * 60_000, until: (e) => T(e) + 25 * 60_000,
    when: (e, l) => R(l) < T(e) - 15 * 60_000,
    subject: () => "We're live — come in",
    render: (e, n) => ({
      links: [],
      html: shell({
        kicker: 'Live now',
        title: "We're live.",
        body: P(hi(n)) + P(`We're starting. Come in.`),
        cta: { text: 'Join now', href: JOIN(e.episode, 'live') },
      }),
    }),
  },
  // ───────── replay + the deal ─────────
  {
    key: 'replay',
    at: (e) => T(e) + 15 * H, until: (e) => T(e) + 30 * H,
    when: (e, l) => R(l) < T(e) + e.minutes * 60_000,
    subject: () => 'Replay is up (and something for you)',
    render: (e, n, email) => ({
      links: [],
      html: shell({
        kicker: `EP. ${e.episode.replace(/\D/g, '')} · Replay`,
        title: 'The replay is up',
        body: P(hi(n)) +
          P(`Whether you made it last night or not — the replay is up until ${B(`${weekday(e.deal_ends_at!)} at ${time(e.deal_ends_at!)} CT`)}.`) +
          P(`One show, every number, in order: the offer, the deposit, what the venue really costs, the ticket ladder, break-even, the bad night, the settlement, and what you walked away with.`) +
          box('For everyone who registered', `<div style="color:#fff;font-size:17px;font-weight:bold;">${esc(e.deal_label ?? '')}</div><div style="color:#93A2B8;margin-top:6px;">Promoter OS Pro: unlimited shows, drop a deal memo or a settlement and it builds the show, 400 AI credits a month, and the same screens from the live. Ends ${weekday(e.deal_ends_at!)} at ${time(e.deal_ends_at!)} CT.</div>`, '#F2B640'),
        cta: { text: 'Watch the replay', href: REPLAY(e.episode, 'replay') },
        cta2: { text: 'Get Pro for $39', href: DEAL(e.episode, 'replay', email) },
        ps: `P.S. If you sent me your deal and I didn't get to it on the live, reply to this and I'll run it for you.`,
      }),
    }),
  },
  {
    key: 'day2',
    at: (e) => T(e) + 39 * H, until: (e) => T(e) + 54 * H,
    when: (e, l) => R(l) < T(e) + e.minutes * 60_000,
    deal: true,
    subject: () => `"I already do this in a spreadsheet"`,
    render: (e, n, email) => ({
      links: [],
      html: shell({
        kicker: `EP. ${e.episode.replace(/\D/g, '')} · Replay`,
        title: 'The spreadsheet isn\'t the problem',
        body: P(hi(n)) +
          P(`The thing I hear most: "I already do this in a spreadsheet." Good — most of the good promoters I know do. The spreadsheet isn't the problem. It does the math you type.`) +
          P(`It doesn't ask what happens at half a house. It doesn't warn you a week out that the artist deposit is still unpaid. It doesn't build the offer the agent signs, and it's not open at 2 a.m. when the venue hands you their settlement sheet.`) +
          box('A real settlement', `<div style="color:#fff;font-size:17px;font-weight:bold;">Projected $3,175 · Actual $3,319</div><div style="color:#93A2B8;margin-top:4px;">Within $144 — because every cost was in before the offer went out.</div>`) +
          P(`${esc(e.deal_label ?? '')} for everyone who registered, until ${weekday(e.deal_ends_at!)} at ${time(e.deal_ends_at!)} CT.`),
        cta: { text: 'Get Pro for $39', href: DEAL(e.episode, 'day2', email) },
        ps: `P.S. Replay's still up: <a href="${REPLAY(e.episode, 'day2')}" style="color:#8FD3FF;">watch it here</a>.`,
      }),
    }),
  },
  {
    key: 'last',
    at: (e) => T(e) + 63 * H, until: (e) => END(e) - 90 * 60_000,
    when: (e, l) => R(l) < T(e) + e.minutes * 60_000,
    deal: true,
    subject: () => 'Replay comes down tonight',
    render: (e, n, email) => ({
      links: [],
      html: shell({
        kicker: `EP. ${e.episode.replace(/\D/g, '')} · Last day`,
        title: 'Comes down tonight',
        body: P(hi(n)) +
          P(`Tonight at ${B(`${time(e.deal_ends_at!)} CT`)} two things end: the replay, and ${B(esc((e.deal_label ?? '').replace(/^F/, 'f')))}.`) +
          P(`If you've got a show you're about to send a deposit on, this is the cheapest month you'll ever run it in Promoter OS.`),
        cta: { text: 'Get Pro for $39', href: DEAL(e.episode, 'last', email) },
        cta2: { text: 'Watch the replay', href: REPLAY(e.episode, 'last') },
      }),
    }),
  },
  {
    key: 'final',
    at: (e) => END(e) - 60 * 60_000, until: (e) => END(e) - 10 * 60_000,
    when: (e, l) => R(l) < T(e) + e.minutes * 60_000,
    deal: true,
    subject: () => 'One hour left',
    render: (e, n, email) => ({
      links: [],
      html: shell({
        kicker: 'Last call',
        title: 'One hour left',
        body: P(hi(n)) + P(`At ${time(e.deal_ends_at!)} CT the $39 Pro month and the replay are gone. Next episode is in two weeks — the deal won't be.`),
        cta: { text: 'Get Pro for $39', href: DEAL(e.episode, 'final', email) },
      }),
    }),
  },
];

