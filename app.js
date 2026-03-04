// Plan&Recuerdo — plantilla PWA simple (LocalStorage)
// Autor: tú 😄
//
// Objetivo: que sea fácil de entender y modificar.
//  - Pendientes: crear planes, mover a "Hechos"
//  - Hechos: diario con resumen/momentos
//  - Rutas: guardar y abrir en Google Maps
//
// NOTA: Para ser "primera app", evitamos frameworks y backend.

const LS_KEY = "planrecuerdo_v1";

// ---------- Utilidades ----------
function uid() {
  return crypto?.randomUUID?.() ?? String(Date.now()) + "_" + Math.random().toString(16).slice(2);
}

function parseTags(str) {
  return (str || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
}

function linesToArray(str) {
  return (str || "")
    .split("\n")
    .map(s => s.trim())
    .filter(Boolean);
}

function fmtDate(dateStr, timeStr) {
  if (!dateStr && !timeStr) return "";
  if (dateStr && !timeStr) return dateStr;
  if (!dateStr && timeStr) return timeStr;
  return `${dateStr} · ${timeStr}`;
}

function escapeHtml(s) {
  return (s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

// ---------- Estado ----------
function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { pending: [], done: [], routes: [] };
    const parsed = JSON.parse(raw);
    return {
      pending: Array.isArray(parsed.pending) ? parsed.pending : [],
      done: Array.isArray(parsed.done) ? parsed.done : [],
      routes: Array.isArray(parsed.routes) ? parsed.routes : []
    };
  } catch {
    return { pending: [], done: [], routes: [] };
  }
}

function saveState() {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

let state = loadState();

// ---------- Tabs ----------
const tabButtons = document.querySelectorAll(".tab");
const panels = {
  pending: document.getElementById("tab-pending"),
  done: document.getElementById("tab-done"),
  routes: document.getElementById("tab-routes"),
};

tabButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    tabButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    const tab = btn.dataset.tab;
    Object.entries(panels).forEach(([k, el]) => {
      el.classList.toggle("hidden", k !== tab);
    });
  });
});

// ---------- DOM refs ----------
const pendingList = document.getElementById("pendingList");
const doneList = document.getElementById("doneList");
const routeList = document.getElementById("routeList");

const pendingEmpty = document.getElementById("pendingEmpty");
const doneEmpty = document.getElementById("doneEmpty");
const routesEmpty = document.getElementById("routesEmpty");

// Modals & forms
const planModal = document.getElementById("planModal");
const planForm = document.getElementById("planForm");

const doneModal = document.getElementById("doneModal");
const doneForm = document.getElementById("doneForm");

const routeModal = document.getElementById("routeModal");
const routeForm = document.getElementById("routeForm");

// Buttons
document.getElementById("btnAddPlan").addEventListener("click", () => {
  planForm.reset();
  planModal.showModal();
});
document.getElementById("closePlan").addEventListener("click", () => planModal.close());
document.getElementById("cancelPlan").addEventListener("click", () => planModal.close());

document.getElementById("closeDone").addEventListener("click", () => doneModal.close());
document.getElementById("cancelDone").addEventListener("click", () => doneModal.close());

document.getElementById("btnAddRoute").addEventListener("click", () => {
  routeForm.reset();
  routeModal.showModal();
});
document.getElementById("closeRoute").addEventListener("click", () => routeModal.close());
document.getElementById("cancelRoute").addEventListener("click", () => routeModal.close());

// ---------- Render ----------
function render() {
  renderPending();
  renderDone();
  renderRoutes();
}

