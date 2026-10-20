import { useEffect, useMemo, useRef } from 'react';
import Globe from 'globe.gl';
import * as THREE from 'three';
import { feature } from 'topojson-client';
import { polygonToCells } from 'h3-js';
import countriesTopo from 'world-atlas/countries-110m.json';
import { STAGE, route, type Card } from '../../lib/tourPipeline';

/**
 * The tour on a spinning globe, in the house CRT blue: land as glowing dots, the route as a
 * moving line between the shows in date order, each show a dot in its stage color, the next
 * show pulsing. Drag to spin, scroll / pinch to zoom, tap a dot to open its card.
 * Loaded lazily — three.js is heavy and only this page needs it.
 */
export default function TourGlobe({ cards, nextKey, selectedKey, onSelect, height = 420 }: {
  cards: Card[]; nextKey: string | null; selectedKey: string | null; onSelect: (key: string) => void; height?: number;
}) {
  const el = useRef<HTMLDivElement>(null);
  const globe = useRef<any>(null);
  const flown = useRef(false);
  const placed = useMemo(() => cards.filter((c) => c.lat != null && c.lng != null), [cards]);
  const path = useMemo(() => route(placed), [placed]);

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
      .labelSize(1.15).labelDotRadius(0).labelAltitude(0.015).labelResolution(2)
      .labelColor(() => 'rgba(255,255,255,0.9)')
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
    // The route in date order; a night in the same city as the one before draws no line.
    const arcs = path.slice(1).map((c, i) => ({
      startLat: path[i].lat, startLng: path[i].lng, endLat: c.lat, endLng: c.lng,
      color: [STAGE[path[i].stage].color, STAGE[c.stage].color],
    })).filter((a) => Math.abs(a.startLat! - a.endLat!) + Math.abs(a.startLng! - a.endLng!) > 0.05);
    // One label per city, with how many shows land there.
    const spots = new Map<string, { lat: number; lng: number; city: string; n: number; key: string }>();
    for (const c of placed) {
      if (c.stage === 'dead') continue;
      const k = `${c.lat!.toFixed(1)},${c.lng!.toFixed(1)}`;
      const s = spots.get(k);
      if (s) s.n++; else spots.set(k, { lat: c.lat!, lng: c.lng!, city: c.city || c.venue, n: 1, key: c.key });
    }
    g.pointsData(placed)
      .pointLat('lat').pointLng('lng')
      .pointColor((c: Card) => (c.key === selectedKey ? '#FFFFFF' : STAGE[c.stage].color))
      .pointRadius((c: Card) => (c.key === selectedKey || c.key === nextKey ? 1.05 : c.stage === 'dead' ? 0.4 : 0.75))
      .pointLabel((c: Card) => `<div style="font:600 12px Saira Condensed,system-ui;background:#14171E;border:1px solid #2A3040;border-radius:8px;padding:6px 8px;color:#fff">${esc(c.city)} · ${esc(c.venue)}<br><span style="color:${STAGE[c.stage].color}">${STAGE[c.stage].label}</span>${c.date ? ` · ${c.date}` : ''}</div>`);
    g.arcsData(arcs).arcColor('color');
    g.labelsData([...spots.values()]).labelLat('lat').labelLng('lng').labelText((s: any) => (s.n > 1 ? `${s.city} (${s.n})` : s.city));
    const next = placed.find((c) => c.key === nextKey);
    g.ringsData(next ? [next] : []).ringLat('lat').ringLng('lng').ringColor(() => (t: number) => `rgba(143,211,255,${1 - t})`);
  }, [placed, path, nextKey, selectedKey]);

  // Fly to the route when it first has dots, and to a card when one is picked.
  useEffect(() => {
    const g = globe.current; if (!g || !placed.length) return;
    const focus = placed.find((c) => c.key === selectedKey);
    if (focus) { g.controls().autoRotate = false; g.pointOfView({ lat: focus.lat, lng: focus.lng, altitude: 1.5 }, 900); return; }
    if (!flown.current) {
      flown.current = true;
      // Spin in, then land on the next show (or the middle of the route) and hold there
      // so the run is in view. Grab it to spin it yourself.
      // Frame the whole route, leaning toward the next show; zoom to how spread out it is.
      const n = placed.find((c) => c.key === nextKey);
      const cLat = placed.reduce((s, c) => s + c.lat!, 0) / placed.length;
      const cLng = placed.reduce((s, c) => s + c.lng!, 0) / placed.length;
      const lat = n ? (cLat + n.lat!) / 2 : cLat;
      const lng = n ? (cLng + n.lng!) / 2 : cLng;
      const spread = Math.max(...placed.map((c) => Math.hypot(c.lat! - lat, (c.lng! - lng) * Math.cos((lat * Math.PI) / 180))));
      const altitude = Math.min(2.2, Math.max(0.6, 0.2 + spread / 17));
      setTimeout(() => {
        const live = globe.current; if (!live) return;
        live.controls().autoRotate = false;
        live.pointOfView({ lat: lat - 3, lng, altitude }, 1600);
      }, 1800);
    }
  }, [placed, selectedKey, nextKey]);

  return <div ref={el} style={{ height, width: '100%', cursor: 'grab' }} aria-label="Tour route on a globe" />;
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
