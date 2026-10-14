/**
 * PROMOTER OS — Help Center content. Public, no login.
 *
 * Plain words, Jose's rules: no jargon, no typical figures, "check this"
 * never accusations. Everything here describes what the app actually does;
 * if a feature changes, change the article. Bodies are small blocks so the
 * page can search the text and render it in the house style.
 *
 * Inline marks: **bold**. That is the only one.
 */

export type Block =
  | { t: 'p'; text: string }
  | { t: 'h'; text: string }
  | { t: 'steps'; items: string[] }
  | { t: 'bullets'; items: string[] }
  | { t: 'formula'; text: string }
  | { t: 'verdicts' }
  | { t: 'tip'; text: string }
  | { t: 'link'; to: string; label: string; external?: boolean };

export interface Article {
  slug: string;
  category: string;
  title: string;
  summary: string;
  keywords?: string[];
  body: Block[];
  /** Signed-in only. Visitors see `teaser` and a sign-in card instead of `body`. (Jose, Oct 14: the fee rule is ours.) */
  members?: boolean;
  teaser?: Block[];
}

export const CATEGORIES: { id: string; label: string; blurb: string }[] = [
  { id: 'start', label: 'Start here', blurb: 'What it is, your first offer, what counts.' },
  { id: 'offers', label: 'Offers', blurb: 'The full offer, deal types, tickets, costs, deposits.' },
  { id: 'math', label: 'The math', blurb: 'Every formula, the verdicts, Deal Score, cash on hand.' },
  { id: 'after', label: 'After the show', blurb: 'Settlement, receipts, when numbers do not add up.' },
  { id: 'tv', label: 'The little TV', blurb: 'The assistant in the bar at the bottom of every screen.' },
  { id: 'billing', label: 'Plans & credits', blurb: 'The free trial, plans, AI credits.' },
  { id: 'claude', label: 'Connect Claude', blurb: 'Run your shows from Claude on a Pro or Agency plan.' },
];

