import { loadTranslations, fetchAllGen1 } from "./api.js";
import {
  renderPokedex,
  attachCardListeners,
  initModalListeners,
  showLoading,
  updateLoadingProgress
} from "./pokedex.js";
import { renderHome, fillFeaturedAndParallax } from "./home.js";
import { initSelect, resetSelect } from "./select.js";
import { startBattle, hideVictoryOverlay, getCurrentBattleIds } from "./battle-ui.js";

const SCREENS = {
  "/": "screen-home",
  "/pokedex": "screen-pokedex",
  "/select": "screen-select",
  "/battle": "screen-battle"
};

let allPokemons = [];

async function boot() {
  initModalListeners();
  renderHome();

  showPokedexLoading(true);

  await loadTranslations();
  try {
    allPokemons = await fetchAllGen1((done, total) => {
      updateLoadingProgress(done, total);
    });
    allPokemons.sort((a, b) => a.id - b.id);
  } catch (e) {
    console.error("Erro ao carregar pokémons:", e);
    showError("Sem conexão com a Pokédex global. Verifique sua internet.");
    return;
  }

  showPokedexLoading(false);
  renderPokedex(allPokemons);
  attachCardListeners(allPokemons);
  fillFeaturedAndParallax();

  initSelect(allPokemons, (playerId, opponentId, difficulty) => {
    location.hash = "#/battle";
    startBattle(playerId, opponentId, difficulty);
  });

  initVictoryActions();
  initRouter();
}

function showPokedexLoading(visible) {
  showLoading(visible);
}

function showError(msg) {
  const grid = document.getElementById("pokemon-grid");
  if (grid) grid.innerHTML = `<div class="error-banner">${msg}</div>`;
  const home = document.getElementById("screen-home");
  if (home) {
    const banner = document.createElement("div");
    banner.className = "error-banner";
    banner.textContent = msg;
    home.prepend(banner);
  }
}

function initRouter() {
  window.addEventListener("hashchange", routeFromHash);
  routeFromHash();
}

function routeFromHash() {
  const raw = location.hash.replace(/^#/, "") || "/";
  const path = raw.startsWith("/") ? raw : "/" + raw;
  const target = SCREENS[path] || SCREENS["/"];
  document.querySelectorAll(".screen").forEach(s => {
    s.classList.toggle("active", s.id === target);
  });
  document.querySelectorAll(".nav-link").forEach(a => {
    a.classList.toggle("active", a.dataset.route === path);
  });
  hideVictoryOverlay();
  if (path === "/select") resetSelect();
  window.scrollTo(0, 0);
}

function initVictoryActions() {
  const rematch = document.getElementById("rematch-btn");
  const back = document.getElementById("back-pokedex-btn");
  if (rematch) rematch.addEventListener("click", () => {
    hideVictoryOverlay();
    const ids = getCurrentBattleIds();
    if (ids) {
      startBattle(ids.playerId, ids.opponentId, ids.difficulty || "normal");
    } else {
      location.hash = "#/select";
    }
  });
  if (back) back.addEventListener("click", () => {
    hideVictoryOverlay();
    location.hash = "#/pokedex";
  });
}

boot();
