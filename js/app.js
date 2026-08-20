"use strict";

/* ---------- Klokke ---------- */

const clockEl = document.getElementById("clock");
const dateEl = document.getElementById("date");

const WEEKDAYS = ["søndag", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag"];
const MONTHS = [
  "januar", "februar", "mars", "april", "mai", "juni",
  "juli", "august", "september", "oktober", "november", "desember"
];

function updateClock() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  clockEl.textContent = `${hh}:${mm}:${ss}`;
  dateEl.textContent = `${WEEKDAYS[now.getDay()]} ${now.getDate()}. ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
}

updateClock();
setInterval(updateClock, 1000);

/* ---------- Vær (Open-Meteo, ingen API-nøkkel nødvendig) ---------- */

const weatherDaysEl = document.getElementById("weatherDays");
const weatherStatusEl = document.getElementById("weatherStatus");
const locationLabelEl = document.getElementById("locationLabel");
const locationForm = document.getElementById("locationForm");
const locationInput = document.getElementById("locationInput");
const useGeoBtn = document.getElementById("useGeoBtn");

const DEFAULT_LOCATION = { name: "Oslo, Norge", lat: 59.9139, lon: 10.7522 };
const LOCATION_KEY = "byggeplass_location";

const WEATHER_CODES = {
  0: ["☀️", "Klarvær"],
  1: ["🌤️", "Hovedsakelig klart"],
  2: ["⛅", "Delvis skyet"],
  3: ["☁️", "Skyet"],
  45: ["🌫️", "Tåke"],
  48: ["🌫️", "Rimtåke"],
  51: ["🌦️", "Lett yr"],
  53: ["🌦️", "Yr"],
  55: ["🌧️", "Kraftig yr"],
  56: ["🌧️", "Underkjølt yr"],
  57: ["🌧️", "Underkjølt yr"],
  61: ["🌧️", "Lett regn"],
  63: ["🌧️", "Regn"],
  65: ["🌧️", "Kraftig regn"],
  66: ["🌧️", "Underkjølt regn"],
  67: ["🌧️", "Underkjølt regn"],
  71: ["❄️", "Lett snø"],
  73: ["❄️", "Snø"],
  75: ["❄️", "Kraftig snø"],
  77: ["❄️", "Snøkorn"],
  80: ["🌦️", "Regnbyger"],
  81: ["🌦️", "Regnbyger"],
  82: ["🌧️", "Kraftige regnbyger"],
  85: ["🌨️", "Snøbyger"],
  86: ["🌨️", "Kraftige snøbyger"],
  95: ["⛈️", "Tordenvær"],
  96: ["⛈️", "Tordenvær med hagl"],
  99: ["⛈️", "Tordenvær med hagl"],
};

function weatherInfo(code) {
  return WEATHER_CODES[code] || ["❔", "Ukjent"];
}

function loadLocation() {
  try {
    const raw = localStorage.getItem(LOCATION_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    /* ignore corrupt storage */
  }
  return DEFAULT_LOCATION;
}

function saveLocation(loc) {
  localStorage.setItem(LOCATION_KEY, JSON.stringify(loc));
}

async function geocode(query) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=no&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Geokoding feilet");
  const data = await res.json();
  if (!data.results || data.results.length === 0) throw new Error("Fant ikke stedet");
  const r = data.results[0];
  const namePart = [r.name, r.admin1, r.country].filter(Boolean);
  return { name: namePart.join(", "), lat: r.latitude, lon: r.longitude };
}

async function fetchForecast(loc) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}` +
    `&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
    `&timezone=auto&forecast_days=10`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Klarte ikke hente værdata");
  return res.json();
}

function renderWeather(daily) {
  weatherDaysEl.innerHTML = "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  daily.time.forEach((dateStr, i) => {
    const d = new Date(dateStr + "T00:00:00");
    const isToday = d.getTime() === today.getTime();
    const [icon, label] = weatherInfo(daily.weathercode[i]);
    const max = Math.round(daily.temperature_2m_max[i]);
    const min = Math.round(daily.temperature_2m_min[i]);
    const pop = daily.precipitation_probability_max ? daily.precipitation_probability_max[i] : null;

    const dayName = isToday ? "I dag" : WEEKDAYS[d.getDay()].slice(0, 3);

    const el = document.createElement("div");
    el.className = "weather-day";
    el.title = label;
    el.innerHTML = `
      <div class="wd-name">${dayName} ${d.getDate()}.${d.getMonth() + 1}</div>
      <div class="wd-icon">${icon}</div>
      <div class="wd-temps"><span class="max">${max}°</span> <span class="min">${min}°</span></div>
      ${pop !== null ? `<div class="wd-precip">💧 ${pop}%</div>` : ""}
    `;
    weatherDaysEl.appendChild(el);
  });
}

async function loadWeather(loc) {
  weatherStatusEl.textContent = "Henter værvarsel…";
  locationLabelEl.textContent = loc.name;
  try {
    const data = await fetchForecast(loc);
    renderWeather(data.daily);
    weatherStatusEl.textContent = "";
  } catch (err) {
    weatherStatusEl.textContent = "Kunne ikke hente værdata akkurat nå.";
  }
}

async function useLocation(loc) {
  saveLocation(loc);
  await loadWeather(loc);
}

locationForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const query = locationInput.value.trim();
  if (!query) return;
  weatherStatusEl.textContent = "Søker sted…";
  try {
    const loc = await geocode(query);
    locationInput.value = "";
    await useLocation(loc);
  } catch (err) {
    weatherStatusEl.textContent = "Fant ikke stedet. Prøv et annet søk.";
  }
});

useGeoBtn.addEventListener("click", () => {
  if (!navigator.geolocation) {
    weatherStatusEl.textContent = "Posisjon støttes ikke i denne nettleseren.";
    return;
  }
  weatherStatusEl.textContent = "Henter posisjon…";
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const loc = {
        name: "Min posisjon",
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
      };
      await useLocation(loc);
    },
    () => {
      weatherStatusEl.textContent = "Fikk ikke tilgang til posisjon.";
    }
  );
});

loadWeather(loadLocation());

/* ---------- Oppgaver ---------- */

const TASKS_KEY = "byggeplass_tasks";

const taskForm = document.getElementById("taskForm");
const taskTitleInput = document.getElementById("taskTitle");
const taskDueInput = document.getElementById("taskDue");
const taskPriorityInput = document.getElementById("taskPriority");
const taskListEl = document.getElementById("taskList");
const hideDoneCheckbox = document.getElementById("hideDone");
const taskSummaryEl = document.getElementById("taskSummary");

const PRIORITY_LABELS = { lav: "Lav", middels: "Middels", hoy: "Høy", kritisk: "Kritisk" };
const PRIORITY_ORDER = { kritisk: 0, hoy: 1, middels: 2, lav: 3 };

function todayISO() {
  const now = new Date();
  const off = now.getTimezoneOffset();
  return new Date(now.getTime() - off * 60000).toISOString().slice(0, 10);
}

function loadTasks() {
  try {
    const raw = localStorage.getItem(TASKS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    /* ignore corrupt storage */
  }
  return [];
}

function saveTasks(tasks) {
  localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
}

let tasks = loadTasks();

function formatDueDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
}

function renderTasks() {
  const hideDone = hideDoneCheckbox.checked;
  const today = todayISO();

  const visible = tasks.filter((t) => !(hideDone && t.done));

  const sorted = [...visible].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.due !== b.due) return a.due < b.due ? -1 : 1;
    return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
  });

  taskListEl.innerHTML = "";

  if (sorted.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.textContent = "Ingen oppgaver ennå. Legg til en over.";
    taskListEl.appendChild(empty);
  }

  for (const t of sorted) {
    const li = document.createElement("li");
    const overdue = !t.done && t.due < today;
    li.className = `task-item prio-${t.priority}${t.done ? " done" : ""}${overdue ? " overdue" : ""}`;

    const check = document.createElement("input");
    check.type = "checkbox";
    check.className = "task-check";
    check.checked = t.done;
    check.addEventListener("change", () => {
      t.done = check.checked;
      saveTasks(tasks);
      renderTasks();
    });

    const main = document.createElement("div");
    main.className = "task-main";
    const dueLabel = overdue ? `Forfalt ${formatDueDate(t.due)}` : `Forfaller ${formatDueDate(t.due)}`;
    main.innerHTML = `
      <div class="task-title"></div>
      <div class="task-meta">
        <span class="task-due">${dueLabel}</span>
        <span class="badge prio-${t.priority}">${PRIORITY_LABELS[t.priority]}</span>
      </div>
    `;
    main.querySelector(".task-title").textContent = t.title;

    const del = document.createElement("button");
    del.type = "button";
    del.className = "task-delete";
    del.textContent = "Slett";
    del.addEventListener("click", () => {
      tasks = tasks.filter((x) => x.id !== t.id);
      saveTasks(tasks);
      renderTasks();
    });

    li.appendChild(check);
    li.appendChild(main);
    li.appendChild(del);
    taskListEl.appendChild(li);
  }

  const openCount = tasks.filter((t) => !t.done).length;
  const overdueCount = tasks.filter((t) => !t.done && t.due < today).length;
  taskSummaryEl.textContent = `${openCount} åpne${overdueCount > 0 ? ` · ${overdueCount} forfalt` : ""}`;
}

taskDueInput.value = todayISO();

taskForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const title = taskTitleInput.value.trim();
  if (!title) return;

  tasks.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    title,
    due: taskDueInput.value || todayISO(),
    priority: taskPriorityInput.value,
    done: false,
  });

  saveTasks(tasks);
  taskForm.reset();
  taskDueInput.value = todayISO();
  taskPriorityInput.value = "middels";
  renderTasks();
  taskTitleInput.focus();
});

hideDoneCheckbox.addEventListener("change", renderTasks);

renderTasks();
