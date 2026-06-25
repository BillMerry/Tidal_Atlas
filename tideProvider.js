export async function fetchHighWaterCherbourg() {
  return {
    available: false,
    reason: "Live HW Cherbourg lookup is not configured. Use manual fallback times.",
    highWaters: [],
  };
}

export async function getHighWaters() {
  return fetchHighWaterCherbourg();
}
