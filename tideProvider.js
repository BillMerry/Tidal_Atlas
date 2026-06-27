const defaultEndpoint = "https://tidal-atlas-tides.bill-merry-52f.workers.dev/high-waters";

function getEndpoint() {
  return localStorage.getItem("tidal-atlas.tide-endpoint") || defaultEndpoint;
}

export async function fetchHighWaterCherbourg(options = {}) {
  const endpoint = new URL(getEndpoint());
  endpoint.searchParams.set("date", options.date);
  endpoint.searchParams.set("before", String(options.before ?? 2));
  endpoint.searchParams.set("after", String(options.after ?? 4));

  const response = await fetch(endpoint);
  const payload = await response.json();

  if (!response.ok) {
    return {
      available: false,
      source: payload.source || "WorldTides",
      reason: payload.reason || `Tide lookup failed with HTTP ${response.status}.`,
      highWaters: [],
    };
  }

  return payload;
}

export async function getHighWaters(options) {
  return fetchHighWaterCherbourg(options);
}
