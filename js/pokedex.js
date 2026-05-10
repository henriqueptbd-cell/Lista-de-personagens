import { getPokemonNamePT } from "./api.js";
import { TYPE_NAMES_PT, STAT_NAMES_PT, translateMoveName } from "./translations.js";

const grid = () => document.getElementById("pokemon-grid");
const modal = () => document.getElementById("modal");
const details = () => document.getElementById("pokemon-details");
const closeBtn = () => document.getElementById("modal-close");

let cardClickHandler = null;
let pickerMode = false;
let pickerCallback = null;

export function showLoading(visible) {
  const el = document.getElementById("pokedex-loading");
  if (el) el.style.display = visible ? "block" : "none";
}

export function updateLoadingProgress(done, total) {
  const fill = document.getElementById("loading-fill");
  const txt = document.getElementById("loading-text");
  const pct = Math.round((done / total) * 100);
  if (fill) fill.style.width = pct + "%";
  if (txt) txt.textContent = `Carregando pokémons... ${done}/${total}`;
}

export function renderPokedex(pokemons) {
  const g = grid();
  if (!g) return;
  const html = pokemons.map(p => cardHTML(p)).join("");
  g.innerHTML = html;
}

function cardHTML(p) {
  const namePT = getPokemonNamePT(p.id);
  const sprite = p.sprites?.front_default || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.id}.png`;
  const types = p.types.map(t => TYPE_NAMES_PT[t.type.name] || t.type.name).join(" / ");
  return `
    <div class="pokemon-card" data-id="${p.id}" tabindex="0" role="button" aria-label="${namePT}">
      <span class="id">#${String(p.id).padStart(3, "0")}</span>
      <img src="${sprite}" alt="${namePT}" loading="lazy" decoding="async">
      <div class="name">${namePT}</div>
      <div class="types">${types}</div>
    </div>
  `;
}

export function attachCardListeners(allPokemons) {
  const g = grid();
  if (!g) return;
  if (cardClickHandler) g.removeEventListener("click", cardClickHandler);
  cardClickHandler = (e) => {
    const card = e.target.closest(".pokemon-card");
    if (!card) return;
    const id = parseInt(card.dataset.id, 10);
    if (pickerMode && pickerCallback) {
      pickerCallback(id);
      return;
    }
    const p = allPokemons.find(x => x.id === id);
    if (p) openDetailsModal(p);
  };
  g.addEventListener("click", cardClickHandler);
  g.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      const card = e.target.closest(".pokemon-card");
      if (card) { e.preventDefault(); card.click(); }
    }
  });
}

export function openDetailsModal(pokemon) {
  const namePT = getPokemonNamePT(pokemon.id);
  const artwork = pokemon.sprites?.other?.["official-artwork"]?.front_default || pokemon.sprites?.front_default;

  const typesHtml = pokemon.types.map(t => {
    const tn = t.type.name;
    return `<span class="type-tag ${tn}">${TYPE_NAMES_PT[tn] || tn}</span>`;
  }).join("");

  const statsHtml = pokemon.stats.map(s => `
    <div class="stat-item">
      <span>${STAT_NAMES_PT[s.stat.name] || s.stat.name}</span>
      <strong>${s.base_stat}</strong>
    </div>
  `).join("");

  const abilitiesHtml = pokemon.abilities.slice(0, 4).map(a => `
    <span class="attack-tag">${translateMoveName(a.ability.name)}</span>
  `).join("");

  details().innerHTML = `
    <img src="${artwork}" alt="${namePT}" class="smooth-img">
    <h2 id="modal-title">${namePT}</h2>
    <div class="types-modal">${typesHtml}</div>
    <div class="stats-container">${statsHtml}</div>
    <div class="attacks-container">
      <h3>HABILIDADES</h3>
      <div class="attack-list">${abilitiesHtml || '<span class="attack-tag">—</span>'}</div>
    </div>
  `;
  modal().classList.add("open");
}

export function openPicker(allPokemons, onPick) {
  pickerMode = true;
  pickerCallback = (id) => {
    onPick(id);
    closeModal();
    pickerMode = false;
    pickerCallback = null;
  };
  details().innerHTML = `
    <h2 id="modal-title">Escolha um Pokémon</h2>
    <div class="picker-grid">
      ${allPokemons.map(p => cardHTML(p)).join("")}
    </div>
  `;
  details().querySelector(".picker-grid").addEventListener("click", (e) => {
    const card = e.target.closest(".pokemon-card");
    if (!card) return;
    const id = parseInt(card.dataset.id, 10);
    if (pickerCallback) pickerCallback(id);
  });
  modal().classList.add("open");
}

function closeModal() {
  modal().classList.remove("open");
}

export function initModalListeners() {
  closeBtn().addEventListener("click", () => {
    closeModal();
    pickerMode = false;
    pickerCallback = null;
  });
  modal().addEventListener("click", (e) => {
    if (e.target === modal()) {
      closeModal();
      pickerMode = false;
      pickerCallback = null;
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal().classList.contains("open")) {
      closeModal();
      pickerMode = false;
      pickerCallback = null;
    }
  });
}
