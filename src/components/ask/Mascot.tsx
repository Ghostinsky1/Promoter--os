import { useEffect, useMemo, useState } from 'react';

/**
 * PROMOTER OS — the little one who lives in the Ask chat.
 *
 * A tiny pixel-art box TV, the same "old but new future" look as the Promoter
 * OS video ads: brand palette only, dot-matrix pixels, scanlines on the
 * screen, bloom, a red/sky color split on the screen edges, a power-on
 * flash when it appears, and a one-frame glitch when its mood changes.
 * Its face lives on the screen. Every state is CSS; nothing here costs a
 * credit.
 *
 *   idle       breathes, blinks, antenna tips twinkle
 *   listening  you are typing: leans in, eyes go to the keyboard
 *   thinking   waiting on an answer: eyes roam, static, "..." mouth
 *   reading    a file is being read: a bright line sweeps the screen
 *   happy      something got done: ^ ^ eyes, big grin, a hop
 *   sad        something went wrong: eyes down, mouth down, screen dims
 */
export type Mood = 'idle' | 'listening' | 'thinking' | 'reading' | 'happy' | 'sad';

// The only colors, from the locked ad style.
const C = { k: '#14171e', c: '#22262f', b: '#1140f0', d: '#0b2fb8', m: '#5a8cff', s: '#8fd3ff', w: '#ffffff', r: '#f0605a', a: '#f2b640', n: '#0e1f5c' } as const;
type Ink = keyof typeof C;

// 20 x 16 cells. '.' is empty.
const MAP = [
  '.....s........s.....',
  '.....m........m.....',
  '......m......m......',
  '.......m....m.......',
  '..mmmmmmmmmmmmmmmm..',
  '..mccccccccccccccm..',
  '..mcbbbbbbbbbbbbcm..',
  '..mcddddddddddddsm..',
  '..mcbbbbbbbbbbbbcm..',
  '..mcddddddddddddcm..',
  '..mcbbbbbbbbbbbbcm..',
  '..mcddddddddddddrm..',
  '..mcbbbbbbbbbbbbcm..',
  '..mccccccssccccccm..',
  '..mmmmmmmmmmmmmmmm..',
  '....mm........mm....',
];

type P = [number, number];
const EYE_L: P[] = [[5, 7], [6, 7], [7, 7], [5, 8], [6, 8], [7, 8], [5, 9], [6, 9], [7, 9]];
const EYE_R: P[] = EYE_L.map(([x, y]) => [x + 7, y]);
const LID_L: P[] = [[5, 7], [6, 7], [7, 7], [5, 8], [6, 8], [7, 8]];
const LID_R: P[] = LID_L.map(([x, y]) => [x + 7, y]);
const PUPILS: P[] = [[6, 8], [13, 8]];
const HAPPY_EYES: P[] = [[5, 8], [6, 7], [7, 8], [12, 8], [13, 7], [14, 8]];
const MOUTH: P[] = [[8, 11], [9, 11], [10, 11], [11, 11]];
const GRIN: P[] = [[6, 10], [13, 10], [7, 11], [8, 11], [9, 11], [10, 11], [11, 11], [12, 11]];
const FROWN: P[] = [[8, 11], [9, 11], [10, 11], [11, 11], [7, 12], [12, 12]];
const DOTS: P[] = [[7, 11], [9, 11], [11, 11]];
const STATIC: P[] = [[5, 10], [9, 7], [14, 11], [11, 6], [8, 12], [4, 9], [13, 12], [6, 6]];

