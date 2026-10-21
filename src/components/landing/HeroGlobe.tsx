import { useEffect, useRef } from 'react';
import Globe from 'globe.gl';
import * as THREE from 'three';
import { feature } from 'topojson-client';
import { polygonToCells } from 'h3-js';
import countriesTopo from 'world-atlas/countries-110m.json';

/**
 * The landing-page globe: the same globe the app draws a tour on, spinning slowly behind the
 * headline with a made-up run lit across it. No labels, no clicks — it's the backdrop.
 * Loaded lazily and only on screens wide enough to carry it.
 */
const RUN: [string, number, number][] = [
  ['St. Louis', 38.63, -90.2], ['Kansas City', 39.1, -94.58], ['Chicago', 41.85, -87.65], ['Nashville', 36.17, -86.78],
  ['Atlanta', 33.75, -84.39], ['Birmingham', 33.52, -86.8], ['Orlando', 28.54, -81.38], ['Austin', 30.27, -97.74],
  ['Houston', 29.76, -95.36], ['Monterrey', 25.68, -100.32], ['Guadalajara', 20.68, -103.35], ['Mexico City', 19.43, -99.13],
  ['Phoenix', 33.45, -112.07], ['Denver', 39.74, -104.98], ['Salt Lake City', 40.76, -111.89],
];

export default function HeroGlobe({ className = '' }: { className?: string }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!el.current) return;
    const countries = (feature(countriesTopo as any, (countriesTopo as any).objects.countries) as any).features
      .filter((f: any) => f.id !== '010' && drawable(f));
    const pts = RUN.map(([city, lat, lng], i) => ({ city, lat, lng, i }));
    const arcs = pts.slice(1).map((p, i) => ({ startLat: pts[i].lat, startLng: pts[i].lng, endLat: p.lat, endLng: p.lng }));
    const g = new (Globe as any)(el.current, { animateIn: true })
      .backgroundColor('rgba(0,0,0,0)')
      .showAtmosphere(true).atmosphereColor('#5A8CFF').atmosphereAltitude(0.2)
      .globeMaterial(new THREE.MeshPhongMaterial({ color: '#0E1F5C', emissive: '#0B2FB8', emissiveIntensity: 0.22, shininess: 4 }))
      .hexPolygonsData(countries).hexPolygonResolution(3).hexPolygonMargin(0.58).hexPolygonUseDots(true)
      .hexPolygonColor(() => 'rgba(143,211,255,0.5)')
      .pointsData(pts).pointLat('lat').pointLng('lng').pointAltitude(0.012).pointRadius(0.6).pointResolution(12)
      .pointColor((p: any) => (p.i === 2 ? '#8FD3FF' : p.i < 2 ? '#9AA4B5' : '#4ADE80'))
      .arcsData(arcs).arcColor(() => ['rgba(143,211,255,0.9)', 'rgba(74,222,128,0.9)'])
      .arcStroke(0.55).arcDashLength(0.4).arcDashGap(0.3).arcDashAnimateTime(3000).arcAltitudeAutoScale(0.35)
      .ringsData([pts[2]]).ringLat('lat').ringLng('lng').ringMaxRadius(3).ringPropagationSpeed(2).ringRepeatPeriod(1100)
      .ringColor(() => (t: number) => `rgba(143,211,255,${1 - t})`);
    const c = g.controls();
    c.autoRotate = true; c.autoRotateSpeed = 0.35; c.enableZoom = false; c.enablePan = false; c.enableRotate = false;
    g.pointOfView({ lat: 28, lng: -96, altitude: 1.75 }, 0);
    const fit = () => { if (el.current) g.width(el.current.clientWidth).height(el.current.clientHeight); };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(el.current);
    return () => { ro.disconnect(); try { g._destructor?.(); } catch { /* ignore */ } if (el.current) el.current.innerHTML = ''; };
  }, []);
  return <div ref={el} className={className} aria-hidden="true" style={{ pointerEvents: 'none' }} />;
}

function drawable(f: any): boolean {
  try {
    const g = f.geometry;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
    for (const p of polys) polygonToCells(p, 3, true);
    return polys.length > 0;
  } catch { return false; }
}