function renderPending() {
  pendingList.innerHTML = "";
  pendingEmpty.classList.toggle("hidden", state.pending.length > 0);

  // Orden simple: con fecha primero (más próxima), luego sin fecha
  const sorted = [...state.pending].sort((a, b) => {
    const ad = a.date || "9999-12-31";
    const bd = b.date || "9999-12-31";
    if (ad !== bd) return ad.localeCompare(bd);
    return (a.time || "").localeCompare(b.time || "");
  });

  for (const p of sorted) {
    const el = document.createElement("div");
    el.className = "card";

    const when = fmtDate(p.date, p.time);
    const metaParts = [];
    if (when) metaParts.push(when);
    if (p.place) metaParts.push(p.place);
    const meta = metaParts.join(" · ");

    el.innerHTML = `
      <div class="cardTop">
        <div>
          <div class="cardTitle">${escapeHtml(p.title)}</div>
          ${meta ? `<div class="cardMeta">${escapeHtml(meta)}</div>` : ""}
          ${p.notes ? `<div class="cardMeta">${escapeHtml(p.notes)}</div>` : ""}
          ${p.tags?.length ? `<div class="tags">${p.tags.map(t => `<span class="tag">#${escapeHtml(t)}</span>`).join("")}</div>` : ""}
        </div>
      </div>
      <div class="cardActions">
        <button class="btn" data-action="done" data-id="${p.id}">✓ Hecho</button>
        ${p.place ? `<button class="btn btn-ghost" data-action="maps" data-id="${p.id}">Abrir lugar</button>` : ""}
        <button class="btn btn-ghost" data-action="delete" data-id="${p.id}">Eliminar</button>
      </div>
    `;

    el.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      const action = btn.dataset.action;
      const id = btn.dataset.id;

      if (action === "delete") deletePending(id);
      if (action === "maps") openPlaceInMaps(id);
      if (action === "done") openDoneModalFromPlan(id);
    });

    pendingList.appendChild(el);
  }
}

function renderDone() {
  doneList.innerHTML = "";
  doneEmpty.classList.toggle("hidden", state.done.length > 0);

  const sorted = [...state.done].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  for (const d of sorted) {
    const el = document.createElement("div");
    el.className = "card";

    const meta = [];
    if (d.when) meta.push(d.when);
    if (d.place) meta.push(d.place);
    if (d.rating) meta.push(`★ ${d.rating}/5`);
    const metaText = meta.join(" · ");

    el.innerHTML = `
      <div class="cardTop">
        <div>
          <div class="cardTitle">${escapeHtml(d.title)}</div>
          ${metaText ? `<div class="cardMeta">${escapeHtml(metaText)}</div>` : ""}
          <div class="cardMeta">${escapeHtml(d.summary)}</div>

          ${d.moments?.length ? `
            <div class="cardMeta" style="margin-top:10px">
              ${d.moments.map(m => `• ${escapeHtml(m)}`).join("<br>")}
            </div>` : ""}

          ${d.cost != null && d.cost !== "" ? `<div class="cardMeta" style="margin-top:10px">Gasto: ${escapeHtml(String(d.cost))} €</div>` : ""}
        </div>
      </div>
      <div class="cardActions">
        <button class="btn btn-ghost" data-action="delete" data-id="${d.id}">Eliminar</button>
      </div>
    `;

    el.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      if (btn.dataset.action === "delete") deleteDone(btn.dataset.id);
    });

    doneList.appendChild(el);
  }
}

function renderRoutes() {
  routeList.innerHTML = "";
  routesEmpty.classList.toggle("hidden", state.routes.length > 0);

  const sorted = [...state.routes].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  for (const r of sorted) {
    const el = document.createElement("div");
    el.className = "card";

    const stopsText = (r.stops?.length) ? `${r.stops.length} parada(s)` : "sin paradas";
    el.innerHTML = `
      <div class="cardTop">
        <div>
          <div class="cardTitle">${escapeHtml(r.name)}</div>
          <div class="cardMeta">${escapeHtml(r.origin)} → ${escapeHtml(r.destination)} · ${escapeHtml(stopsText)}</div>
          ${r.notes ? `<div class="cardMeta">${escapeHtml(r.notes)}</div>` : ""}
        </div>
      </div>
      <div class="cardActions">
        <button class="btn" data-action="open" data-id="${r.id}">Abrir en Maps</button>
        <button class="btn btn-ghost" data-action="delete" data-id="${r.id}">Eliminar</button>
      </div>
    `;

    el.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      const action = btn.dataset.action;
      const id = btn.dataset.id;

      if (action === "open") openRoute(id);
      if (action === "delete") deleteRoute(id);
    });

    routeList.appendChild(el);
  }
}

// ---------- Acciones: Pendientes ----------
planForm.addEventListener("submit", () => {
  const fd = new FormData(planForm);

  const plan = {
    id: uid(),
    title: String(fd.get("title") || "").trim(),
    date: String(fd.get("date") || "").trim() || null,
    time: String(fd.get("time") || "").trim() || null,
    place: String(fd.get("place") || "").trim() || null,
    tags: parseTags(String(fd.get("tags") || "")),
    notes: String(fd.get("notes") || "").trim() || null,
    createdAt: Date.now()
  };

  if (!plan.title) return;

  state.pending.push(plan);
  saveState();
  render();
  planModal.close();
});

