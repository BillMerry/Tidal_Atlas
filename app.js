import { getHighWaters } from "./tideProvider.js";

const appVersion = "v0.11";
const storageKey = "tidal-atlas.smart-state";
const legacyStorageKey = "tidal-atlas.hw-cherbourg";
const maxManualHighWaters = 8;
const fetchEdgeThreshold = 6;

const chartDefinitions = [
  { offset: -5, file: "1 Cherbourg -5 Brest-1.png" },
  { offset: -4, file: "2 Cherbourg -4 Brest-H-W.png" },
  { offset: -3, file: "3 Cherbourg -3 Brest-+-1.png" },
  { offset: -2, file: "4 Cherbourg -2 Brest-+-2.png" },
  { offset: -1, file: "5 Cherbourg -1 Brest-+-3.png" },
  { offset: 0, file: "6 Cherbourg - 0 HW Brest-+-4.png" },
  { offset: 1, file: "7 Cherbourg +1 Brest-+-5.png" },
  { offset: 2, file: "8 Cherbourg +2 Brest-+-6.png" },
  { offset: 3, file: "9 Cherbourg +3 Brest-5.png" },
  { offset: 4, file: "10 Cherbourg +4 Brest-4.png" },
  { offset: 5, file: "11 Cherbourg +5 Brest-3.png" },
  { offset: 6, file: "12 Cherbourg +6 Brest-2.png" },
];

const state = {
  planningDate: new Date(),
  currentPageIndex: 0,
  highWaters: [],
  source: "manual",
  providerMessage: "",
  isLoading: false,
};

const elements = {
  planningForm: document.querySelector("#planningForm"),
  planningDate: document.querySelector("#planningDate"),
  loadSmartButton: document.querySelector("#loadSmartButton"),
  demoButton: document.querySelector("#demoButton"),
  form: document.querySelector("#hwForm"),
  cycleInputs: document.querySelector("#cycleInputs"),
  addCycleButton: document.querySelector("#addCycleButton"),
  manualPanel: document.querySelector("#manualPanel"),
  providerStatus: document.querySelector("#providerStatus"),
  prevButton: document.querySelector("#prevButton"),
  nextButton: document.querySelector("#nextButton"),
  nowButton: document.querySelector("#nowButton"),
  installButton: document.querySelector("#installButton"),
  chartSelect: document.querySelector("#chartSelect"),
  offsetLabel: document.querySelector("#offsetLabel"),
  validTime: document.querySelector("#validTime"),
  referenceTime: document.querySelector("#referenceTime"),
  coefficientLabel: document.querySelector("#coefficientLabel"),
  pageCounter: document.querySelector("#pageCounter"),
  chartFrame: document.querySelector("#chartFrame"),
  chartImage: document.querySelector("#chartImage"),
  chartCaption: document.querySelector("#chartCaption"),
  appVersion: document.querySelector("#appVersion"),
};

let installPrompt = null;
let touchStartX = 0;
let touchStartY = 0;

function pad(value) {
  return String(value).padStart(2, "0");
}

