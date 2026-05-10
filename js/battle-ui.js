import { initBattle, executeTurn, decideTurnOrder, cpuChooseMove, resolveStatusEffects } from "./battle.js";
import { getPokemonNamePT, fetchPokemon } from "./api.js";
import { TYPE_NAMES_PT, describeMove } from "./translations.js";

const DIFFICULTY_LABEL = {
  easy: "FÁCIL",
  normal: "NORMAL",
  hard: "DIFÍCIL"
};

let currentState = null;

const TYPEWRITER_SPEED = 25;

export async function startBattle(playerId, opponentId, difficulty = "normal") {
  const arena = document.getElementById("arena");
  if (!arena) return;
  arena.innerHTML = `<p style="color:var(--gb-darkest);font-size:1.2rem;text-align:center;padding:2rem;">Carregando batalha...</p>`;

  try {
    const [playerP, opponentP] = await Promise.all([fetchPokemon(playerId), fetchPokemon(opponentId)]);
    const state = await initBattle(playerP, opponentP, difficulty);
    state.player.namePT = getPokemonNamePT(playerId);
    state.opponent.namePT = getPokemonNamePT(opponentId);
    currentState = state;
    renderBattle(state);
    await appendLog(`Modo: ${DIFFICULTY_LABEL[state.difficultyKey] || DIFFICULTY_LABEL.normal}`);
    await appendLog(`Vai, ${state.player.namePT}!`);
    await appendLog(`Um ${state.opponent.namePT} selvagem apareceu!`);
  } catch (e) {
    console.error("Erro ao iniciar batalha:", e);
    arena.innerHTML = `<p class="error-banner">Erro ao iniciar batalha. Tente novamente.</p>`;
  }
}

function renderBattle(state) {
  const arena = document.getElementById("arena");
  const playerSprite = state.player.pokemon.sprites?.back_default
    || state.player.pokemon.sprites?.front_default;
  const opponentSprite = state.opponent.pokemon.sprites?.front_default;

  arena.innerHTML = `
    <div class="arena-stage">
      <div class="combatant opponent" id="combatant-opponent">
        <div class="info">
          <div class="name-row"><span>${state.opponent.namePT}</span></div>
          <div class="hp-label">HP</div>
          <div class="hp-bar-bg"><div class="hp-bar" id="hp-opponent" style="width:100%"></div></div>
          <div class="hp-text" id="hp-text-opponent">${state.opponent.currentHp} / ${state.opponent.maxHp}</div>
          ${state.opponent.statusCondition ? `<div class="status-pill" id="status-opponent">${statusLabel(state.opponent.statusCondition)}</div>` : ""}
        </div>
        <div class="sprite"><img src="${opponentSprite}" alt="${state.opponent.namePT}"></div>
      </div>
      <div class="combatant" id="combatant-player">
        <div class="sprite"><img src="${playerSprite}" alt="${state.player.namePT}"></div>
        <div class="info">
          <div class="name-row"><span>${state.player.namePT}</span></div>
          <div class="hp-label">HP</div>
          <div class="hp-bar-bg"><div class="hp-bar" id="hp-player" style="width:100%"></div></div>
          <div class="hp-text" id="hp-text-player">${state.player.currentHp} / ${state.player.maxHp}</div>
          ${state.player.statusCondition ? `<div class="status-pill" id="status-player">${statusLabel(state.player.statusCondition)}</div>` : ""}
        </div>
      </div>
    </div>
    <div class="battle-bottom">
      <div class="move-grid" id="move-grid">${renderMoves(state)}</div>
      <div class="battle-log" id="battle-log"></div>
    </div>
  `;

  attachMoveListeners();
}

function renderMoves(state) {
  return state.player.moves.map((m, i) => {
    const pp = state.player.currentPp[i];
    const typeName = TYPE_NAMES_PT[m.type] || m.type;
    return `
      <button class="move-btn" data-i="${i}" ${pp <= 0 ? "disabled" : ""}>
        <div class="move-head">
          <span class="move-name">${m.displayName}</span>
          <span class="type-tag ${m.type}">${typeName}</span>
        </div>
        <div class="move-stats">
          <span>PWR ${m.power || "—"}</span>
          <span>ACC ${m.accuracy != null ? m.accuracy + "%" : "—"}</span>
          <span>PP ${pp}/${m.pp}</span>
        </div>
        <div class="move-desc">${describeMove(m)}</div>
      </button>
    `;
  }).join("");
}

function attachMoveListeners() {
  const grid = document.getElementById("move-grid");
  if (!grid) return;
  grid.addEventListener("click", async (e) => {
    const btn = e.target.closest(".move-btn");
    if (!btn || btn.disabled) return;
    const i = parseInt(btn.dataset.i, 10);
    await runRound(i);
  });
}