function deletePending(id) {
  state.pending = state.pending.filter(p => p.id !== id);
  saveState();
  render();
}

function openPlaceInMaps(planId) {
  const p = state.pending.find(x => x.id === planId);
  if (!p?.place) return;
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.place)}`;
  window.open(url, "_blank", "noopener");
}

function openDoneModalFromPlan(planId) {
  const p = state.pending.find(x => x.id === planId);
  if (!p) return;

  doneForm.reset();
  doneForm.elements.planId.value = p.id;
  doneModal.showModal();
}

// ---------- Pasar a Hechos ----------
doneForm.addEventListener("submit", () => {
  const fd = new FormData(doneForm);
  const planId = String(fd.get("planId") || "");
  const p = state.pending.find(x => x.id === planId);
  if (!p) return;

  const summary = String(fd.get("summary") || "").trim();
  if (!summary) return;

  const rating = Number(fd.get("rating") || 5);
  const costStr = String(fd.get("cost") || "").trim();
  const cost = costStr === "" ? "" : Number(costStr);

  const doneItem = {
    id: uid(),
    title: p.title,
    when: fmtDate(p.date, p.time),
    place: p.place || "",
    summary,
    rating: Number.isFinite(rating) ? Math.max(1, Math.min(5, rating)) : 5,
    cost: costStr === "" ? "" : (Number.isFinite(cost) ? cost : ""),
    moments: linesToArray(String(fd.get("moments") || "")),
    createdAt: Date.now()
  };

  // quitar de pendientes y añadir a hechos
  state.pending = state.pending.filter(x => x.id !== planId);
  state.done.push(doneItem);

  saveState();
  render();
  doneModal.close();
});

function deleteDone(id) {
  state.done = state.done.filter(d => d.id !== id);
  saveState();
  render();
}

// ---------- Rutas ----------
routeForm.addEventListener("submit", () => {
  const fd = new FormData(routeForm);

  const name = String(fd.get("name") || "").trim();
  const origin = String(fd.get("origin") || "").trim();
  const destination = String(fd.get("destination") || "").trim();
  if (!name || !origin || !destination) return;

  const stops = linesToArray(String(fd.get("stops") || ""));
  const notes = String(fd.get("notes") || "").trim();

  const route = {
    id: uid(),
    name,
    origin,
    destination,
    stops,
    notes,
    mapsUrl: buildGoogleMapsDirectionsUrl(origin, destination, stops),
    createdAt: Date.now()
  };

  state.routes.push(route);
  saveState();
  render();
  routeModal.close();
});

function buildGoogleMapsDirectionsUrl(origin, destination, stops) {
  // Google Maps Directions:
  // https://www.google.com/maps/dir/?api=1&origin=...&destination=...&travelmode=walking&waypoints=...
  const base = "https://www.google.com/maps/dir/?api=1";
  const params = new URLSearchParams();
  params.set("origin", origin);
  params.set("destination", destination);
  params.set("travelmode", "driving"); // puedes cambiar a walking/bicycling/transit
  if (stops?.length) params.set("waypoints", stops.join("|"));
  return `${base}&${params.toString()}`;
}

function openRoute(id) {
  const r = state.routes.find(x => x.id === id);
  if (!r) return;
  window.open(r.mapsUrl, "_blank", "noopener");
}

function deleteRoute(id) {
  state.routes = state.routes.filter(r => r.id !== id);
  saveState();
  render();
}

// ---------- Export / Import ----------
document.getElementById("btnExport").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "planrecuerdo-datos.json";
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById("fileImport").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const imported = JSON.parse(text);

    // Import "seguro": solo cogemos arrays válidos
    state = {
      pending: Array.isArray(imported.pending) ? imported.pending : [],
      done: Array.isArray(imported.done) ? imported.done : [],
      routes: Array.isArray(imported.routes) ? imported.routes : [],
    };

    saveState();
    render();
    alert("Importado correctamente ✅");
  } catch {
    alert("Ese archivo no parece válido ❌");
  } finally {
    e.target.value = "";
  }
});

// ---------- Service worker (PWA) ----------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

// Primer render
render();