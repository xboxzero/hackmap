// Traceroute backend. Traces ONLY the requester's own public IP (never an arbitrary target).
const http = require('http');
const net = require('net');
const { execFile } = require('child_process');

const PORT = process.env.PORT || 8080;
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || 'https://xboxzero.github.io';
const COOLDOWN_MS = 20000;
const last = new Map();
const geoCache = new Map();
let serverGeo = null;

const isPrivate = ip => /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|0\.)/.test(ip) || /^(::1$|fe80|fc|fd)/i.test(ip);

function clientIp(req) {
  const h = req.headers['fly-client-ip'] || req.headers['cf-connecting-ip'] || (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return (h || req.socket.remoteAddress || '').replace(/^::ffff:/, '');
}

async function geo(ip) {
  if (!ip || isPrivate(ip)) return {};
  if (geoCache.has(ip)) return geoCache.get(ip);
  try {
    const j = await (await fetch('https://ipwho.is/' + ip, { signal: AbortSignal.timeout(5000) })).json();
    const g = j.success ? { lat: j.latitude, lon: j.longitude, city: j.city, country: j.country, asn: j.connection && j.connection.asn, org: j.connection && (j.connection.org || j.connection.isp) } : {};
    geoCache.set(ip, g);
    return g;
  } catch { return {}; }
}

function parse(out) {
  const hops = [];
  for (const line of out.split('\n')) {
    const m = /^\s*(\d+)\s+(.*)$/.exec(line);
    if (!m) continue;
    const ip = (/(\d+\.\d+\.\d+\.\d+|[0-9a-f]*:[0-9a-f:]+)/i.exec(m[2]) || [])[1] || null;
    const rt = /([\d.]+)\s+ms/.exec(m[2]);
    hops.push({ ttl: +m[1], ip, rtt: rt ? +(+rt[1]).toFixed(1) : null });
  }
  return hops;
}

function trace(ip) {
  const args = ['-n', '-q', '1', '-w', '1', '-m', '24'];
  if (net.isIPv6(ip)) args.unshift('-6');
  return new Promise((res, rej) => execFile('traceroute', [...args, ip], { timeout: 40000 }, (err, stdout) => {
    if (!stdout && err) return rej(err);
    res(parse(stdout));
  }));
}

http.createServer(async (req, res) => {
  const head = { 'Access-Control-Allow-Origin': ALLOW_ORIGIN, Vary: 'Origin', 'content-type': 'application/json', 'cache-control': 'no-store' };
  const send = (c, o) => { res.writeHead(c, head); res.end(JSON.stringify(o)); };
  if (req.method === 'OPTIONS') { res.writeHead(204, { ...head, 'Access-Control-Allow-Methods': 'GET' }); return res.end(); }
  const path = req.url.split('?')[0];
  if (path === '/health') return send(200, { ok: true });
  if (path !== '/trace') return send(404, { error: 'not found' });
  const ip = clientIp(req);
  if (!net.isIP(ip) || isPrivate(ip)) return send(400, { error: 'cannot trace non-public address ' + ip });
  const now = Date.now();
  if (now - (last.get(ip) || 0) < COOLDOWN_MS) return send(429, { error: 'rate limited, try again in a few seconds' });
  last.set(ip, now);
  if (last.size > 5000) for (const [k, t] of last) if (now - t > COOLDOWN_MS) last.delete(k);
  try {
    if (!serverGeo) serverGeo = await geo(await (await fetch('https://api.ipify.org')).text());
    const hops = await trace(ip);
    await Promise.all(hops.map(async h => Object.assign(h, await geo(h.ip))));
    send(200, { target: ip, server: serverGeo, hops });
  } catch (e) { send(500, { error: 'traceroute failed: ' + e.message }); }
}).listen(PORT, () => console.log('hackmap trace server on ' + PORT));

module.exports = { parse };
