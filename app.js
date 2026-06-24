import { fetchHighWaterCherbourg } from "./tideProvider.js";

const appVersion = "v0.4";

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

const storageKey = "tidal-atlas.hw-cherbourg";
const maxCycles = 4;
const state = {
  currentPageIndex: 5,
  hwCycles: [],
};

const elements = {
  form: document.querySelector("#hwForm"),
  cycleInputs: document.querySelector("#cycleInputs"),
  addCycleButton: document.querySelector("#addCycleButton"),
  prevButton: document.querySelector("#prevButton"),
  nextButton: document.querySelector("#nextButton"),
  nowButton: document.querySelector("#nowButton"),
  installButton: document.querySelector("#installButton"),
  chartSelect: document.querySelector("#chartSelect"),
  offsetLabel: document.querySelector("#offsetLabel"),
  validTime: document.querySelector("#validTime"),
  referenceTime: document.querySelector("#referenceTime"),
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

function addHours(date, hours) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
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

function getPages() {
  return state.hwCycles.flatMap((hwDateTime, cycleIndex) => (
    chartDefinitions.map((chart) => ({
      chart,
      cycleIndex,
      hwDateTime,
      validDate: addHours(hwDateTime, chart.offset),
    }))
  ));
}

function currentPage() {
  const pages = getPages();
  if (!pages.length) return null;
  state.currentPageIndex = Math.min(state.currentPageIndex, pages.length - 1);
  return pages[state.currentPageIndex];
}

function saveReferenceTime() {
  localStorage.setItem(storageKey, JSON.stringify({
    cycles: state.hwCycles.map((date) => ({
      date: toDateInputValue(date),
      time: toTimeInputValue(date),
    })),
  }));
}

function loadReferenceTime() {
  const today = new Date();
  let saved = null;

  try {
    saved = JSON.parse(localStorage.getItem(storageKey));
  } catch {
    saved = null;
  }

  const savedCycles = saved?.cycles || (saved?.date && saved?.time ? [saved] : null);
  state.hwCycles = (savedCycles || [{ date: toDateInputValue(today), time: "12:00" }])
    .slice(0, maxCycles)
    .map((cycle) => parseLocalDateTime(cycle.date, cycle.time))
    .filter(Boolean);
}

function renderCycleInputs() {
  elements.cycleInputs.innerHTML = "";

  state.hwCycles.forEach((date, index) => {
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
    dateInput.dataset.cycleIndex = String(index);
    dateInput.dataset.field = "date";

    timeInput.type = "time";
    timeInput.required = true;
    timeInput.value = toTimeInputValue(date);
    timeInput.dataset.cycleIndex = String(index);
    timeInput.dataset.field = "time";

    dateLabel.append(dateInput);
    timeLabel.append(timeInput);

    removeButton.type = "button";
    removeButton.className = "remove-cycle";
    removeButton.textContent = "X";
    removeButton.setAttribute("aria-label", `Remove HW ${index + 1}`);
    removeButton.disabled = state.hwCycles.length === 1;
    removeButton.addEventListener("click", () => {
      state.hwCycles.splice(index, 1);
      state.currentPageIndex = Math.min(state.currentPageIndex, getPages().length - 1);
      saveReferenceTime();
      render();
    });

    row.append(label, dateLabel, timeLabel, removeButton);
    elements.cycleInputs.append(row);
  });

  elements.addCycleButton.disabled = state.hwCycles.length >= maxCycles;
}

function renderChartSelect() {
  const pages = getPages();
  elements.chartSelect.innerHTML = "";

  pages.forEach((page, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = `HW ${page.cycleIndex + 1} · ${formatOffset(page.chart.offset)} · ${formatShortTime(page.validDate)}`;
    option.selected = index === state.currentPageIndex;
    elements.chartSelect.append(option);
  });
}

function render() {
  renderCycleInputs();
  const pages = getPages();
  const page = currentPage();

  if (!page) {
    elements.offsetLabel.textContent = "HW Cherbourg";
    elements.validTime.textContent = "Choose a date and time";
    elements.referenceTime.textContent = "";
    elements.pageCounter.textContent = "";
    elements.chartImage.removeAttribute("src");
    elements.chartCaption.textContent = "";
    elements.prevButton.disabled = true;
    elements.nextButton.disabled = true;
    renderChartSelect();
    return;
  }

  elements.offsetLabel.textContent = `Cycle ${page.cycleIndex + 1} · ${formatOffset(page.chart.offset)}`;
  elements.validTime.textContent = formatDateTime(page.validDate);
  elements.referenceTime.textContent = `HW ${page.cycleIndex + 1}: ${formatDateTime(page.hwDateTime)}`;
  elements.pageCounter.textContent = `${state.currentPageIndex + 1} of ${pages.length}`;
  elements.chartImage.src = `charts/${encodeURIComponent(page.chart.file)}`;
  elements.chartImage.alt = `${formatOffset(page.chart.offset)} tidal stream chart`;
  elements.chartCaption.textContent = `${formatOffset(page.chart.offset)}. Original file: ${page.chart.file}`;
  elements.prevButton.disabled = state.currentPageIndex === 0;
  elements.nextButton.disabled = state.currentPageIndex === pages.length - 1;

  renderChartSelect();
}

function moveChart(step) {
  const pages = getPages();
  const nextIndex = Math.min(pages.length - 1, Math.max(0, state.currentPageIndex + step));
  if (nextIndex !== state.currentPageIndex) {
    state.currentPageIndex = nextIndex;
    render();
  }
}

function jumpToNearestNow() {
  const pages = getPages();
  if (!pages.length) return;

  const now = new Date();
  const first = pages[0].validDate;
  const last = pages[pages.length - 1].validDate;

  if (now < first || now > last) {
    elements.nowButton.textContent = "Now outside cycle";
    window.setTimeout(() => {
      elements.nowButton.textContent = "Nearest now";
    }, 1800);
    return;
  }

  let nearestIndex = 0;
  let nearestGap = Infinity;

  pages.forEach((page, index) => {
    const gap = Math.abs(page.validDate.getTime() - now.getTime());
    if (gap < nearestGap) {
      nearestGap = gap;
      nearestIndex = index;
    }
  });

  state.currentPageIndex = nearestIndex;
  render();
}

function updateReferenceTime(event) {
  event?.preventDefault();
  const nextCycles = [];

  for (const row of elements.cycleInputs.querySelectorAll(".cycle-row")) {
    const dateInput = row.querySelector('input[type="date"]');
    const timeInput = row.querySelector('input[type="time"]');
    const date = parseLocalDateTime(dateInput.value, timeInput.value);
    if (date) nextCycles.push(date);
  }

  state.hwCycles = nextCycles.slice(0, maxCycles);
  state.currentPageIndex = Math.min(state.currentPageIndex, getPages().length - 1);
  saveReferenceTime();
  render();
}

function addCycle() {
  if (state.hwCycles.length >= maxCycles) return;
  const lastCycle = state.hwCycles[state.hwCycles.length - 1] || new Date();
  state.hwCycles.push(addHours(lastCycle, 12));
  saveReferenceTime();
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
  elements.form.addEventListener("submit", updateReferenceTime);
  elements.addCycleButton.addEventListener("click", addCycle);
  elements.prevButton.addEventListener("click", () => moveChart(-1));
  elements.nextButton.addEventListener("click", () => moveChart(1));
  elements.nowButton.addEventListener("click", jumpToNearestNow);
  elements.chartSelect.addEventListener("change", () => {
    state.currentPageIndex = Number(elements.chartSelect.value);
    render();
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

async function initialise() {
  elements.appVersion.textContent = appVersion;
  loadReferenceTime();
  wireEvents();
  wireInstallPrompt();
  registerServiceWorker();
  render();

  const providerStatus = await fetchHighWaterCherbourg();
  if (providerStatus.available) {
    console.info("Tide provider is available but automatic lookup is not yet enabled in the UI.");
  }
}

initialise();
