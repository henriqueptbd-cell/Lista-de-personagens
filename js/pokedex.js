import { getPokemonNamePT, fetchSpecies, fetchAbility, fetchEvolutionChain } from "./api.js";
import { TYPE_NAMES_PT, STAT_NAMES_PT, translateMoveName } from "./translations.js";
import { TYPE_CHART, getEffectiveness } from "./types.js";

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
      <div class="pokemon-sprite">
        <img src="${sprite}" alt="${namePT}" loading="lazy" decoding="async">
      </div>
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

let modalVersion = 0;

export async function openDetailsModal(pokemon, options = {}) {
  const version = ++modalVersion;
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

  const initialAbilities = pokemon.abilities.slice(0, 4).map(a => `
    <div class="ability-item">
      <span class="attack-tag">${translateMoveName(a.ability.name)}</span>
    </div>
  `).join("");

  const typeAdv = renderTypeAdvantages(pokemon);

  details().innerHTML = `
    <img src="${artwork}" alt="${namePT}" class="smooth-img">
    <h2 id="modal-title">${namePT}</h2>
    <div class="types-modal">${typesHtml}</div>
    <div id="modal-badges" class="modal-badges"></div>
    <p id="modal-flavor" class="flavor-text">&#8203;</p>
    <div class="type-advantage">${typeAdv}</div>
    <div class="stats-container">${statsHtml}</div>
    <div class="attacks-container">
      <h3>HABILIDADES</h3>
      <div id="modal-abilities" class="ability-list">${initialAbilities || '<div class="ability-item"><span class="attack-tag">—</span></div>'}</div>
    </div>
    <div id="modal-evolution" class="evolution-section"></div>
    ${options.onSelect || options.onBack ? '<div class="detail-actions"></div>' : ''}
  `;

  const actions = details().querySelector(".detail-actions");
  if (actions) {
    if (options.onBack) {
      const backBtn = document.createElement("button");
      backBtn.className = "detail-back-btn";
      backBtn.textContent = "VOLTAR";
      backBtn.addEventListener("click", () => options.onBack());
      actions.appendChild(backBtn);
    }
    if (options.onSelect) {
      const selectBtn = document.createElement("button");
      selectBtn.className = "select-pokemon-btn";
      selectBtn.textContent = "ESCOLHER ESTE POKÉMON";
      selectBtn.addEventListener("click", () => options.onSelect(pokemon.id));
      actions.appendChild(selectBtn);
    }
  }

  modal().classList.add("open");

  try {
    const [species, abilitiesData] = await Promise.all([
      fetchSpecies(pokemon.id),
      Promise.all(pokemon.abilities.slice(0, 4).map(a => fetchAbility(a.ability.name).catch(() => null)))
    ]);

    if (version !== modalVersion) return;

    const flavorEl = document.getElementById("modal-flavor");
    if (flavorEl) {
      const entry = pickFlavorEntry(species.flavor_text_entries);
      flavorEl.textContent = entry ? cleanText(entry.flavor_text) : "";
    }

    const badgesEl = document.getElementById("modal-badges");
    if (badgesEl) {
      const badges = [];
      if (species.is_legendary) badges.push('<span class="badge badge-legendary">LENDÁRIO</span>');
      if (species.is_mythical)  badges.push('<span class="badge badge-mythical">MÍTICO</span>');
      if (species.habitat)      badges.push(`<span class="badge badge-habitat">${HABITAT_PT[species.habitat.name] || species.habitat.name}</span>`);
      badgesEl.innerHTML = badges.join("");
    }

    const abilitiesEl = document.getElementById("modal-abilities");
    if (abilitiesEl) {
      abilitiesEl.innerHTML = abilitiesData.map((abilityData, i) => {
        const name = translateMoveName(pokemon.abilities[i].ability.name);
        const desc = abilityData ? pickShortEffect(abilityData) : "";
        return `
          <div class="ability-item">
            <span class="attack-tag">${name}</span>
            ${desc ? `<p class="ability-desc">${desc}</p>` : ""}
          </div>
        `;
      }).join("");
    }

    if (species.evolution_chain?.url) {
      const chainData = await fetchEvolutionChain(species.evolution_chain.url);
      if (version !== modalVersion) return;
      const steps = flattenChain(chainData.chain);
      const evoEl = document.getElementById("modal-evolution");
      if (evoEl && steps.length > 1) {
        evoEl.innerHTML = `
          <h3>EVOLUÇÕES</h3>
          <div class="evo-chain">
            ${steps.map((step, idx) => `
              ${idx > 0 ? '<span class="evo-arrow">→</span>' : ""}
              <div class="evo-step">
                <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${step.id}.png"
                     alt="${getPokemonNamePT(step.id)}" loading="lazy">
                <span>${getPokemonNamePT(step.id)}</span>
              </div>
            `).join("")}
          </div>
        `;
      }
    }
  } catch (e) {
    console.warn("Modal enrichment error:", e);
  }
}

