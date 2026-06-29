const WORLD_TIDES_URL = "https://www.worldtides.info/api/v3";

const corsHeaders = (origin, allowedOrigin) => ({
  "Access-Control-Allow-Origin": origin === allowedOrigin ? origin : allowedOrigin,
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
});

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": status === 200 ? "public, max-age=1800" : "no-store",
      ...headers,
    },
  });
}

function parseDateParam(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return null;
  return value;
}

function clampInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function toApiDate(date) {
  return date.toISOString().slice(0, 10);
}

function parseWorldTidesDate(extreme) {
  if (typeof extreme.dt === "number") return new Date(extreme.dt * 1000);
  if (typeof extreme.date === "string") {
    const normalised = extreme.date.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
    return new Date(normalised);
  }
  return null;
}

function isHighWater(extreme) {
  return String(extreme.type || extreme.event || "").toLowerCase() === "high";
}

function isLowWater(extreme) {
  return String(extreme.type || extreme.event || "").toLowerCase() === "low";
}

function normaliseWorldTidesExtremes(extremes) {
  return (extremes || [])
    .map((extreme) => ({
      date: parseWorldTidesDate(extreme),
      type: isHighWater(extreme) ? "high" : isLowWater(extreme) ? "low" : "unknown",
      heightMetres: Number.isFinite(Number(extreme.height)) ? Number(extreme.height) : null,
    }))
    .filter((event) => event.date && !Number.isNaN(event.date.getTime()) && event.type !== "unknown")
    .sort((a, b) => a.date - b.date);
}

function buildHighWaterDetails(events, coefficientRangeUnit) {
  return events
    .filter((event) => event.type === "high")
    .map((high) => {
      const nextLow = events.find((event) => event.type === "low" && event.date > high.date);
      const rangeMetres = high.heightMetres !== null && nextLow?.heightMetres !== null
        ? high.heightMetres - nextLow.heightMetres
        : null;
      const coefficientEstimate = rangeMetres !== null && coefficientRangeUnit > 0
        ? Math.round((rangeMetres / coefficientRangeUnit) * 100)
        : null;

      return {
        date: high.date.toISOString(),
        heightMetres: high.heightMetres,
        nextLowWater: nextLow ? {
          date: nextLow.date.toISOString(),
          heightMetres: nextLow.heightMetres,
        } : null,
        rangeMetres,
        coefficientEstimate,
      };
    });
}

async function fetchWorldTides(requestUrl, env) {
  if (!env.WORLDTIDES_API_KEY) {
    return jsonResponse({
      available: false,
      reason: "WorldTides API key is not configured for this Worker.",
      highWaters: [],
    }, 503);
  }

  const date = parseDateParam(requestUrl.searchParams.get("date"));
  if (!date) {
    return jsonResponse({
      available: false,
      reason: "Use a date query parameter in YYYY-MM-DD format.",
      highWaters: [],
    }, 400);
  }

  const before = clampInteger(requestUrl.searchParams.get("before"), 2, 0, 7);
  const after = clampInteger(requestUrl.searchParams.get("after"), 4, 1, 14);
  const anchor = new Date(`${date}T00:00:00Z`);
  const start = new Date(anchor);
  start.setUTCDate(start.getUTCDate() - before);
  const days = Math.min(16, before + after + 1);

  const upstreamUrl = new URL(WORLD_TIDES_URL);
  upstreamUrl.searchParams.set("extremes", "");
  upstreamUrl.searchParams.set("lat", env.CHERBOURG_LAT || "49.645");
  upstreamUrl.searchParams.set("lon", env.CHERBOURG_LON || "-1.625");
  upstreamUrl.searchParams.set("date", toApiDate(start));
  upstreamUrl.searchParams.set("days", String(days));
  upstreamUrl.searchParams.set("localtime", "");
  upstreamUrl.searchParams.set("key", env.WORLDTIDES_API_KEY);

  const response = await fetch(upstreamUrl, {
    headers: { "Accept": "application/json" },
  });
  const data = await response.json();

  if (!response.ok || data.status !== 200) {
    return jsonResponse({
      available: false,
      source: "WorldTides",
      reason: data.error || data.message || `WorldTides returned HTTP ${response.status}.`,
      highWaters: [],
    }, 502);
  }

  const events = normaliseWorldTidesExtremes(data.extremes);
  const coefficientRangeUnit = Number(env.COEFFICIENT_RANGE_UNIT_METRES || "6.1");
  const highWaterDetails = buildHighWaterDetails(events, coefficientRangeUnit);
  const highWaters = highWaterDetails.map((event) => event.date);

  return jsonResponse({
    available: highWaters.length > 0,
    source: "WorldTides",
    port: "Cherbourg",
    request: {
      date,
      before,
      after,
      days,
      lat: env.CHERBOURG_LAT || "49.645",
      lon: env.CHERBOURG_LON || "-1.625",
    },
    highWaters,
    highWaterDetails,
    coefficient: {
      available: highWaterDetails.some((event) => event.coefficientEstimate !== null),
      label: "Estimated coefficient",
      rangeUnitMetres: coefficientRangeUnit,
      note: "Estimated from WorldTides predicted Cherbourg high-to-following-low range. This is not an official SHOM tidal coefficient.",
    },
    attribution: data.copyright || "Tide predictions by WorldTides.",
  });
}

export default {
  async fetch(request, env) {
    const requestUrl = new URL(request.url);
    const allowedOrigin = env.ALLOWED_ORIGIN || "https://billmerry.github.io";
    const origin = request.headers.get("Origin") || allowedOrigin;
    const headers = corsHeaders(origin, allowedOrigin);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    if (request.method !== "GET") {
      return jsonResponse({ reason: "Method not allowed." }, 405, headers);
    }

    if (requestUrl.pathname !== "/high-waters") {
      return jsonResponse({
        name: "North Brittany Tidal Atlas tide proxy",
        endpoints: ["/high-waters?date=YYYY-MM-DD&before=2&after=4"],
      }, 200, headers);
    }

    const response = await fetchWorldTides(requestUrl, env);
    const responseHeaders = new Headers(response.headers);
    Object.entries(headers).forEach(([key, value]) => responseHeaders.set(key, value));

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  },
};
