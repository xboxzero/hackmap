// Cloudflare Worker: reports what the Cloudflare edge sees about the visitor's connection.
const ORIGINS = ['https://xboxzero.github.io', 'http://localhost:8000', 'http://127.0.0.1:8000'];

export default {
  async fetch(req) {
    const origin = req.headers.get('Origin');
    const cors = {
      'Access-Control-Allow-Origin': ORIGINS.includes(origin) ? origin : ORIGINS[0],
      'Vary': 'Origin',
      'Cache-Control': 'no-store',
    };
    if (req.method === 'OPTIONS') return new Response(null, { headers: { ...cors, 'Access-Control-Allow-Methods': 'GET' } });
    const url = new URL(req.url);
    if (url.pathname !== '/info') return new Response('not found', { status: 404, headers: cors });
    const cf = req.cf || {};
    const body = {
      ip: req.headers.get('CF-Connecting-IP'),
      colo: cf.colo, country: cf.country, city: cf.city, region: cf.region,
      lat: cf.latitude != null ? +cf.latitude : null, lon: cf.longitude != null ? +cf.longitude : null,
      asn: cf.asn, asOrg: cf.asOrganization,
      tls: cf.tlsVersion, cipher: cf.tlsCipher, http: cf.httpProtocol,
      rtt: cf.clientTcpRtt != null ? cf.clientTcpRtt : null,
    };
    return new Response(JSON.stringify(body), { headers: { ...cors, 'content-type': 'application/json' } });
  },
};