function renderTypeAdvantages(pokemon) {
  const defenderTypes = pokemon.types.map(t => t.type.name);
  const strengths = [];
  const resistances = [];
  const immunities = [];

  Object.keys(TYPE_CHART).forEach(attackerType => {
    const mult = getEffectiveness(attackerType, defenderTypes);
    if (mult >= 2) strengths.push(attackerType);
    else if (mult === 0) immunities.push(attackerType);
    else if (mult > 0 && mult < 1) resistances.push(attackerType);
  });

  const renderList = (items) => items.length
    ? items.map(type => `<span class="type-tag ${type}">${TYPE_NAMES_PT[type] || type}</span>`).join("")
    : '<span class="attack-tag">—</span>';

  return `
    <div class="advantage-row">
      <strong>Vantagens</strong>
      <div class="advantage-list">${renderList(strengths)}</div>
    </div>
    <div class="advantage-row">
      <strong>Resistências</strong>
      <div class="advantage-list">${renderList(resistances)}</div>
    </div>
    <div class="advantage-row">
      <strong>Imunidades</strong>
      <div class="advantage-list">${renderList(immunities)}</div>
    </div>
  `;
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
    <p class="picker-hint">Clique em um card para ver os detalhes e escolher.</p>
    <div class="picker-grid">
      ${allPokemons.map(p => cardHTML(p)).join("")}
    </div>
  `;
  details().querySelector(".picker-grid").addEventListener("click", (e) => {
    const card = e.target.closest(".pokemon-card");
    if (!card) return;
    const id = parseInt(card.dataset.id, 10);
    const pokemon = allPokemons.find(x => x.id === id);
    if (pokemon) {
      openDetailsModal(pokemon, {
        onSelect: pickerCallback,
        onBack: () => openPicker(allPokemons, onPick)
      });
    }
  });
  modal().classList.add("open");
}

function closeModal() {
  modal().classList.remove("open");
}

const HABITAT_PT = {
  cave: "Caverna", forest: "Floresta", grassland: "Pastagem",
  mountain: "Montanha", rare: "Raro", "rough-terrain": "Terreno Acidentado",
  sea: "Mar", urban: "Urbano", "waters-edge": "Beira d'Água"
};

function pickFlavorEntry(entries) {
  for (const lang of ["pt", "en"]) {
    const found = [...entries].reverse().find(e => e.language.name === lang);
    if (found) return found;
  }
  return entries[entries.length - 1] || null;
}

function cleanText(text) {
  return text.replace(/[\f\n\r]/g, " ").replace(/\s+/g, " ").trim();
}

function pickShortEffect(abilityData) {
  for (const lang of ["pt-BR", "pt", "en"]) {
    const flavor = [...(abilityData.flavor_text_entries || [])].reverse()
      .find(e => e.language.name === lang);
    if (flavor?.flavor_text) return cleanText(flavor.flavor_text);
  }
  const entry = abilityData.effect_entries?.find(e => e.language.name === "en");
  return entry?.short_effect || "";
}

function flattenChain(node, result = []) {
  const url = node.species?.url || "";
  const match = url.match(/\/(\d+)\/$/);
  if (match) result.push({ id: parseInt(match[1], 10) });
  for (const next of (node.evolves_to || [])) flattenChain(next, result);
  return result;
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