let cssInjected = false;
export const MASCOT_CSS = `
@keyframes pos-bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-1px); } }
@keyframes pos-blink { 0%,93%,100% { opacity: 0; } 94%,98% { opacity: 1; } }
@keyframes pos-twinkle { 0%,49% { opacity: 1; } 50%,100% { opacity: 0; } }
@keyframes pos-roam { 0%,20% { transform: translate(-1px,-1px); } 25%,45% { transform: translate(1px,-1px); } 50%,70% { transform: translate(1px,0); } 75%,100% { transform: translate(-1px,0); } }
@keyframes pos-dot { 0%,100% { opacity: .25; } 33% { opacity: 1; } }
@keyframes pos-static { 0%,40%,100% { opacity: 0; } 41%,60% { opacity: .9; } }
@keyframes pos-scan { 0% { transform: translateY(0); } 100% { transform: translateY(7px); } }
@keyframes pos-sweep { 0%,30% { transform: translateX(-1px); } 35%,65% { transform: translateX(0); } 70%,100% { transform: translateX(1px); } }
@keyframes pos-hop { 0%,100% { transform: translateY(0); } 30%,60% { transform: translateY(-2px); } }
@keyframes pos-lean { 0%,100% { transform: translateY(0); } 50% { transform: translateY(1px); } }
@keyframes pos-flicker { 0%,100% { opacity: 1; } 50% { opacity: .93; } }
@keyframes pos-poweron { 0% { transform: scaleY(.06); opacity: 1; } 35% { transform: scaleY(1); opacity: 1; } 100% { transform: scaleY(1); opacity: 0; } }
@keyframes pos-glitch { 0% { transform: translateX(0); } 33% { transform: translateX(-1px); } 66% { transform: translateX(1px); } 100% { transform: translateX(0); } }
.pos-m { display:inline-block; overflow:visible; shape-rendering: crispEdges; }
.pos-m .tv { animation: pos-bob 3.4s steps(2, end) infinite; }
.pos-m .screen { animation: pos-flicker 2.7s steps(1, end) infinite; }
.pos-m .face { animation: pos-glitch .22s steps(3, end) 1; }
.pos-m .lid { opacity: 0; animation: pos-blink 4.8s steps(1, end) infinite; }
.pos-m .tipL { animation: pos-twinkle 2.2s steps(1, end) infinite; }
.pos-m .tipR { animation: pos-twinkle 2.2s steps(1, end) infinite; animation-delay: 1.1s; }
.pos-m .pupils { transition: transform .25s steps(2, end); }
.pos-m .dots, .pos-m .static, .pos-m .scan, .pos-m .happyEyes, .pos-m .grin, .pos-m .frown, .pos-m .dim, .pos-m .bright { opacity: 0; }
.pos-m .pon { transform-box: fill-box; transform-origin: center; animation: pos-poweron .7s steps(8, end) 1 forwards; }
.pos-m[data-mood="listening"] .tv { animation: pos-lean 2s steps(2, end) infinite; }
.pos-m[data-mood="listening"] .pupils { transform: translate(1px, 1px); }
.pos-m[data-mood="listening"] .bright { opacity: .12; }
.pos-m[data-mood="thinking"] .pupils { animation: pos-roam 2.4s steps(1, end) infinite; }
.pos-m[data-mood="thinking"] .mouth { opacity: 0; }
.pos-m[data-mood="thinking"] .dots { opacity: 1; }
.pos-m[data-mood="thinking"] .dots rect { animation: pos-dot .9s steps(1, end) infinite; }
.pos-m[data-mood="thinking"] .dots rect:nth-child(2) { animation-delay: .3s; }
.pos-m[data-mood="thinking"] .dots rect:nth-child(3) { animation-delay: .6s; }
.pos-m[data-mood="thinking"] .static { opacity: 1; }
.pos-m[data-mood="thinking"] .static rect { animation: pos-static 1.3s steps(1, end) infinite; }
.pos-m[data-mood="reading"] .scan { opacity: .55; animation: pos-scan 1.4s steps(7, end) infinite; }
.pos-m[data-mood="reading"] .pupils { animation: pos-sweep 1.4s steps(1, end) infinite; }
.pos-m[data-mood="reading"] .lid { animation-duration: 2.6s; }
.pos-m[data-mood="happy"] .tv { animation: pos-hop .6s steps(2, end) 2; }
.pos-m[data-mood="happy"] .eyes, .pos-m[data-mood="happy"] .mouth { opacity: 0; }
.pos-m[data-mood="happy"] .lid { animation: none; }
.pos-m[data-mood="happy"] .happyEyes, .pos-m[data-mood="happy"] .grin { opacity: 1; }
.pos-m[data-mood="happy"] .bright { opacity: .16; }
.pos-m[data-mood="sad"] .tv { animation: none; transform: translateY(1px); }
.pos-m[data-mood="sad"] .pupils { transform: translate(0, 1px); }
.pos-m[data-mood="sad"] .mouth { opacity: 0; }
.pos-m[data-mood="sad"] .frown { opacity: 1; }
.pos-m[data-mood="sad"] .dim { opacity: .45; }
.pos-m[data-mood="sad"] .tipL, .pos-m[data-mood="sad"] .tipR { animation: none; opacity: 0; }
@media (prefers-reduced-motion: reduce) { .pos-m * { animation: none !important; } }
`;

