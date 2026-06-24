import { fetchHighWaterCherbourg } from "./tideProvider.js";

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
const state = {
  currentIndex: 5,
  hwDateTime: null,
};

const elements = {
  form: document.querySelector("#hwForm"),
  hwDate: document.querySelector("#hwDate"),
  hwTime: document.querySelector("#hwTime"),
  prevButton: document.querySelector("#prevButton"),
  nextButton: document.querySelector("#nextButton"),
  nowButton: document.querySelector("#nowButton"),
  installButton: document.querySelector("#installButton"),
  chartList: document.querySelector("#chartList"),
  offsetLabel: document.querySelector("#offsetLabel"),
  validTime: document.querySelector("#validTime"),
  referenceTime: document.querySelector("#referenceTime"),
  chartFrame: document.querySelector("#chartFrame"),
  chartImage: document.querySelector("#chartImage"),
  chartCaption: document.querySelector("#chartCaption"),
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

function chartDateTime(chart) {
  if (!state.hwDateTime) return null;
  return new Date(state.hwDateTime.getTime() + chart.offset * 60 * 60 * 1000);
}

function saveReferenceTime() {
  if (!state.hwDateTime) return;
  localStorage.setItem(storageKey, JSON.stringify({
    date: elements.hwDate.value,
    time: elements.hwTime.value,
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

  elements.hwDate.value = saved?.date || toDateInputValue(today);
  elements.hwTime.value = saved?.time || "12:00";
  state.hwDateTime = parseLocalDateTime(elements.hwDate.value, elements.hwTime.value);
}

function renderChartList() {
  elements.chartList.innerHTML = "";

  chartDefinitions.forEach((chart, index) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    const label = document.createElement("span");
    const time = document.createElement("time");
    const validDate = chartDateTime(chart);

    button.type = "button";
    button.setAttribute("aria-current", String(index === state.currentIndex));
    label.textContent = formatOffset(chart.offset);
    time.textContent = validDate ? formatShortTime(validDate) : "";
    if (validDate) time.dateTime = validDate.toISOString();

    button.append(label, time);
    button.addEventListener("click", () => {
      state.currentIndex = index;
      render();
    });

    item.append(button);
    elements.chartList.append(item);
  });
}

function render() {
  const chart = chartDefinitions[state.currentIndex];
  const validDate = chartDateTime(chart);

  elements.offsetLabel.textContent = formatOffset(chart.offset);
  elements.validTime.textContent = validDate ? formatDateTime(validDate) : "Choose a date and time";
  elements.referenceTime.textContent = state.hwDateTime
    ? `Reference HW Cherbourg: ${formatDateTime(state.hwDateTime)}`
    : "";
  elements.chartImage.src = `charts/${encodeURIComponent(chart.file)}`;
  elements.chartImage.alt = `${formatOffset(chart.offset)} tidal stream chart`;
  elements.chartCaption.textContent = `${formatOffset(chart.offset)}. Original file: ${chart.file}`;
  elements.prevButton.disabled = state.currentIndex === 0;
  elements.nextButton.disabled = state.currentIndex === chartDefinitions.length - 1;

  renderChartList();
}

function moveChart(step) {
  const nextIndex = Math.min(chartDefinitions.length - 1, Math.max(0, state.currentIndex + step));
  if (nextIndex !== state.currentIndex) {
    state.currentIndex = nextIndex;
    render();
  }
}

function jumpToNearestNow() {
  if (!state.hwDateTime) return;

  const now = new Date();
  const first = chartDateTime(chartDefinitions[0]);
  const last = chartDateTime(chartDefinitions[chartDefinitions.length - 1]);

  if (now < first || now > last) {
    elements.nowButton.textContent = "Now outside cycle";
    window.setTimeout(() => {
      elements.nowButton.textContent = "Nearest now";
    }, 1800);
    return;
  }

  let nearestIndex = 0;
  let nearestGap = Infinity;

  chartDefinitions.forEach((chart, index) => {
    const gap = Math.abs(chartDateTime(chart).getTime() - now.getTime());
    if (gap < nearestGap) {
      nearestGap = gap;
      nearestIndex = index;
    }
  });

  state.currentIndex = nearestIndex;
  render();
}

function updateReferenceTime(event) {
  event?.preventDefault();
  state.hwDateTime = parseLocalDateTime(elements.hwDate.value, elements.hwTime.value);
  saveReferenceTime();
  render();
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js");
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
  elements.hwDate.addEventListener("change", updateReferenceTime);
  elements.hwTime.addEventListener("change", updateReferenceTime);
  elements.prevButton.addEventListener("click", () => moveChart(-1));
  elements.nextButton.addEventListener("click", () => moveChart(1));
  elements.nowButton.addEventListener("click", jumpToNearestNow);

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
