// Refreshes data/*.json. Run: node scripts/build-data.js
// Cables/landing points: TeleGeography Submarine Cable Map (CC BY-NC-SA 3.0). Facilities: PeeringDB.
const fs = require('fs');
const get = async u => { for (let i = 0; i < 4; i++) { try { const r = await fetch(u); if (r.ok) return r.json(); } catch {} await new Promise(r => setTimeout(r, 1000 * (i + 1))); } throw new Error('failed ' + u); };
const r2 = n => Math.round(n * 100) / 100;
const flat = g => (g.type === 'MultiLineString' ? g.coordinates : [g.coordinates]).map(l => l.map(p => [r2(p[0]), r2(p[1])]));

(async () => {
  const B = 'https://www.submarinecablemap.com/api/v3/';
  const [geo, lp, all] = await Promise.all([get(B + 'cable/cable-geo.json'), get(B + 'landing-point/landing-point-geo.json'), get(B + 'cable/all.json')]);
  const meta = {};
  for (let i = 0; i < all.length; i += 10)
    await Promise.all(all.slice(i, i + 10).map(async c => {
      const d = await get(B + 'cable/' + c.id + '.json');
      meta[c.id] = { n: d.name, len: d.length, own: d.owners, sup: d.suppliers, rfs: d.rfs, plan: !!d.is_planned, url: d.url, lps: (d.landing_points || []).map(l => l.id) };
    }));
  const cables = {};
  geo.features.forEach(f => { const id = f.properties.id; (cables[id] = cables[id] || { id, c: f.properties.color, p: [] }).p.push(...flat(f.geometry)); });
  const landing = lp.features.filter(f => f.geometry && f.geometry.type === 'Point').map(f => ({ id: f.properties.id, n: f.properties.name, x: r2(f.geometry.coordinates[0]), y: r2(f.geometry.coordinates[1]) }));
  fs.writeFileSync('data/cables.json', JSON.stringify({ cables: Object.values(cables), meta, landing }));

  const fac = (await get('https://www.peeringdb.com/api/fac?depth=0&status=ok')).data
    .filter(f => f.latitude != null && f.longitude != null && (f.latitude || f.longitude))
    .map(f => ({ n: f.name, o: f.org_name, x: +(+f.longitude).toFixed(4), y: +(+f.latitude).toFixed(4), c: f.city, k: f.country, a: [f.address1, f.zipcode].filter(Boolean).join(', '), w: f.website || '', nets: f.net_count, ix: f.ix_count, car: f.carrier_count }));
  fs.writeFileSync('data/facilities.json', JSON.stringify(fac));
  console.log(Object.keys(cables).length, 'cables', landing.length, 'landings', fac.length, 'facilities');
})();
