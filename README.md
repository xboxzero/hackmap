# HackMap

3D live internet map (globe.gl): your IP/ISP, Cloudflare edge, real RTT/jitter/loss, animated packets,
raw byte inspector (hex/base64/DNS wire codec), connection security score, nearby telecom infrastructure,
and (with the backend) a real traceroute.

Works as a static site on GitHub Pages (Settings → Pages → Deploy from branch → main, root) with no backend. Optional backends, set in `config.js`:

## 1. Edge info Worker (free) - `worker/`
    cd worker && npx wrangler deploy
Put the printed URL in `INFO_API`. Adds edge-observed TLS cipher, TCP RTT, ASN.

## 2. Traceroute server - `server/`
Traces from the server to the visitor's own IP only (rate limited, 1 per 20 s per IP).
    cd server && fly launch --copy-config --no-deploy && fly deploy
Put the URL in `TRACE_API`. Set `ALLOW_ORIGIN` in `fly.toml` if the site origin differs.
Any Docker host works (`server/Dockerfile`). This is the server-to-visitor path, not the visitor's outbound path.

## Data
`data/cables.json` (submarine cables, owners, landing stations: TeleGeography Submarine Cable Map, CC BY-NC-SA 3.0, non-commercial)
and `data/facilities.json` (data centres/exchanges and their companies: PeeringDB) are static snapshots.
Refresh with `node scripts/build-data.js`. Cell towers are loaded live from OpenStreetMap (Overpass) when zoomed in.