function toDateInputValue(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toTimeInputValue(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseLocalDateTime(dateValue, timeValue) {
  if (!dateValue || !timeValue) return null;
  const [year, month, day] = dateValue.split("-").map(Number);
  const [hour, minute] = timeValue.split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute);
}

function parsePlanningDate(dateValue) {
  if (!dateValue) return new Date();
  const [year, month, day] = dateValue.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addHours(date, hours) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatOffset(offset) {
  if (offset === 0) return "HW Cherbourg";
  return `HW Cherbourg ${offset > 0 ? "+" : ""}${offset}`;
}

function formatDateTime(date) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

function formatShortTime(date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

function formatClock(date) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

function normaliseHighWaters(highWaters) {
  const byMinute = new Map();

  highWaters
    .map(toHighWaterDate)
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => a - b)
    .forEach((date) => {
      const key = Math.round(date.getTime() / 60000);
      byMinute.set(key, date);
    });

  return [...byMinute.values()].sort((a, b) => a - b);
}

function toHighWaterDate(value) {
  const sourceDate = value?.date || value?.time || value;
  const date = new Date(sourceDate);

  if (Number.isNaN(date.getTime())) return date;

  if (value && typeof value === "object") {
    const coefficientEstimate = Number(value.coefficientEstimate);
    const rangeMetres = Number(value.rangeMetres);
    const heightMetres = Number(value.heightMetres);

    if (Number.isFinite(coefficientEstimate)) date.coefficientEstimate = coefficientEstimate;
    if (Number.isFinite(rangeMetres)) date.rangeMetres = rangeMetres;
    if (Number.isFinite(heightMetres)) date.heightMetres = heightMetres;
    if (value.nextLowWater) date.nextLowWater = value.nextLowWater;
  }

  return date;
}

function getPages() {
  return state.highWaters.flatMap((hwDateTime, hwIndex) => (
    chartDefinitions.map((chart) => ({
      chart,
      hwIndex,
      hwDateTime,
      validDate: addHours(hwDateTime, chart.offset),
    }))
  ));
}

function currentPage() {
  const pages = getPages();
  if (!pages.length) return null;
  state.currentPageIndex = Math.min(Math.max(0, state.currentPageIndex), pages.length - 1);
  return pages[state.currentPageIndex];
}

function findNearestPageIndex(targetDate) {
  const pages = getPages();
  if (!pages.length) return 0;

  let nearestIndex = 0;
  let nearestGap = Infinity;

  pages.forEach((page, index) => {
    const gap = Math.abs(page.validDate.getTime() - targetDate.getTime());
    if (gap < nearestGap) {
      nearestIndex = index;
      nearestGap = gap;
    }
  });

  return nearestIndex;
}

function serialiseHighWaters() {
  return state.highWaters.map((date) => ({
    date: toDateInputValue(date),
    time: toTimeInputValue(date),
    coefficientEstimate: date.coefficientEstimate,
    rangeMetres: date.rangeMetres,
    heightMetres: date.heightMetres,
    nextLowWater: date.nextLowWater,
  }));
}

function saveState() {
  if (state.source === "demo") return;

  localStorage.setItem(storageKey, JSON.stringify({
    planningDate: toDateInputValue(state.planningDate),
    highWaters: serialiseHighWaters(),
    source: state.source,
  }));
}

function createDemoHighWaters(anchorDate) {
  const first = new Date(anchorDate);
  first.setDate(first.getDate() - 1);
  first.setHours(23, 50, 0, 0);

  return Array.from({ length: 8 }, (_, index) => (
    addHours(first, index * 12.42)
  ));
}

function readJsonStorage(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

function parseStoredHighWaters(savedHighWaters) {
  return (savedHighWaters || [])
    .map((item) => {
      const date = parseLocalDateTime(item.date, item.time);
      if (!date) return null;

      if (Number.isFinite(Number(item.coefficientEstimate))) {
        date.coefficientEstimate = Number(item.coefficientEstimate);
      }
      if (Number.isFinite(Number(item.rangeMetres))) {
        date.rangeMetres = Number(item.rangeMetres);
      }
      if (Number.isFinite(Number(item.heightMetres))) {
        date.heightMetres = Number(item.heightMetres);
      }
      if (item.nextLowWater) date.nextLowWater = item.nextLowWater;

      return date;
    })
    .filter(Boolean);
}

function formatCoefficient(date) {
  const parts = [];

  if (Number.isFinite(date.coefficientEstimate)) {
    parts.push(`Coef est. ${Math.round(date.coefficientEstimate)}`);
  }
  if (Number.isFinite(date.rangeMetres)) {
    parts.push(`range ${date.rangeMetres.toFixed(1)}m`);
  }

  return parts.join(" · ");
}

function loadState() {
  const saved = readJsonStorage(storageKey);
  const legacy = readJsonStorage(legacyStorageKey);
  const today = new Date();

  state.planningDate = parsePlanningDate(saved?.planningDate || toDateInputValue(today));
  state.source = saved?.source === "smart" ? "smart" : "manual";
  state.highWaters = saved?.source === "demo"
    ? []
    : normaliseHighWaters(
      parseStoredHighWaters(saved?.highWaters || saved?.cycles || legacy?.cycles)
    );

  elements.planningDate.value = toDateInputValue(state.planningDate);

  if (saved?.source === "demo") {
    localStorage.removeItem(storageKey);
    elements.manualPanel.open = false;
    state.providerMessage = "Old demo data was cleared. Press Load tides for WorldTides HW Cherbourg.";
  } else if (!state.highWaters.length) {
    elements.manualPanel.open = true;
    state.providerMessage = "Press Load tides for WorldTides HW Cherbourg, or add manual HW times to use the atlas offline.";
  } else if (state.source === "smart") {
    state.providerMessage = "Saved WorldTides HW Cherbourg times. Press Load tides to refresh.";
  } else {
    state.providerMessage = "Saved manual fallback times. Press Load tides for WorldTides HW Cherbourg.";
  }
}

function renderManualInputs() {
  elements.cycleInputs.innerHTML = "";

  state.highWaters.forEach((date, index) => {
    const row = document.createElement("div");
    const label = document.createElement("span");
    const dateLabel = document.createElement("label");
    const timeLabel = document.createElement("label");
    const dateInput = document.createElement("input");
    const timeInput = document.createElement("input");
    const removeButton = document.createElement("button");

    row.className = "cycle-row";
    label.className = "cycle-label";
    label.textContent = `HW ${index + 1}`;

    dateLabel.textContent = "Date";
    timeLabel.textContent = "Time";

    dateInput.type = "date";
    dateInput.required = true;
    dateInput.value = toDateInputValue(date);

    timeInput.type = "time";
    timeInput.required = true;
    timeInput.value = toTimeInputValue(date);

    dateLabel.append(dateInput);
    timeLabel.append(timeInput);

    removeButton.type = "button";
    removeButton.className = "remove-cycle";
    removeButton.textContent = "X";
    removeButton.setAttribute("aria-label", `Remove HW ${index + 1}`);
    removeButton.disabled = state.highWaters.length === 1;
    removeButton.addEventListener("click", () => {
      state.highWaters.splice(index, 1);
      state.highWaters = normaliseHighWaters(state.highWaters);
      state.currentPageIndex = Math.min(state.currentPageIndex, getPages().length - 1);
      state.source = "manual";
      state.providerMessage = "Using manual HW Cherbourg fallback times.";
      saveState();
      render();
    });

    row.append(label, dateLabel, timeLabel, removeButton);
    elements.cycleInputs.append(row);
  });

  elements.addCycleButton.disabled = state.highWaters.length >= maxManualHighWaters;
}

function renderChartSelect() {
  const pages = getPages();
  elements.chartSelect.innerHTML = "";

  pages.forEach((page, index) => {
    const option = document.createElement("option");
    const coefficientText = Number.isFinite(page.hwDateTime.coefficientEstimate)
      ? ` · coef ~${Math.round(page.hwDateTime.coefficientEstimate)}`
      : "";
    option.value = String(index);
    option.textContent = `HW ${page.hwIndex + 1} · ${formatOffset(page.chart.offset)} · chart ${formatShortTime(page.validDate)}${coefficientText}`;
    option.selected = index === state.currentPageIndex;
    elements.chartSelect.append(option);
  });
}

function renderStatus() {
  const count = state.highWaters.length;
  const sourceLabel = state.source === "smart"
    ? "WorldTides HW Cherbourg"
    : state.source === "demo"
      ? "DEMO ONLY"
      : "Manual fallback";
  const coverage = count
    ? `${count} HW time${count === 1 ? "" : "s"} loaded`
    : "No HW times loaded";

  elements.providerStatus.textContent = state.isLoading
    ? "Loading HW Cherbourg times from WorldTides..."
    : `${sourceLabel}. ${coverage}. ${state.providerMessage}`;
}

function render() {
  renderManualInputs();
  renderChartSelect();
  renderStatus();

  const pages = getPages();
  const page = currentPage();

  if (!page) {
    elements.offsetLabel.textContent = "HW Cherbourg";
    elements.validTime.textContent = "Choose a planning date";
    elements.referenceTime.textContent = "Smart lookup is awaiting a provider";
    elements.coefficientLabel.textContent = "";
    elements.pageCounter.textContent = "";
    elements.chartImage.removeAttribute("src");
    elements.chartCaption.textContent = "Open Manual HW fallback to enter known Cherbourg HW times.";
    elements.prevButton.disabled = true;
    elements.nextButton.disabled = true;
    elements.nowButton.disabled = true;
    elements.chartSelect.disabled = true;
    return;
  }

  const demoPrefix = state.source === "demo" ? "DEMO ONLY · " : "";
  const offsetMath = page.chart.offset === 0
    ? "HW time"
    : `HW ${page.chart.offset > 0 ? "+" : ""}${page.chart.offset}h`;

  elements.offsetLabel.textContent = `${demoPrefix}HW ${page.hwIndex + 1} · ${formatOffset(page.chart.offset)}`;
  elements.validTime.textContent = `Chart valid: ${formatDateTime(page.validDate)}`;
  elements.referenceTime.textContent = `HW Cherbourg: ${formatDateTime(page.hwDateTime)} · ${offsetMath}`;
  elements.coefficientLabel.textContent = formatCoefficient(page.hwDateTime);
  elements.pageCounter.textContent = `${state.currentPageIndex + 1} of ${pages.length}`;
  elements.chartImage.src = `charts/${encodeURIComponent(page.chart.file)}`;
  elements.chartImage.alt = `${formatOffset(page.chart.offset)} tidal stream chart`;
  elements.chartCaption.textContent = `${state.source === "demo" ? "DEMO ONLY - not for navigation. " : ""}Chart valid ${formatClock(page.validDate)} from HW Cherbourg ${formatClock(page.hwDateTime)} (${offsetMath}). ${formatCoefficient(page.hwDateTime) || "Coefficient unavailable"}. Original file: ${page.chart.file}`;
  elements.prevButton.disabled = state.currentPageIndex === 0;
  elements.nextButton.disabled = state.currentPageIndex === pages.length - 1;
  elements.nowButton.disabled = false;
  elements.chartSelect.disabled = false;
}

function loadDemoHighWaters() {
  state.planningDate = parsePlanningDate(elements.planningDate.value);
  state.highWaters = normaliseHighWaters(createDemoHighWaters(state.planningDate));
  state.source = "demo";
  state.providerMessage = "Generated interface-test times only - not HW Cherbourg and not for navigation.";
  state.currentPageIndex = findNearestPageIndex(state.planningDate);
  elements.manualPanel.open = false;
  render();
}

async function loadSmartHighWaters(anchorDate = state.planningDate, options = {}) {
  state.isLoading = true;
  renderStatus();

  try {
    const result = await getHighWaters({
      port: "Cherbourg",
      date: toDateInputValue(anchorDate),
      before: options.before ?? 2,
      after: options.after ?? 4,
    });

    if (result?.available && result.highWaters?.length) {
      const fetchedHighWaters = result.highWaterDetails || result.highWaters;
      state.highWaters = normaliseHighWaters(
        options.merge ? [...state.highWaters, ...fetchedHighWaters] : fetchedHighWaters
      );
      state.source = "smart";
      state.providerMessage = result.source
        ? `Source: ${result.source}. Check against official tide tables before use.`
        : "Live HW times loaded. Check against official tide tables before use.";
      state.currentPageIndex = findNearestPageIndex(anchorDate);
      elements.manualPanel.open = false;
      saveState();
    } else {
      state.source = state.highWaters.length ? "manual" : "manual";
      state.providerMessage = result?.reason || "WorldTides lookup is not currently available.";
      if (!state.highWaters.length) elements.manualPanel.open = true;
    }
  } catch (error) {
    state.source = "manual";
    state.providerMessage = `Smart lookup failed. ${error.message || "Use manual fallback."}`;
    if (!state.highWaters.length) elements.manualPanel.open = true;
  } finally {
    state.isLoading = false;
    saveState();
    render();
  }
}

async function maybeExtendTimeline() {
  if (state.source !== "smart" || state.isLoading) return;
  const pages = getPages();
  if (!pages.length) return;

  if (state.currentPageIndex <= fetchEdgeThreshold) {
    await loadSmartHighWaters(addDays(state.highWaters[0], -1), { before: 4, after: 1, merge: true });
  } else if (pages.length - state.currentPageIndex <= fetchEdgeThreshold) {
    await loadSmartHighWaters(addDays(state.highWaters[state.highWaters.length - 1], 1), { before: 1, after: 4, merge: true });
  }
}

async function moveChart(step) {
  const pages = getPages();
  const nextIndex = Math.min(pages.length - 1, Math.max(0, state.currentPageIndex + step));

  if (nextIndex !== state.currentPageIndex) {
    state.currentPageIndex = nextIndex;
    render();
    await maybeExtendTimeline();
  }
}

function jumpToNearestNow() {
  const pages = getPages();
  if (!pages.length) return;
  state.currentPageIndex = findNearestPageIndex(new Date());
  render();
}

function updateManualHighWaters(event) {
  event?.preventDefault();
  const nextHighWaters = [];

  for (const row of elements.cycleInputs.querySelectorAll(".cycle-row")) {
    const dateInput = row.querySelector('input[type="date"]');
    const timeInput = row.querySelector('input[type="time"]');
    const date = parseLocalDateTime(dateInput.value, timeInput.value);
    if (date) nextHighWaters.push(date);
  }

  state.highWaters = normaliseHighWaters(nextHighWaters).slice(0, maxManualHighWaters);
  state.source = "manual";
  state.providerMessage = "Using manual HW Cherbourg fallback times.";
  state.currentPageIndex = findNearestPageIndex(state.planningDate);
  saveState();
  render();
}

function addManualHighWater() {
  if (state.highWaters.length >= maxManualHighWaters) return;
  const lastHighWater = state.highWaters[state.highWaters.length - 1] || new Date(state.planningDate);
  state.highWaters = normaliseHighWaters([...state.highWaters, addHours(lastHighWater, 12)]);
  state.source = "manual";
  state.providerMessage = "Using manual HW Cherbourg fallback times.";
  saveState();
  render();
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").then((registration) => {
      registration.update();
    });
  }
}

function wireInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    elements.installButton.classList.remove("hidden");
  });

  elements.installButton.addEventListener("click", async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    elements.installButton.classList.add("hidden");
  });
}

function wireEvents() {
  elements.planningForm.addEventListener("submit", (event) => {
    event.preventDefault();
    state.planningDate = parsePlanningDate(elements.planningDate.value);
    loadSmartHighWaters(state.planningDate);
  });

  elements.demoButton.addEventListener("click", loadDemoHighWaters);
  elements.form.addEventListener("submit", updateManualHighWaters);
  elements.addCycleButton.addEventListener("click", addManualHighWater);
  elements.prevButton.addEventListener("click", () => moveChart(-1));
  elements.nextButton.addEventListener("click", () => moveChart(1));
  elements.nowButton.addEventListener("click", jumpToNearestNow);
  elements.chartSelect.addEventListener("change", () => {
    state.currentPageIndex = Number(elements.chartSelect.value);
    render();
    maybeExtendTimeline();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") moveChart(-1);
    if (event.key === "ArrowRight") moveChart(1);
  });

  elements.chartFrame.addEventListener("touchstart", (event) => {
    const touch = event.changedTouches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
  }, { passive: true });

  elements.chartFrame.addEventListener("touchend", (event) => {
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;

    if (Math.abs(deltaX) > 55 && Math.abs(deltaX) > Math.abs(deltaY) * 1.4) {
      moveChart(deltaX < 0 ? 1 : -1);
    }
  }, { passive: true });
}

function initialise() {
  elements.appVersion.textContent = appVersion;
  loadState();
  wireEvents();
  wireInstallPrompt();
  registerServiceWorker();

  if (state.highWaters.length) {
    state.currentPageIndex = findNearestPageIndex(state.planningDate);
  }

  render();
}

initialise();