function statusLabel(condition) {
  if (condition === "poisoned") return "ENVENENADO";
  if (condition === "wet") return "MOLHADO";
  return "";
}

async function runRound(playerMoveIndex) {
  if (!currentState || currentState.status !== "ongoing") return;
  disableMoves();

  const order = decideTurnOrder(currentState);
  await appendLog(order[0] === "player"
    ? "Você é mais rápido e ataca primeiro!"
    : "O adversário é mais rápido e ataca primeiro!");

  for (const actor of order) {
    if (currentState.status !== "ongoing") break;
    if (currentState[actor].currentHp <= 0) continue;

    const moveIndex = actor === "player" ? playerMoveIndex : cpuChooseMove(currentState);
    const targetKey = actor === "player" ? "opponent" : "player";

    const result = executeTurn(currentState, actor, moveIndex);

    for (const line of result.log) {
      await appendLog(line);
    }

    if (result.damage > 0 || result.missed === false && !result.isStatus) {
      shakeSprite(targetKey);
      await animateHpBar(targetKey);
      await sleep(300);
    }

    const statusLogs = resolveStatusEffects(currentState[actor]);
    for (const line of statusLogs) {
      await appendLog(line);
    }
    if (statusLogs.length) {
      await animateHpBar(actor);
      await sleep(250);
    }

    if (currentState[actor].currentHp <= 0) {
      currentState.status = actor === "player" ? "opponent-won" : "player-won";
      await faintSprite(actor);
      await sleep(800);
      showVictory(currentState.status === "player-won" ? "win" : "lose");
      return;
    }

    if (result.targetFainted) {
      await faintSprite(targetKey);
      await sleep(800);
      showVictory(currentState.status === "player-won" ? "win" : "lose");
      return;
    }
  }

  refreshMoves();
  enableMoves();
}

function disableMoves() {
  document.querySelectorAll("#move-grid .move-btn").forEach(b => b.disabled = true);
}
function enableMoves() {
  if (!currentState) return;
  document.querySelectorAll("#move-grid .move-btn").forEach(b => {
    const i = parseInt(b.dataset.i, 10);
    b.disabled = currentState.player.currentPp[i] <= 0;
  });
}
function refreshMoves() {
  const grid = document.getElementById("move-grid");
  if (grid && currentState) grid.innerHTML = renderMoves(currentState);
}

function appendLog(text) {
  return new Promise(resolve => {
    const log = document.getElementById("battle-log");
    if (!log) return resolve();
    const line = document.createElement("span");
    line.className = "line";
    log.prepend(line);
    let i = 0;
    const tick = () => {
      if (i >= text.length) {
        setTimeout(resolve, 350);
        return;
      }
      line.textContent += text[i++];
      setTimeout(tick, TYPEWRITER_SPEED);
    };
    tick();
  });
}

function shakeSprite(side) {
  const el = document.getElementById(`combatant-${side}`);
  if (!el) return;
  el.classList.add("shake");
  setTimeout(() => el.classList.remove("shake"), 600);
}

function animateHpBar(side) {
  return new Promise(resolve => {
    const c = currentState[side];
    const bar = document.getElementById(`hp-${side}`);
    if (!bar) return resolve();
    const pct = Math.max(0, (c.currentHp / c.maxHp) * 100);
    bar.style.width = pct + "%";
    bar.classList.toggle("low", pct < 50 && pct >= 20);
    bar.classList.toggle("critical", pct < 20);
    const txt = document.getElementById(`hp-text-${side}`);
    if (txt) txt.textContent = `${c.currentHp} / ${c.maxHp}`;
    setTimeout(resolve, 700);
  });
}

function faintSprite(side) {
  return new Promise(resolve => {
    const el = document.getElementById(`combatant-${side}`);
    if (!el) return resolve();
    el.classList.add("faint");
    setTimeout(resolve, 800);
  });
}

function showVictory(kind) {
  const overlay = document.getElementById("victory-overlay");
  const title = document.getElementById("victory-title");
  if (!overlay || !title) return;
  title.className = kind === "win" ? "win" : "lose";
  title.textContent = kind === "win" ? "VOCÊ VENCEU!" : "VOCÊ PERDEU!";
  overlay.classList.add("show");
}

export function hideVictoryOverlay() {
  const overlay = document.getElementById("victory-overlay");
  if (overlay) overlay.classList.remove("show");
}

export function getCurrentBattleIds() {
  if (!currentState) return null;
  return {
    playerId: currentState.player.pokemon.id,
    opponentId: currentState.opponent.pokemon.id,
    difficulty: currentState.difficultyKey || "normal"
  };
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