export const ARTICLES: Article[] = [
  // ───────────────────────── START HERE ─────────────────────────
  {
    slug: 'what-promoter-os-does',
    category: 'start',
    title: 'What Promoter OS does',
    summary: 'One question before you sign anything: does this show survive a bad night?',
    keywords: ['overview', 'intro', 'bad night', 'survive'],
    body: [
      { t: 'p', text: 'Promoter OS is a tool for independent concert promoters. You give it the room, the ticket price, the artist\'s fee and your costs. It shows you the profit at a **sellout**, at **70% sold**, and at a **half-full room** — then gives a one-word verdict: SAFE, TIGHT, FRAGILE or UNDERWATER.' },
      { t: 'p', text: 'Then it stays with the show. Deposits and due dates, tasks, the offer PDF the agent gets, and the settlement after the show so your real profit replaces the estimate.' },
      { t: 'p', text: 'Every number on every screen comes from what you typed or what your documents say. It never fills a gap with a "typical" figure.' },
      { t: 'bullets', items: [
        '**Offers** — the easy way (seven boxes) or the full way (tiers, deposits, support acts, every cost line).',
        '**The read** — profit at 50 / 70 / 100% and the verdict, live as you type.',
        '**Needs You** — the dashboard tells you what needs you today: an unpaid deposit a week out, a show that was never settled, a deal that loses money even sold out.',
        '**Settlement** — tickets actually sold, what was actually paid, your real profit.',
        '**The little TV** — the assistant in the bar at the bottom. Drop a deal PDF and say "structure this".',
      ] },
      { t: 'link', to: '/signup', label: 'Start the free trial' },
    ],
  },
  {
    slug: 'your-first-offer',
    category: 'start',
    title: 'Your first offer in a minute',
    summary: 'Seven boxes. The bad-night read appears as you type.',
    keywords: ['quick offer', 'easy way', 'first offer', 'create'],
    body: [
      { t: 'p', text: 'The fastest way in is **Quick offer** (Offers → Quick offer). It is seven boxes and nothing else.' },
      { t: 'steps', items: [
        '**Artist**, **venue**, **date**.',
        '**Capacity** — how many tickets you can sell.',
        '**Ticket price** — one price is fine; add tiers later.',
        '**Artist fee** — the flat guarantee. Leave 0 if you are still negotiating.',
        '**Show costs** — venue, sound, security, staff. One number for now.',
        '**Ads** — what you plan to spend on marketing.',
        'Read the verdict on the right. Press **Create offer**.',
      ] },
      { t: 'p', text: 'It is saved as **Planning** — a sketch. Everything you did not fill in uses the same defaults as the full offer: 20% artist deposit, sales tax on top of the ticket, the usual PRO and insurance rates, a $2 facility fee the venue keeps. All of it can be changed on the offer page afterwards.' },
      { t: 'tip', text: 'Use it when you are on the phone with an agent and need an answer in a minute. Come back to the full offer when the deal gets real.' },
    ],
  },
  {
    slug: 'start-from-a-document',
    category: 'start',
    title: 'Start from a cost sheet, a deal memo or a settlement',
    summary: 'Drop the PDF or a photo into the little TV. It lays the deal out and asks before saving.',
    keywords: ['upload', 'pdf', 'photo', 'cost sheet', 'deal memo', 'structure this', 'scan'],
    body: [
      { t: 'p', text: 'You do not have to type anything. Tap the bar at the bottom of any screen, attach the file (PDF or a photo) and say **"structure this"** — or just send it.' },
      { t: 'steps', items: [
        'It says in one line what the document is.',
        'It lays the deal out in short lines: artist, date, venue, deal type, guarantee, deposit and when it is due, balance, splits, tickets and prices, costs the paper puts on you, cancellation terms.',
        'It gives its read: what you are on the hook for, what protects you, what to push back on. If there are enough numbers it runs the bad-night math.',
        'It asks if you want it saved as a draft offer. Nothing is saved until you say so.',
      ] },
      { t: 'p', text: 'Figures are copied as printed, never computed to fill a blank. If the paper does not say the capacity, it asks you.' },
    ],
  },
  {
    slug: 'planning-vs-confirmed',
    category: 'start',
    title: 'Planning vs Confirmed — what counts',
    summary: 'Planning is a sketch. It is not in your totals until you move it.',
    keywords: ['status', 'planning', 'confirmed', 'not counted', 'projections', 'offer sent', 'active', 'cancelled'],
    body: [
      { t: 'p', text: 'Every offer has a status. The one that matters most is the line between **Planning** and everything after it.' },
      { t: 'bullets', items: [
        '**Planning** — a sketch. It shows in your list and calendar (dimmed, marked "not counted") but it is **out of** profit, projections and the bad-night flags. Its tasks still show in Needs You and its deposits still count toward cash on hand, because budgeted money is budgeted money.',
        '**Offer sent** — the agent has the paper. Now it counts.',
        '**Confirmed** / **Active** — the show is happening. Counts.',
        '**Settled** — the show happened and you entered the actuals. Actual profit replaces the estimate.',
        '**Cancelled** — out of everything except the cancellation loss you recorded.',
      ] },
      { t: 'p', text: 'Change the status from the dropdown on the offers list or on the offer page. Quick offer always saves as Planning.' },
    ],
  },
  {
    slug: 'reading-the-dashboard',
    category: 'start',
    title: 'Reading the dashboard',
    summary: 'Needs You, cash on hand, coming up — what each card means.',
    keywords: ['dashboard', 'home', 'needs you', 'cash on hand', 'coming up', 'next event'],
    body: [
      { t: 'bullets', items: [
        '**Needs You** — the short list for today. Red: an artist or venue deposit still marked unpaid with the show a week out, or a deal that loses money even sold out. Amber: a past show never settled, a deal that loses at a half-full room, a task past due.',
        '**Cash you need on hand** — unpaid artist deposits + unpaid venue deposits + marketing budget across your shows. Artist balances and night-of costs come out of the door and are not due now.',
        '**Coming up** — your next shows with the verdict on each.',
        '**The four small stats** — active shows, projected profit, actual revenue from settled shows, and how many are still in Planning (not counted).',
      ] },
      { t: 'p', text: 'The first bubble in the little TV is the same brief in words. It is free — it is arithmetic on your own offers, not AI.' },
    ],
  },

  // ───────────────────────── OFFERS ─────────────────────────
  {
    slug: 'the-full-offer',
    category: 'offers',
    title: 'The full offer, tab by tab',
    summary: 'Deal, Tickets, Costs, Money in, Tasks & notes — with net profit and the verdict pinned under the header.',
    keywords: ['full offer', 'advanced', 'tabs', 'edit', 'autosave', 'undo'],
    body: [
      { t: 'p', text: 'Open any offer. A strip under the header stays with you while you edit and shows **net profit** and the **verdict** live. Five tabs:' },
      { t: 'steps', items: [
        '**Deal** — the lineup (drag to reorder, each act with its own fee), the headliner\'s deal type, the artist deposit and when it is due.',
        '**Tickets** — tiers with price, allotment and comps. The three stress points (50 / 70 / 100%) live here too.',
        '**Costs** — fixed lines by category (venue, production, marketing, talent extras) and the variable ones that scale with tickets.',
        '**Money in** — bar, parking, vendor spots, sponsors. Off by default.',
        '**Tasks & notes** — what has to happen before doors, pinned notes, next steps.',
      ] },
      { t: 'p', text: 'Everything autosaves about a second after you stop typing. The pill in the corner says Saving / Saved, and **Undo** takes you back to the last saved version.' },
    ],
  },
  {
    slug: 'deal-types',
    category: 'offers',
    title: 'Deal types explained',
    summary: 'Flat fee, guarantee vs percentage, door deal — who gets what.',
    keywords: ['flat fee', 'guarantee', 'percentage', 'door deal', 'split', 'backend', 'versus'],
    body: [
      { t: 'bullets', items: [
        '**Flat fee** — the artist gets the guarantee, you keep the rest. Simple, and all the risk is yours.',
        '**Guarantee vs percentage** — the artist gets whichever is higher: the guarantee, or a share of what is left after costs. A smaller guarantee protects your bad night; the percentage pays them when the night is good.',
        '**Door deal** — a straight split of the net after costs (or of the gross, if you set it that way). No floor.',
      ] },
      { t: 'p', text: 'Tax withholding, when it applies, comes off the artist\'s payout, not yours. On a percentage deal the artist is paid on what actually sold at settlement, whatever the estimate said.' },
      { t: 'formula', text: `flat fee          artist = guarantee
guarantee vs %    artist = max(guarantee, % × (net gross − costs))
door deal         artist = % × (net gross − costs)` },
      { t: 'link', to: '/help-center/a-fair-artist-fee', label: 'What a fair fee looks like' },
    ],
  },
  {
    slug: 'tickets-tiers-and-fees',
    category: 'offers',
    title: 'Tickets, tiers, comps, sales tax and the facility fee',
    summary: 'What is yours, what is the fan\'s, what is the venue\'s.',
    keywords: ['tickets', 'tiers', 'comps', 'sales tax', 'facility fee', 'on top', 'inside', 'allotment'],
    body: [
      { t: 'bullets', items: [
        '**Tiers** — GA, VIP, early bird, table: each has a price and an allotment. Sellable tickets = allotment − comps.',
        '**Comps** — free tickets for the artist, the venue, you. They never earn money, so they are out of gross.',
        '**Sales tax** — on top of the ticket. The fan pays it, the state gets it, it never touches your gross. (Default 13.18%; change it to your city.)',
        '**Facility fee** — a per-ticket amount the venue keeps. **On top** means the fan pays it over the ticket price and your gross is untouched. **Inside** means it is carved out of the price you set, so your net gross is lower.',
      ] },
      { t: 'p', text: 'On a bad night the cheap tickets sell first. The stress points assume that; the Deal Score card lets you switch to a blended mix if your room sells evenly.' },
    ],
  },
  {
    slug: 'costs-fixed-and-variable',
    category: 'offers',
    title: 'Costs: fixed and variable',
    summary: 'Lines you type, and the ones that scale with tickets sold.',
    keywords: ['costs', 'expenses', 'ascap', 'bmi', 'sesac', 'insurance', 'card fees', 'production', 'marketing'],
    body: [
      { t: 'p', text: '**Fixed costs** are the lines you type: venue rent, sound and lights, security, staff, ads, hotel and flights if you cover them, support acts. They cost the same whether 50 or 500 people show up.' },
      { t: 'p', text: '**Variable costs** scale with the night: PRO fees (ASCAP, BMI, SESAC) as a percentage of net gross, card processing as a percentage, insurance per head. The defaults are the usual rates; change them if yours differ.' },
      { t: 'formula', text: `fixed      = every expense line + support acts + hotel/flights/transport/rider if turned on
variable   = net gross × (ASCAP + BMI + SESAC + card fee rates) + tickets × insurance per head
costs      = fixed + variable` },
      { t: 'tip', text: 'The verdict is only as honest as the cost lines. If you are not sure of a number, put in the high end — a bad night is not the time to find out security was $800, not $500.' },
    ],
  },
  {
    slug: 'money-in',
    category: 'offers',
    title: 'Bar, parking, sponsors — money in',
    summary: 'Extra revenue is off by default. Turn it on only if that money is really yours.',
    keywords: ['bar', 'parking', 'sponsor', 'vendor', 'extra revenue', 'money in', 'per head'],
    body: [
      { t: 'p', text: 'The **Money in** tab is for revenue that is not tickets: bar, parking, vendor spots, sponsors. Each line has an amount and the share that is yours.' },
      { t: 'p', text: 'Bar is capacity × your per-head number. It is **off by default** on purpose — most rooms keep the bar, and a deal that only works with bar money is a deal you do not control.' },
      { t: 'p', text: 'When it is on, your share is added to profit after costs and the artist. It never changes what the artist is paid unless their deal says so.' },
    ],
  },
  {
    slug: 'deposits-and-due-dates',
    category: 'offers',
    title: 'Deposits and due dates',
    summary: 'Artist deposit, venue deposit, when they are due, and how Needs You nags you.',
    keywords: ['deposit', 'due date', 'paid', 'unpaid', 'balance', 'venue deposit', 'artist deposit'],
    body: [
      { t: 'bullets', items: [
        '**Artist deposit** — a percentage of the guarantee (default 20%), due a set number of days before the show or on a date you pick. Mark it paid when the wire goes out.',
        '**Venue deposit** — a flat amount, with its own paid / unpaid.',
        '**Balance** — the rest of the guarantee, usually at settlement. It comes out of the door, so it is not in "cash on hand".',
      ] },
      { t: 'p', text: 'With the show a week out, an unpaid deposit turns **red** in Needs You on the dashboard and in the little TV\'s brief. Marking it paid clears it. You can also just tell the TV: "mark the deposit paid on Flores Negras".' },
    ],
  },
  {
    slug: 'lineup-and-support-acts',
    category: 'offers',
    title: 'Lineup and support acts',
    summary: 'Every act on the bill with its own fee, deposit and travel.',
    keywords: ['lineup', 'support', 'opener', 'headliner', 'artist', 'travel', 'hospitality'],
    body: [
      { t: 'p', text: 'On the **Deal** tab the lineup is a list of cards: headliner, support, openers. Drag to reorder. Each card has its own guarantee, deposit, flights, hotel and hospitality, and its own contact.' },
      { t: 'p', text: 'Support fees are added to costs. The headliner\'s deal type (flat, guarantee vs %, door) only applies to the headliner.' },
      { t: 'p', text: 'Each act can get its own offer sheet PDF with just their terms, so the opener never sees what the headliner makes.' },
    ],
  },
  {
    slug: 'send-the-offer',
    category: 'offers',
    title: 'The offer PDF and emailing it',
    summary: 'A clean offer the agent can sign, sent from your name.',
    keywords: ['pdf', 'email', 'send', 'offer sheet', 'agent', 'download'],
    body: [
      { t: 'steps', items: [
        'On the offer page press **PDF**. It builds the offer sheet with your company details, the deal terms, deposits, tickets and the show details.',
        '**Email** sends it to the artist contact on the lineup card, from your name, with a short note. The offer is stamped with the sent date and the status moves to Offer sent.',
        'The artist sheet is the same page cut down to one act\'s terms.',
      ] },
      { t: 'p', text: 'Your logo and company details come from Settings. The PDF never shows your internal costs or your profit — only the terms.' },
    ],
  },
  {
    slug: 'tasks-notes-run-of-show',
    category: 'offers',
    title: 'Tasks, notes and run of show',
    summary: 'What has to happen before doors, and the night itself minute by minute.',
    keywords: ['tasks', 'notes', 'run of show', 'schedule', 'doors', 'curfew', 'checklist'],
    body: [
      { t: 'bullets', items: [
        '**Tasks** — a checklist per show with a due date and priority. Past-due tasks show in Needs You. Tell the TV "add a task to call the venue about parking" and it does.',
        '**Notes** — pinned notes on the show; what the agent said on the phone, what the venue wants.',
        '**Run of show** — doors, set times, changeovers, curfew, as a printable sheet for the crew.',
      ] },
    ],
  },

  // ───────────────────────── THE MATH ─────────────────────────
  {
    slug: 'the-math-exactly',
    category: 'math',
    title: 'The math, exactly',
    summary: 'Every formula the app runs. No typical figures, no padding.',
    keywords: ['formula', 'gross', 'net gross', 'profit', 'calculation', 'how it is calculated'],
    body: [
      { t: 'h', text: '1 · Gross and net gross' },
      { t: 'formula', text: `gross      = Σ (tickets sold in tier × tier price)
net gross  = gross − facility fee carved out of the ticket (only if "inside")
             sales tax is ON TOP of the ticket: the fan pays it, it never reduces net gross` },
      { t: 'h', text: '2 · Costs' },
      { t: 'formula', text: `fixed      = every expense line + support acts + hotel/flights/transport/rider if turned on
variable   = net gross × (ASCAP + BMI + SESAC + card fee rates) + tickets × insurance per head
costs      = fixed + variable` },
      { t: 'h', text: '3 · The artist' },
      { t: 'formula', text: `flat fee          artist = guarantee
guarantee vs %    artist = max(guarantee, % × (net gross − costs))
door deal         artist = % × (net gross − costs)   (or of gross, if you set it so)
tax withholding   taken off the artist's payout, not yours` },
      { t: 'h', text: '4 · Your profit' },
      { t: 'formula', text: `profit = net gross − costs − artist + your share of bar/parking/sponsors` },
      { t: 'h', text: '5 · The bad night' },
      { t: 'p', text: 'The same formula is run three times, at **50%**, **70%** and **100%** of sellable tickets (allotment minus comps). On a bad night the cheap tickets sell first.' },
      { t: 'verdicts' },
      { t: 'h', text: '6 · At settlement' },
      { t: 'p', text: 'The same math on what actually sold and what was actually paid. On a percentage deal the artist is paid on the real net, not the estimate.' },
    ],
  },
  {
    slug: 'verdicts-and-deal-score',
    category: 'math',
    title: 'SAFE, TIGHT, FRAGILE, UNDERWATER — and Deal Score',
    summary: 'What the verdict means and how the 0–100 score is built.',
    keywords: ['verdict', 'safe', 'tight', 'fragile', 'underwater', 'deal score', 'score', 'risk'],
    body: [
      { t: 'verdicts' },
      { t: 'p', text: 'The verdict comes from the three stress points. It does not care how good the sellout looks; it cares whether you survive the night that goes wrong.' },
      { t: 'h', text: 'Deal Score (0–100)' },
      { t: 'p', text: 'Scored at capacity, judged at 50%. It rewards a deal that survives a half-full room and punishes one that only works sold out. A high guarantee against a small room, costs that eat most of the gross, or a split with no floor all pull it down. It is free — arithmetic, not AI.' },
      { t: 'tip', text: 'Fix the deal until it is at least TIGHT. SAFE is the goal. FRAGILE means you are betting on a sellout — know that going in.' },
    ],
  },
  {
    slug: 'cash-on-hand',
    category: 'math',
    title: 'Cash you need on hand',
    summary: 'What has to be in the bank before doors — and what comes out of the door.',
    keywords: ['cash', 'cash on hand', 'deposits', 'marketing', 'before doors', 'balance'],
    body: [
      { t: 'formula', text: `cash on hand = unpaid artist deposits + unpaid venue deposits + marketing budget
                (artist balances and night-of costs come out of the door — not due now)` },
      { t: 'p', text: 'This is the number on the dashboard and in the brief. It is summed across every show that is not cancelled — Planning shows included, because a budgeted deposit is a budgeted deposit. Marking a deposit paid takes it out.' },
    ],
  },
  {
    slug: 'a-fair-artist-fee',
    category: 'math',
    title: 'What a fair artist fee looks like',
    summary: 'The rule the Artist Fee page uses, tested on real settlements.',
    keywords: ['artist fee', 'how much to pay', 'guarantee', 'estimator', 'tiered'],
    members: true,
    teaser: [
      { t: 'p', text: 'Most promoters price the headliner by feel: what the agent asked, what they paid last time, what the room "should" do. Promoter OS has a **tested rule** instead — a fee that survives a half-full room, with a floor that protects the bad night and a share that pays the artist more on a good one.' },
      { t: 'p', text: 'It came out of real settlements, including a $25,000 flat deal that lost money at half capacity and would have been SAFE under the rule. The rule, the numbers behind it, and the Artist Fee page that applies it to your room are inside the app.' },
    ],
    body: [
      { t: 'p', text: 'The **Artist Fee** page (menu → Artist fee) turns a room and a ticket price into a fee that survives a bad night.' },
      { t: 'bullets', items: [
        '**Under about $10,000 in expected gross** — the headliner should cost **10–15% of the gross**, flat.',
        '**Over $10,000** — stop paying flat. Guarantee about **10% of expected gross**, and pay **15–25% of what is left after costs**, whichever is higher.',
      ] },
      { t: 'p', text: 'The guarantee floor is what protects the bad night. On a good night the percentage pays the artist more than a flat fee would have — which is why agents take it.' },
      { t: 'p', text: 'Stress-tested on a real $25,000 flat deal: it lost money at a half-full room. The same show at a 10% guarantee against 20% of net was SAFE at half and paid the artist more at a sellout.' },
    ],
  },

  // ───────────────────────── AFTER THE SHOW ─────────────────────────
  {
    slug: 'settle-a-show',
    category: 'after',
    title: 'Settle a show, step by step',
    summary: 'Tickets actually sold, what was actually paid, your real profit.',
    keywords: ['settlement', 'settle', 'actuals', 'after the show', 'real profit', 'draft'],
    body: [
      { t: 'steps', items: [
        'Open the show → **Settle event**.',
        'Type what actually sold per tier. Ticket revenue updates as you type.',
        'Type what was actually paid per cost line. Lines you leave at 0 count as 0 — the estimate is not carried over on its own.',
        'Add where the money came in (door cash, presale, bar) if you track it.',
        'It saves a **draft** as you type — "Draft saved" in the corner. Nothing is marked settled yet.',
        'Press **Save**. The show is marked Settled, actual profit replaces the estimate, and the dashboard\'s actual revenue moves.',
      ] },
      { t: 'p', text: 'Past shows that were never settled show in Needs You and under the **Settle** tab on your phone until you do.' },
    ],
  },
  {
    slug: 'receipts-and-the-chat',
    category: 'after',
    title: 'Drop receipts, let it sort them',
    summary: 'Receipts, Venmo screenshots, the venue sheet — into a working list, then into the settlement when you say so.',
    keywords: ['receipts', 'venmo', 'zelle', 'cash app', 'screenshot', 'ledger', 'working list', 'write it'],
    body: [
      { t: 'p', text: 'You can drop receipts into the chat on the settlement page, or into the little TV from anywhere. Same list either way.' },
      { t: 'steps', items: [
        'Attach the receipts, invoices or payment screenshots. Say which show if it is not obvious.',
        'It pulls out each item — what, how much, who was paid — and puts it on a **working list**, one item per receipt. Amounts are copied as printed. A receipt with subtotal, tax and total is the total.',
        'Anything unclear stays a **question**, not a number: "Is the $450 to Marco for security or for the door?" Answer in the chat and it moves to the list.',
        'When every item is settled, say **"write it"** (or press the button). The expenses, ticket counts and money-in go into the settlement.',
      ] },
      { t: 'p', text: 'Writing the list does **not** mark the show settled. That is still the Save button on the settlement page, once you have looked it over.' },
    ],
  },
  {
    slug: 'check-this',
    category: 'after',
    title: 'When the numbers do not add up',
    summary: 'It says "check this" and gives you the two numbers. It never says anyone is cheating.',
    keywords: ['check this', 'mismatch', 'discrepancy', 'wrong', 'does not add up', 'duplicate'],
    body: [
      { t: 'p', text: 'Settlements get done at 2 a.m. by tired people. Mistakes happen. When the venue sheet and your count disagree, or the same $200 to the same person shows up twice, the app says **check this** and states the numbers side by side.' },
      { t: 'p', text: 'It will not say — and we ask you not to read it as — anyone padding, skimming or cheating. You see one document; you do not know what was agreed on the phone. And you have to work with these people again.' },
      { t: 'p', text: 'Fix the number or confirm it, and move on.' },
    ],
  },

  // ───────────────────────── THE LITTLE TV ─────────────────────────
  {
    slug: 'meet-the-little-tv',
    category: 'tv',
    title: 'Meet the little TV',
    summary: 'The assistant in the bar at the bottom of every screen. Talk to it like a partner.',
    keywords: ['ask', 'assistant', 'chat', 'mascot', 'tv', 'ai', 'threads'],
    body: [
      { t: 'p', text: 'Tap the bar at the bottom of any screen. It opens with what needs you today (free), then you can talk:' },
      { t: 'bullets', items: [
        '**"What needs me?"** / **"Cash I need"** / **"Coming up"** — the brief, in words.',
        '**Drop a deal PDF** and say "structure this" — it lays the deal out, gives its read, asks before saving.',
        '**"How can we make this work?"** — it tries changes one at a time and shows 50% / 100% for each. Nothing is saved by that.',
        '**"Save it"** — creates a draft offer. **"Bump GA to $35"**, **"add $500 security"**, **"mark the deposit paid"** — it does it and lists exactly what changed.',
        '**Receipts** — drop them and say which show. See "Drop receipts, let it sort them".',
        '**Tasks and notes** — "add a task", "check off the rider", "pin a note".',
      ] },
      { t: 'p', text: 'Every deal, show or question gets its own **thread**. The chats button in the header lists them; files stay with their thread.' },
      { t: 'p', text: 'It only ever changes something you asked for in that same message, and it tells you what changed. It will not save a deal because it "looks complete".' },
    ],
  },
  {
    slug: 'what-costs-credits',
    category: 'tv',
    title: 'What costs credits',
    summary: 'A message is 1, a message with files 2, a document scan 3. The brief and Deal Score are free.',
    keywords: ['credits', 'cost', 'free', 'scan', 'message', 'ai credits'],
    body: [
      { t: 'bullets', items: [
        '**Free** — the brief (what needs you, cash, coming up), Deal Score, the verdict, insights. They are arithmetic on your own numbers, not AI.',
        '**1 credit** — a chat message.',
        '**2 credits** — a message with files attached (a PDF, a photo).',
        '**3 credits** — a document scan on the settlement page.',
      ] },
      { t: 'p', text: 'The "cr" pill on the bar shows what is left. Your plan gives a monthly allowance; bought packs never expire and are used after the monthly ones.' },
      { t: 'link', to: '/help-center/free-trial-and-plans', label: 'Plans and the free trial' },
    ],
  },

  // ───────────────────────── PLANS & CREDITS ─────────────────────────
  {
    slug: 'free-trial-and-plans',
    category: 'billing',
    title: 'The free trial and the plans',
    summary: '7 days, 20 AI credits, no card. Then Starter, Pro or Agency Scale.',
    keywords: ['trial', '7 days', 'plans', 'starter', 'pro', 'agency', 'price', 'billing', 'upgrade', 'subscription'],
    body: [
      { t: 'p', text: 'Sign up and you get **7 days** of everything, with **20 AI credits** for the assistant and the document scanner. No card.' },
      { t: 'p', text: 'When you start a plan you are billed that day and the plan\'s credits unlock right away. To get more credits during the trial, start a plan — packs are for paid plans.' },
      { t: 'bullets', items: [
        '**Starter — $39/mo** — up to 10 active shows, 1 seat, the full offer builder, PDFs, settlements, 100 AI credits a month.',
        '**Pro — $99/mo** — unlimited shows, 2 seats, the document scanner, the Claude connector, 400 credits a month.',
        '**Agency Scale — $297/mo** — everything, 5 seats, 1,500 credits a month.',
      ] },
      { t: 'p', text: 'Credit packs (100 for $9, 500 for $35) are one-time, never expire, and are spent after the monthly ones. Subscription → AI Credits.' },
      { t: 'p', text: 'If the trial ends without a plan, your account goes view-only: you can open your existing offers but not make new ones. Nothing is deleted.' },
      { t: 'link', to: '/pricing', label: 'See pricing' },
    ],
  },
  {
    slug: 'your-company-details',
    category: 'billing',
    title: 'Your company details on the PDF',
    summary: 'Logo, company name, contact — set once in Settings.',
    keywords: ['settings', 'logo', 'company', 'branding', 'contact', 'pdf header'],
    body: [
      { t: 'p', text: 'Menu → **Settings**. Company name, contact name, email, phone, address and your logo. They go on every offer PDF and on the emails the app sends on your behalf.' },
      { t: 'p', text: 'Defaults for new offers (sales tax, deposit %, fee rates) live on the offer itself and can be changed per show.' },
    ],
  },

  // ───────────────────────── CONNECT CLAUDE ─────────────────────────
  {
    slug: 'connect-claude',
    category: 'claude',
    title: 'Run your shows from Claude',
    summary: 'On Pro or Agency Scale, connect Promoter OS to Claude and talk to your offers from anywhere.',
    keywords: ['claude', 'connector', 'mcp', 'integration', 'anthropic', 'connect'],
    body: [
      { t: 'p', text: 'Promoter OS has a connector for Claude (claude.ai, the Claude desktop app, Claude Code). Once connected, you can say "what needs me this week", "bump GA to $35 on Flores Negras", or "how does the KC show look at half full" in any Claude chat, and it reads and writes your real offers.' },
      { t: 'p', text: 'It needs a **Pro or Agency Scale** plan. Starter and the free trial cannot connect.' },
      { t: 'steps', items: [
        'In Claude: Settings → **Connectors** → **Add custom connector**.',
        'Name it Promoter OS. Server URL: **https://azenzsggqexyonafxlsf.supabase.co/functions/v1/promtp-mcp**',
        'Claude sends you to promoteros.com to sign in and approve. Press **Allow**.',
        'Back in Claude, enable it for the chat. Try: "list my upcoming offers".',
      ] },
      { t: 'p', text: 'Claude only sees your organization\'s data, with the same permissions as your login. Anything that writes — creating or changing an offer, recording a settlement, emailing an offer — Claude will tell you before it does it, and it says what changed after.' },
    ],
  },
];

/** Plain text of an article, for search. */
export function articleText(a: Article): string {
  const parts: string[] = [a.title, a.summary, ...(a.keywords || [])];
  for (const b of a.body) {
    if ('text' in b) parts.push(b.text);
    if ('items' in b) parts.push(...b.items);
    if (b.t === 'link') parts.push(b.label);
  }
  return parts.join(' ').replace(/\*\*/g, '').toLowerCase();
}
