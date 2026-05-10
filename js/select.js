import { getCachedPokemon, getPokemonNamePT } from "./api.js";
import { openPicker } from "./pokedex.js";

const state = { player: null, opponent: null };
let allPokemons = [];
let onStartCallback = null;

export function initSelect(pokemons, onStart) {
  allPokemons = pokemons;
  onStartCallback = onStart;
  attachListeners();
  refreshAll();
}

function attachListeners() {
  document.querySelectorAll(".slot").forEach(slot => {
    const which = slot.dataset.slot;
    slot.querySelectorAll("button[data-action]").forEach(btn => {
      btn.addEventListener("click", () => {
        const action = btn.dataset.action;
        if (action === "random") {
          state[which] = Math.floor(Math.random() * 151) + 1;
          refreshSlot(which);
          refreshStartButton();
        } else if (action === "pick") {
          openPicker(allPokemons, (id) => {
            state[which] = id;
            refreshSlot(which);
            refreshStartButton();
          });
        }
      });
    });
  });

  const startBtn = document.getElementById("start-battle-btn");
  if (startBtn) {
    startBtn.addEventListener("click", () => {
      if (state.player && state.opponent && onStartCallback) {
        onStartCallback(state.player, state.opponent);
      }
    });
  }
}

function refreshAll() {
  refreshSlot("player");
  refreshSlot("opponent");
  refreshStartButton();
}

function refreshSlot(which) {
  const slot = document.querySelector(`.slot[data-slot="${which}"]`);
  if (!slot) return;
  const preview = slot.querySelector(".slot-preview");
  const nameEl = slot.querySelector(".name");
  const id = state[which];
  if (!id) {
    preview.innerHTML = `<span class="empty">— vazio —</span>`;
    nameEl.innerHTML = "&nbsp;";
    return;
  }
  const p = getCachedPokemon(id);
  const sprite = p?.sprites?.front_default
    || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
  preview.innerHTML = `<img src="${sprite}" alt="${getPokemonNamePT(id)}">`;
  nameEl.textContent = getPokemonNamePT(id);
}

function refreshStartButton() {
  const btn = document.getElementById("start-battle-btn");
  if (!btn) return;
  btn.disabled = !(state.player && state.opponent);
}

export function resetSelect() {
  state.player = null;
  state.opponent = null;
  refreshAll();
}
