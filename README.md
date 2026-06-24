# North Brittany Tidal Atlas PWA

Private Progressive Web App for viewing 12 North Brittany tidal atlas chart images by offset from High Water Cherbourg.

The current version is deliberately simple: vanilla HTML, CSS, and JavaScript, no build chain, and manual HW Cherbourg date/time entry. It is suitable for GitHub Pages hosting.

## Repository Structure

```text
.
├── index.html
├── styles.css
├── app.js
├── tideProvider.js
├── manifest.json
├── service-worker.js
├── charts/
│   ├── 1 Cherbourg -5 Brest-1.png
│   ├── ...
│   └── 12 Cherbourg +6 Brest-2.png
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

## Features

- Shows one chart at a time from HW Cherbourg -5 through HW Cherbourg +6.
- Accepts up to four consecutive HW Cherbourg date/time entries.
- Calculates each chart's valid date/time from the active HW Cherbourg cycle.
- Uses UK date format and a 24-hour clock.
- Supports Previous and Next buttons.
- Supports keyboard left/right arrow navigation.
- Supports horizontal swipe navigation on touch devices.
- Includes a Nearest now button when the current time falls inside the entered HW cycles.
- Stores the last-used HW Cherbourg date/time entries in local storage.
- Caches the app shell and chart images for offline use after first load.

## Local Use

Open the folder with a small local web server. For example:

```sh
python3 -m http.server 8000
```

Then visit:

```text
http://localhost:8000/
```

Service workers require a secure context. They work on `localhost` for testing and on HTTPS when hosted through GitHub Pages.

## GitHub Pages Deployment

1. Create a private or public GitHub repository.
2. Add these files to the repository.
3. Commit and push to GitHub.
4. In GitHub, open **Settings > Pages**.
5. Under **Build and deployment**, choose **Deploy from a branch**.
6. Select the branch, usually `main`, and folder `/root`.
7. Save, then open the Pages URL once deployment completes.

For private chart assets, keep the repository private unless you have confirmed the rights to publish the chart images.

## Chart Asset Notes

The chart images are treated as private assets. This repository does not grant permission to redistribute them, publish them, or use them as official navigation products. Confirm chart licensing before making any public deployment.

This app is a passage-planning/reference aid only. Navigation decisions should be checked against official publications, tide tables, notices, weather, and conditions observed aboard.

## Tide Lookup Notes

Manual entry is the reliable fallback and is the only implemented HW Cherbourg source in this version.

The app includes `tideProvider.js` as the future integration point for automatic lookup. A future provider should return a trusted HW Cherbourg date/time while leaving manual entry available.

Current live lookup routes to investigate:

- **SHOM**: likely the most authoritative French source. SHOM documents two tide prediction services, SUP Marée for prediction by site and SAPM for prediction at any point. Access requires a subscription key purchased from the SHOM shop. SHOM describes functions for high/low water times and heights, stepped heights, and threshold calculations. A server-side proxy may be needed if credentials must be protected or if CORS blocks direct browser requests.
- **WorldTides API**: commercial API with API keys, credits, and usage terms. It can return high/low tide extremes for a location, but a public GitHub Pages app should not expose a private API key. WorldTides also places limits on sharing/caching prediction results across multiple users, so caching needs to be per-user and within their terms.
- **Other tide prediction services**: only use sources with clear licensing, attribution rules, and permission for the intended private/offline use.

Because GitHub Pages is static hosting, any provider needing a secret API key should not be called directly from the browser. The usual architecture is:

1. Keep manual input in the PWA.
2. Add a separate provider function in `tideProvider.js`.
3. If needed, call a small backend/serverless endpoint that holds API credentials.
4. Cache successful predictions locally for offline use.

Recommended next smart-version path:

1. Choose a legal source for HW Cherbourg predictions.
2. Prefer SHOM if a SUP Marée/SAPM subscription is acceptable.
3. Add a small private proxy endpoint, for example a serverless function, to hold the API key.
4. Have `tideProvider.js` fetch the next 2-4 HW Cherbourg times and pre-fill the manual HW entries.
5. Keep the manual entries editable so the app still works offline or when the provider is unavailable.

## Replacing Charts

To replace charts, add new PNGs to `charts/` and update `chartDefinitions` in `app.js`. Keep one entry per offset from `-5` to `+6`, or extend the list if you later add more atlas pages.
