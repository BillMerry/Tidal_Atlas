# Tidal Atlas Tide Proxy

Cloudflare Worker used by the public GitHub Pages PWA to call WorldTides without exposing the API key in browser JavaScript.

## Deploy

From this folder:

```sh
wrangler secret put WORLDTIDES_API_KEY
wrangler deploy
```

The endpoint exposed to the app is:

```text
https://<worker-url>/high-waters?date=2026-06-27&before=2&after=4
```

The Worker returns only high-water times for Cherbourg, plus source/attribution metadata.
