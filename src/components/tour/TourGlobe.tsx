import { useEffect, useMemo, useRef, useState } from 'react';
import Globe from 'globe.gl';
import * as THREE from 'three';
import { feature } from 'topojson-client';
import { polygonToCells } from 'h3-js';
import countriesTopo from 'world-atlas/countries-110m.json';
import { STAGE, route, lastShow, canonicalCity, isBooked, isPast, money$, short$, type Card } from '../../lib/tourPipeline';
import { parseLocalDate } from '../../lib/dateHelpers';

const GRAY = '#9AA4B5';

/**
 * The tour on a spinning globe, in the house CRT blue. Where we've been is light gray; what's
 * coming is lit in its stage color, the next show pulsing, the route drawn between the real
 * shows in date order. Hover a dot: the event, the date, and whether it made money.
 * Drag to spin, scroll / pinch to zoom, tap a dot to open its card.
 * Loaded lazily — three.js is heavy and only the pages that show it need it.
 */
export default function TourGlobe({ cards, nextKey, selectedKey, onSelect, height = 420, showLeads = false, maxCards = 6 }: {
  cards: Card[]; nextKey: string | null; selectedKey: string | null; onSelect: (key: string) => void; height?: number;
  /** Name the lead-only cities with pills. Off by default: with a hundred leads it's a wall. */
  showLeads?: boolean;
  /** How many upcoming booked shows get a card with a date and a line to the edge. */
  maxCards?: number;
}) {
  const el = useRef<HTMLDivElement>(null);
  const globe = useRef<any>(null);
  const flown = useRef(false);
  const placed = useMemo(() => cards.filter((c) => c.lat != null && c.lng != null), [cards]);
  // The line runs through the real shows; leads are dots only.
  const path = useMemo(() => route(placed, true), [placed]);
  // What's coming, in order — the cards and the camera follow this, not the whole history.
  const upcoming = useMemo(() => path.filter((c) => !isPast(c)), [path]);

  // Build once.
  useEffect(() => {
    if (!el.current) return;
    // A few shapes in the 110m world file trip the hex library (it throws and stops the
    // rest); keep only the ones it can draw, and skip Antarctica.
    const countries = (feature(countriesTopo as any, (countriesTopo as any).objects.countries) as any).features
      .filter((f: any) => f.id !== '010' && drawable(f));
    const g = new (Globe as any)(el.current, { animateIn: true })
      .backgroundColor('rgba(0,0,0,0)')
      .showAtmosphere(true).atmosphereColor('#5A8CFF').atmosphereAltitude(0.18)
      .globeMaterial(new THREE.MeshPhongMaterial({ color: '#0E1F5C', emissive: '#0B2FB8', emissiveIntensity: 0.25, shininess: 4 }))
      .hexPolygonsData(countries)
      .hexPolygonResolution(3).hexPolygonMargin(0.55).hexPolygonUseDots(true)
      .hexPolygonColor(() => 'rgba(143,211,255,0.55)')
      .pointAltitude(0.015).pointRadius(0.75).pointResolution(16)
      .arcStroke(0.7).arcDashLength(0.45).arcDashGap(0.25).arcDashAnimateTime(2600).arcAltitudeAutoScale(0.35)
      .ringMaxRadius(3.2).ringPropagationSpeed(2.2).ringRepeatPeriod(900)
            .onPointClick((p: any) => onSelect(p.key));

    g.controls().autoRotate = true;
    g.controls().autoRotateSpeed = 0.45;
    g.controls().enableDamping = true;
    // Stop spinning once someone grabs it.
    el.current.addEventListener('pointerdown', () => { g.controls().autoRotate = false; }, { once: true });
    globe.current = g;
    flown.current = false;
    return () => { try { g._destructor?.(); } catch { /* ignore */ } if (el.current) el.current.innerHTML = ''; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Size.
  useEffect(() => {
    const g = globe.current; if (!g || !el.current) return;
    const fit = () => { g.width(el.current!.clientWidth).height(height); };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(el.current);
    return () => ro.disconnect();
  }, [height]);

  // Data.
  useEffect(() => {
    const g = globe.current; if (!g) return;
    const colorOf = (c: Card) => (c.key === selectedKey ? '#FFFFFF' : isPast(c) ? GRAY : STAGE[c.stage].color);
    // The route in date order; two nights in the same city draw no line. Past legs are gray.
    const arcs = path.slice(1).map((c, i) => ({
      startLat: path[i].lat, startLng: path[i].lng, endLat: c.lat, endLng: c.lng,
      color: isPast(c) ? ['rgba(154,164,181,0.45)', 'rgba(154,164,181,0.45)'] : [colorOf(path[i]), colorOf(c)],
    })).filter((a) => Math.abs(a.startLat! - a.endLat!) + Math.abs(a.startLng! - a.endLng!) > 0.3);
    // One label per city: "saint louis", "St Louis" and "STL" are the same spot. Counts the
    // real shows there; leads add "+N looking". A city with only past shows is gray.
    const spots = new Map<string, { lat: number; lng: number; city: string; shows: number; leads: number; upcoming: number; key: string }>();
    for (const c of placed) {
      if (c.stage === 'dead') continue;
      const name = canonicalCity(c.city || c.venue);
      const k = [...spots.values()].find((x) => Math.hypot(x.lat - c.lat!, x.lng - c.lng!) < 0.6)?.key ?? c.key;
      const sp = spots.get(k) ?? { lat: c.lat!, lng: c.lng!, city: name, shows: 0, leads: 0, upcoming: 0, key: c.key };
      if (isBooked(c.stage)) { sp.shows++; sp.city = name; if (!isPast(c)) { sp.upcoming++; sp.key = c.key; } } else sp.leads++;
      spots.set(k, sp);
    }
    // Pills, sized in pixels so they stay readable at any zoom.
    // Pills sit to the right of their dot. When two cities are close, the western one flips
    // to the left of its dot, so the two pills point away from each other.
    const list = [...spots.values()].sort((a, b) => a.lng - b.lng);
    const left = new Set<string>();
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      if (Math.abs(list[i].lat - list[j].lat) < 2.5 && Math.abs(list[i].lng - list[j].lng) < 7) left.add(list[i].key);
    }
    // Cities with real shows get a callout to the edge (below); pills are for lead-only cities.
    const labels = showLeads ? list.filter((x) => !x.shows).map((x) => ({ ...x, left: left.has(x.key) })) : [];
    g.pointsData(placed)
      .pointLat('lat').pointLng('lng')
      .pointColor(colorOf)
      .pointRadius((c: Card) => (c.key === selectedKey || c.key === nextKey ? 1.05 : isPast(c) ? 0.45 : isBooked(c.stage) ? 0.75 : showLeads ? 0.45 : 0.3))
      .pointLabel(tip);
    g.arcsData(arcs).arcColor('color');
    g.htmlElementsData(labels).htmlLat('lat').htmlLng('lng').htmlAltitude(0.02).htmlTransitionDuration(0)
      .htmlElement((x: any) => {
        // The renderer owns the outer element's transform, so the pill is a child that we offset.
        const el = document.createElement('div');
        const pill = document.createElement('div');
        const tone = x.upcoming ? '#FFFFFF' : x.shows ? GRAY : '#C8D6EB';
        const border = x.upcoming ? 'rgba(143,211,255,0.7)' : 'rgba(154,164,181,0.35)';
        pill.innerHTML = `<span style="color:${tone};font-weight:${x.upcoming ? 700 : 500}">${esc(x.city)}</span>${x.shows ? `<span style="color:${x.upcoming ? '#4ADE80' : GRAY};margin-left:5px">${x.shows}</span>` : ''}${x.leads ? `<span style="color:#F2B640;margin-left:5px">+${x.leads}</span>` : ''}`;
        pill.style.cssText = `position:absolute;top:0;${x.left ? 'right:9px' : 'left:9px'};transform:translateY(-50%);pointer-events:auto;cursor:pointer;white-space:nowrap;font:600 11px 'Saira Condensed',system-ui;letter-spacing:.02em;background:rgba(11,13,18,0.85);border:1px solid ${border};border-radius:999px;padding:2px 8px;${x.upcoming ? '' : 'opacity:.85'}`;
        pill.title = `${x.shows} show${x.shows === 1 ? '' : 's'}${x.leads ? ` · ${x.leads} venue${x.leads === 1 ? '' : 's'} in the pipeline` : ''}`;
        pill.onclick = (e) => { e.stopPropagation(); onSelect(x.key); };
        el.style.cssText = 'position:relative;width:0;height:0;pointer-events:none';
        el.appendChild(pill);
        return el;
      });
    const next = placed.find((c) => c.key === nextKey);
    g.ringsData(next ? [next] : []).ringLat('lat').ringLng('lng').ringColor(() => (t: number) => `rgba(143,211,255,${1 - t})`);
  }, [placed, path, nextKey, selectedKey, showLeads]);

  // Fly to the next show when the globe first has dots, and to a card when one is picked.
  useEffect(() => {
    const g = globe.current; if (!g || !placed.length) return;
    const focus = placed.find((c) => c.key === selectedKey);
    if (focus) { g.controls().autoRotate = false; g.pointOfView({ lat: focus.lat, lng: focus.lng, altitude: 1.5 }, 900); return; }
    if (!flown.current) {
      flown.current = true;
      // Spin in, then land on the next show — or the last one played — zoomed so the
      // real route fits. Grab it to spin it yourself.
      const n = placed.find((c) => c.key === nextKey) ?? lastShow(placed) ?? placed[0];
      const lat = n.lat!, lng = n.lng!;
      const fit = upcoming.length > 1 ? upcoming : path.length > 1 ? path : placed;
      const spread = Math.max(...fit.map((c) => Math.hypot(c.lat! - lat, (c.lng! - lng) * Math.cos((lat * Math.PI) / 180))));
      const altitude = Math.min(1.1, Math.max(0.5, 0.15 + spread / 16));
      setTimeout(() => {
        const live = globe.current; if (!live) return;
        live.controls().autoRotate = false;
        live.pointOfView({ lat: lat - 3, lng, altitude }, 1600);
      }, 1800);
    }
  }, [placed, selectedKey, nextKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ───────── callouts: the next few booked shows, a line from the dot to a card at the edge ─────────
  // Played shows stay as gray dots (hover for the money); the picked show always gets a card.
  const shows = useMemo(() => {
    const list = upcoming.slice(0, maxCards);
    const sel = selectedKey ? path.find((c) => c.key === selectedKey) : null;
    if (sel && !list.includes(sel)) list.push(sel);
    return list;
  }, [upcoming, path, maxCards, selectedKey]);
  const wrap = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const cardEls = useRef<Map<string, HTMLDivElement>>(new Map());
  const lineEls = useRef<Map<string, SVGPathElement>>(new Map());
  const [wide, setWide] = useState(true);
  useEffect(() => {
    const check = () => setWide((wrap.current?.clientWidth ?? 1000) >= 640);
    check();
    const ro = new ResizeObserver(check); if (wrap.current) ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const g = globe.current; if (!g || !wide) return;
    let raf = 0;
    const W = () => wrap.current?.clientWidth ?? 0;
    const CARD_W = 168, ROW = 42, PAD = 14;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const w = W(); if (!w) return;
      const cam = g.camera().position;
      const pov = g.pointOfView();
      type P = { key: string; x: number; y: number; vis: boolean; side: 'L' | 'R' };
      const pts: P[] = shows.map((c) => {
        const sc = g.getScreenCoords(c.lat, c.lng, 0.02);
        const p = g.getCoords(c.lat, c.lng, 0.02);
        const len = Math.hypot(p.x, p.y, p.z) || 1;
        const facing = (p.x / len) * (cam.x - p.x) + (p.y / len) * (cam.y - p.y) + (p.z / len) * (cam.z - p.z) > 0;
        const dl = ((c.lng! - pov.lng + 540) % 360) - 180; // east or west of where we're looking
        return { key: c.key, x: sc.x, y: sc.y, vis: facing && sc.x > -40 && sc.x < w + 40 && sc.y > -40 && sc.y < height + 40, side: dl < 0 ? 'L' : 'R' };
      });
      for (const side of ['L', 'R'] as const) {
        const col = pts.filter((p) => p.vis && p.side === side).sort((a, b) => a.y - b.y);
        const avail = height - PAD * 2;
        const rowH = Math.min(ROW, Math.max(24, Math.floor(avail / Math.max(col.length, 1))));
        const ys = col.map((p) => p.y - rowH / 2);
        for (let i = 1; i < ys.length; i++) ys[i] = Math.max(ys[i], ys[i - 1] + rowH);
        for (let i = ys.length - 1; i >= 0; i--) ys[i] = Math.min(ys[i], (i === ys.length - 1 ? height - PAD : ys[i + 1]) - rowH);
        for (let i = 1; i < ys.length; i++) ys[i] = Math.max(ys[i], ys[i - 1] + rowH, PAD);
        col.forEach((p, i) => {
          const el = cardEls.current.get(p.key); const ln = lineEls.current.get(p.key);
          if (!el || !ln) return;
          const top = Math.max(PAD, ys[i]);
          el.style.display = 'block';
          el.style.top = `${top}px`;
          el.style.height = `${rowH - 6}px`;
          el.style.left = side === 'L' ? `${PAD}px` : '';
          el.style.right = side === 'R' ? `${PAD}px` : '';
          const cy = top + (rowH - 6) / 2;
          const edge = side === 'L' ? PAD + CARD_W : w - PAD - CARD_W;
          const elbow = side === 'L' ? edge + 18 : edge - 18;
          ln.setAttribute('d', `M${p.x},${p.y} L${elbow},${cy} L${edge},${cy}`);
          ln.style.display = 'block';
        });
      }
      for (const p of pts) if (!p.vis) { cardEls.current.get(p.key)?.style.setProperty('display', 'none'); lineEls.current.get(p.key)?.style.setProperty('display', 'none'); }
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [shows, wide, height]);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  return (
    <div ref={wrap} style={{ position: 'relative', height, width: '100%' }}>
      <div ref={el} style={{ height, width: '100%', cursor: 'grab' }} aria-label="Tour route on a globe" />
      {wide && (
        <>
          <svg ref={svg} style={{ position: 'absolute', inset: 0, width: '100%', height, pointerEvents: 'none' }}>
            {shows.map((c) => {
              const col = c.key === nextKey ? '#8FD3FF' : isPast(c) ? GRAY : STAGE[c.stage].color;
              return <path key={c.key} ref={(r) => { if (r) lineEls.current.set(c.key, r); else lineEls.current.delete(c.key); }} fill="none" stroke={col} strokeWidth={c.key === nextKey ? 1.6 : 1} strokeOpacity={isPast(c) ? 0.45 : 0.8} style={{ display: 'none' }} />;
            })}
          </svg>
          {shows.map((c) => {
            const past = isPast(c), isNext = c.key === nextKey, on = c.key === selectedKey;
            const col = isNext ? '#8FD3FF' : past ? GRAY : STAGE[c.stage].color;
            const d = parseLocalDate(c.date!)!;
            const days = Math.round((d.getTime() - today.getTime()) / 86_400_000);
            return (
              <div
                key={c.key}
                ref={(r) => { if (r) cardEls.current.set(c.key, r); else cardEls.current.delete(c.key); }}
                onClick={(e) => { e.stopPropagation(); onSelect(c.key); }}
                title={`${c.artist ? c.artist + ' · ' : ''}${c.venue} — ${STAGE[c.stage].label}`}
                style={{
                  position: 'absolute', display: 'none', width: 168, cursor: 'pointer', overflow: 'hidden',
                  background: on ? 'rgba(143,211,255,0.14)' : 'rgba(11,13,18,0.88)', border: `1px solid ${on || isNext ? col : 'rgba(42,48,64,0.9)'}`,
                  borderLeft: `3px solid ${col}`, borderRadius: 8, padding: '3px 8px', boxSizing: 'border-box',
                  textTransform: 'none', letterSpacing: 0, opacity: past ? 0.75 : 1,
                  boxShadow: isNext ? '0 0 14px rgba(143,211,255,0.35)' : 'none',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ font: '700 11px Saira Condensed, system-ui', letterSpacing: '.1em', textTransform: 'uppercase', color: past ? GRAY : col, whiteSpace: 'nowrap' }}>
                    {d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                  <span style={{ font: '600 10px Saira Condensed, system-ui', color: isNext ? '#8FD3FF' : past ? GRAY : '#A8B2C1', whiteSpace: 'nowrap' }}>
                    {isNext ? `NEXT · ${days}d` : past ? (c.moneyKind === 'actual' && c.money != null ? (c.money >= 0 ? `+${short$(c.money)}` : `−${short$(Math.abs(c.money))}`) : 'played') : days === 0 ? 'tonight' : `${days}d`}
                  </span>
                </div>
                <div style={{ font: '600 12px Saira Condensed, system-ui', color: past ? '#C8D6EB' : '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.15 }}>
                  {canonicalCity(c.city) || c.venue}{c.artist ? <span style={{ color: '#8FD3FF' }}> · {c.artist}</span> : <span style={{ color: '#A8B2C1' }}> · {c.venue}</span>}
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

/** Hover card: the event, the date, and whether it made money. */
function tip(c: Card): string {
  const past = isPast(c);
  const when = c.date ? parseLocalDate(c.date)!.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'No date';
  const title = c.artist ? `${esc(c.artist)} · ${esc(c.venue)}` : esc(c.venue);
  const stage = past && c.stage !== 'settled' && isBooked(c.stage) ? 'Played · not settled yet' : past && c.stage === 'settled' ? 'Played' : STAGE[c.stage].label;
  let line = '';
  if (c.money != null) {
    const up = c.money >= 0;
    const word = c.moneyKind === 'actual' ? (up ? 'Made' : 'Lost') : c.moneyKind === 'projected' ? 'Projected' : 'Guess';
    const color = c.moneyKind === 'actual' ? (up ? '#4ADE80' : '#F87171') : '#C8D6EB';
    line = `<div style="margin-top:4px;font-weight:700;color:${color}">${word} ${money$(Math.abs(c.money))}${c.moneyKind === 'actual' ? (up ? ' ✓ profitable' : '') : ''}</div>`;
  } else if (past) line = `<div style="margin-top:4px;color:#C8D6EB">Settle it to see what it made</div>`;
  return `<div style="font:600 12px Saira Condensed,system-ui;background:#14171E;border:1px solid #2A3040;border-radius:8px;padding:6px 9px;color:#fff;max-width:240px">
    <div style="color:${past ? GRAY : '#8FD3FF'};font-size:10px;letter-spacing:.14em;text-transform:uppercase">${esc(canonicalCity(c.city) || '')} · ${stage}</div>
    <div>${title}</div>
    <div style="color:#A8B2C1">${when}</div>${line}</div>`;
}

function drawable(f: any): boolean {
  try {
    const g = f.geometry;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
    for (const p of polys) polygonToCells(p, 3, true);
    return polys.length > 0;
  } catch { return false; }
}

function esc(s: string) { return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string)); }