function cells(map: string[]) {
  const out: { x: number; y: number; ink: Ink }[] = [];
  map.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const ch = row[x] as Ink | '.'; if (ch !== '.') out.push({ x, y, ink: ch }); } });
  return out;
}

const Px = ({ pts, ink, className }: { pts: P[]; ink: Ink; className?: string }) => (
  <g className={className} fill={C[ink]}>
    {pts.map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} />)}
  </g>
);

export function Mascot({ mood = 'idle', size = 40, className = '', powerOn = false }: { mood?: Mood; size?: number; className?: string; powerOn?: boolean }) {
  const [id] = useState(() => `m${Math.random().toString(36).slice(2, 8)}`);
  const body = useMemo(() => cells(MAP), []);
  useEffect(() => {
    if (cssInjected || typeof document === 'undefined') return;
    const el = document.createElement('style');
    el.setAttribute('data-pos-mascot', '');
    el.textContent = MASCOT_CSS;
    document.head.appendChild(el);
    cssInjected = true;
  }, []);

  return (
    <svg className={`pos-m ${className}`} data-mood={mood} width={size} height={size * 0.8} viewBox="0 0 20 16" aria-hidden="true">
      <defs>
        <filter id={`${id}-bloom`} x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="1.1" /></filter>
        <pattern id={`${id}-dots`} width="1" height="1" patternUnits="userSpaceOnUse">
          <rect x="0.86" y="0" width="0.14" height="1" fill={C.k} />
          <rect x="0" y="0.86" width="1" height="0.14" fill={C.k} />
        </pattern>
      </defs>
      <g className="tv">
        {/* CRT bloom under the screen */}
        <rect x="4" y="6" width="12" height="7" fill={C.b} opacity="0.7" filter={`url(#${id}-bloom)`} />
        {/* the set */}
        <g>{body.map((p) => <rect key={`${p.x}-${p.y}`} x={p.x} y={p.y} width={1} height={1} fill={C[p.ink]} />)}</g>
        {/* antenna tips twinkle white */}
        <rect className="tipL" x="5" y="0" width="1" height="1" fill={C.w} />
        <rect className="tipR" x="14" y="0" width="1" height="1" fill={C.w} />
        {/* the screen: everything on it glitches together on a mood change */}
        <g className="screen">
          <g className="face" key={mood}>
            <g className="eyes">
              <Px pts={EYE_L} ink="w" />
              <Px pts={EYE_R} ink="w" />
              <g className="pupils"><Px pts={PUPILS} ink="n" /></g>
              <g className="lid"><Px pts={LID_L} ink="b" /><Px pts={LID_R} ink="b" /></g>
            </g>
            <Px className="happyEyes" pts={HAPPY_EYES} ink="w" />
            <Px className="mouth" pts={MOUTH} ink="w" />
            <Px className="grin" pts={GRIN} ink="w" />
            <Px className="frown" pts={FROWN} ink="w" />
            <Px className="dots" pts={DOTS} ink="w" />
            <Px className="static" pts={STATIC} ink="m" />
            <rect className="scan" x="4" y="6" width="12" height="1" fill={C.s} />
            <rect className="bright" x="4" y="6" width="12" height="7" fill={C.s} />
            <rect className="dim" x="4" y="6" width="12" height="7" fill={C.k} />
          </g>
          {/* color split on the screen edges, like the ads */}
          <rect x="4" y="6" width="0.5" height="7" fill={C.r} opacity="0.45" />
          <rect x="15.5" y="6" width="0.5" height="7" fill={C.s} opacity="0.45" />
          {powerOn && <rect className="pon" x="4" y="6" width="12" height="7" fill={C.w} />}
        </g>
        {/* dot-matrix gaps over the set */}
        <rect x="2" y="4" width="16" height="11" fill={`url(#${id}-dots)`} opacity="0.4" />
      </g>
    </svg>
  );
}
