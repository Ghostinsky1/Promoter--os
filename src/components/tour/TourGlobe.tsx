import { useEffect, useMemo, useRef } from 'react';
import Globe from 'globe.gl';
import * as THREE from 'three';
import { feature } from 'topojson-client';
import { polygonToCells } from 'h3-js';
import countriesTopo from 'world-atlas/countries-110m.json';
import { STAGE, route, lastShow, canonicalCity, isBooked, isPast, money$, type Card } from '../../lib/tourPipeline';
import { parseLocalDate } from '../../lib/dateHelpers';

const GRAY = '#9AA4B5';

/**
 * The tour on a spinning globe, in the house CRT blue. Where we've been is light gray; what's
 * coming is lit in its stage color, the next show pulsing, the route drawn between the real
 * shows in date order. Hover a dot: the event, the date, and whether it made money.
 * Drag to spin, scroll / pinch to zoom, tap a dot to open its card.
 * Loaded lazily — three.js is heavy and only the pages that show it need it.
 */
export default function TourGlobe({ cards, nextKey, selectedKey, onSelect, height = 420 }: {
  cards: Card[]; nextKey: string | null; selectedKey: string | null; onSelect: (key: string) => void; height?: number;
}) {
  const el = useRef<HTMLDivElement>(null);
  const globe = useRef<any>(null);
  const flown = useRef(false);
  const placed = useMemo(() => cards.filter((c) => c.lat != null && c.lng != null), [cards]);
  // The line runs through the real shows; leads are dots only.
  const path = useMemo(() => route(placed, true), [placed]);

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
      .labelDotRadius(0).labelAltitude(0.015).labelResolution(2)
      .onPointClick((p: any) => onSelect(p.key))
      .onLabelClick((p: any) => onSelect(p.key));
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
    // Labels that would sit on top of each other get nudged down, one row at a time.
    const text = (x: any) => `${x.city}${x.shows > 1 ? ` (${x.shows})` : ''}${x.leads && !x.shows ? ` · ${x.leads} looking` : x.leads ? ` +${x.leads}` : ''}`;
    const labels = [...spots.values()].sort((a, b) => b.lat - a.lat).map((x) => ({ ...x, labelLat: x.lat, text: text(x), size: x.upcoming ? 1.0 : 0.8 }));
    for (let pass = 0; pass < 4; pass++) {
      for (let i = 0; i < labels.length; i++) {
        for (let j = 0; j < i; j++) {
          const a = labels[j], b = labels[i];
          const rowH = Math.max(a.size, b.size) * 1.9;
          const wide = (a.text.length * a.size + b.text.length * b.size) * 0.3; // rough text width in degrees
          if (Math.abs(b.labelLat - a.labelLat) < rowH && Math.abs(b.lng - a.lng) < wide) b.labelLat = a.labelLat - rowH;
        }
      }
    }
    g.pointsData(placed)
      .pointLat('lat').pointLng('lng')
      .pointColor(colorOf)
      .pointRadius((c: Card) => (c.key === selectedKey || c.key === nextKey ? 1.05 : isPast(c) ? 0.5 : isBooked(c.stage) ? 0.75 : 0.45))
      .pointLabel(tip);
    g.arcsData(arcs).arcColor('color');
    g.labelsData(labels).labelLat('labelLat').labelLng('lng').labelText('text').labelSize('size')
      .labelColor((x: any) => (x.upcoming ? 'rgba(255,255,255,0.95)' : x.shows ? 'rgba(154,164,181,0.8)' : 'rgba(200,214,235,0.7)'));
    const next = placed.find((c) => c.key === nextKey);
    g.ringsData(next ? [next] : []).ringLat('lat').ringLng('lng').ringColor(() => (t: number) => `rgba(143,211,255,${1 - t})`);
  }, [placed, path, nextKey, selectedKey]);

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
      const fit = path.length > 1 ? path : placed;
      const spread = Math.max(...fit.map((c) => Math.hypot(c.lat! - lat, (c.lng! - lng) * Math.cos((lat * Math.PI) / 180))));
      const altitude = Math.min(1.1, Math.max(0.5, 0.15 + spread / 16));
      setTimeout(() => {
        const live = globe.current; if (!live) return;
        live.controls().autoRotate = false;
        live.pointOfView({ lat: lat - 3, lng, altitude }, 1600);
      }, 1800);
    }
  }, [placed, selectedKey, nextKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={el} style={{ height, width: '100%', cursor: 'grab' }} aria-label="Tour route on a globe" />;
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
