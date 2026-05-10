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

export async function startBattle(playerId, opponentId, mode = "cpu", difficulty = "normal") {
  const arena = document.getElementById("arena");
  if (!arena) return;
  arena.innerHTML = `<p style="color:var(--gb-darkest);font-size:1.2rem;text-align:center;padding:2rem;">Carregando batalha...</p>`;

  try {
    const [playerP, opponentP] = await Promise.all([fetchPokemon(playerId), fetchPokemon(opponentId)]);
    const state = await initBattle(playerP, opponentP, mode, difficulty);
    state.player.namePT = getPokemonNamePT(playerId);
    state.opponent.namePT = getPokemonNamePT(opponentId);
    currentState = state;
    renderBattle(state);
    if (mode === "pvp") {
      await appendLog(`Modo: PVP`);
      await appendLog(`Jogador 1 escolheu ${state.player.namePT}!`);
      await appendLog(`Jogador 2 escolheu ${state.opponent.namePT}!`);
    } else {
      await appendLog(`Modo: ${DIFFICULTY_LABEL[state.difficultyKey] || DIFFICULTY_LABEL.normal}`);
      await appendLog(`Vai, ${state.player.namePT}!`);
      await appendLog(`Um ${state.opponent.namePT} selvagem apareceu!`);
    }
    battleLoop();
  } catch (e) {
    console.error("Erro ao iniciar batalha:", e);
    arena.innerHTML = `<p class="error-banner">Erro ao iniciar batalha. Tente novamente.</p>`;
  }
}

function renderBattle(state) {
  const arena = document.getElementById("arena");
  const playerSprite   = pickSprite(state.player.pokemon, "player");
  const opponentSprite = pickSprite(state.opponent.pokemon, "opponent");

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
      <div class="move-grid" id="move-grid"></div>
      <div class="battle-log" id="battle-log"></div>
    </div>
  `;
}

function pickSprite(pokemon, side) {
  const v = pokemon.sprites?.versions?.["generation-v"]?.["black-white"]?.animated;
  if (side === "player") {
    return v?.back_default || pokemon.sprites?.back_default || pokemon.sprites?.front_default;
  }
  return v?.front_default || pokemon.sprites?.front_default;
}

function renderMoves(state, sideKey = "player") {
  const c = state[sideKey];
  return c.moves.map((m, i) => {
    const pp = c.currentPp[i];
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

function statusLabel(condition) {
  if (condition === "poisoned") return "ENVENENADO";
  if (condition === "wet") return "MOLHADO";
  return "";
}

// ─── Battle loop ─────────────────────────────────────────────────────────────

async function battleLoop() {
  while (currentState && currentState.status === "ongoing") {
    if (currentState.mode === "pvp") {
      await runRoundPvP();
    } else {
      await runRoundCPU();
    }
  }
}

function awaitMoveChoice(sideKey) {
  return new Promise(resolve => {
    const grid = document.getElementById("move-grid");
    if (!grid) return resolve(0);
    grid.innerHTML = renderMoves(currentState, sideKey);
    const handler = (e) => {
      const btn = e.target.closest(".move-btn");
      if (!btn || btn.disabled) return;
      grid.removeEventListener("click", handler);
      resolve(parseInt(btn.dataset.i, 10));
    };
    grid.addEventListener("click", handler);
  });
}

async function runRoundCPU() {
  if (!currentState || currentState.status !== "ongoing") return;
  const playerMoveIndex   = await awaitMoveChoice("player");
  const opponentMoveIndex = cpuChooseMove(currentState);
  await resolveRound({ player: playerMoveIndex, opponent: opponentMoveIndex });
}

async function runRoundPvP() {
  if (!currentState || currentState.status !== "ongoing") return;

  await showHandoff("Vez do Jogador 1", "Passe o aparelho e toque para continuar");
  const playerMoveIndex = await awaitMoveChoice("player");
  hideMoveGrid();

  await showHandoff("Vez do Jogador 2", "Passe o aparelho e toque para continuar");
  const opponentMoveIndex = await awaitMoveChoice("opponent");
  hideMoveGrid();

  await showHandoff("Batalha!", "", { auto: 700 });
  await resolveRound({ player: playerMoveIndex, opponent: opponentMoveIndex });
}

function hideMoveGrid() {
  const grid = document.getElementById("move-grid");
  if (grid) grid.innerHTML = "";
}

function showHandoff(title, subtitle, { auto } = {}) {
  return new Promise(resolve => {
    const overlay = document.getElementById("pvp-handoff");
    if (!overlay) return resolve();
    document.getElementById("handoff-title").textContent = title;
    document.getElementById("handoff-sub").textContent   = subtitle;
    const btn = document.getElementById("handoff-btn");
    btn.style.display = auto ? "none" : "";
    overlay.hidden = false;
    if (auto) {
      setTimeout(() => { overlay.hidden = true; resolve(); }, auto);
      return;
    }
    const onClick = () => {
      btn.removeEventListener("click", onClick);
      overlay.hidden = true;
      resolve();
    };
    btn.addEventListener("click", onClick);
  });
}

async function resolveRound(moves) {
  const order  = decideTurnOrder(currentState);
  const faster = currentState[order[0]].namePT;
  await appendLog(`${faster} é mais rápido e ataca primeiro!`);

  for (const actor of order) {
    if (currentState.status !== "ongoing") break;
    if (currentState[actor].currentHp <= 0) continue;

    const moveIndex = moves[actor];
    const targetKey = actor === "player" ? "opponent" : "player";
    const move      = currentState[actor].moves[moveIndex];

    const result = executeTurn(currentState, actor, moveIndex);

    for (const line of result.log) {
      await appendLog(line);
    }

    if (!result.missed) {
      await playMoveAnimation(actor, targetKey, move);
    }

    if (result.damage > 0 || (result.missed === false && !result.isStatus)) {
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
      showVictory();
      return;
    }

    if (result.targetFainted) {
      await faintSprite(targetKey);
      await sleep(800);
      showVictory();
      return;
    }
  }
}

// ─── Animations ──────────────────────────────────────────────────────────────

function playMoveAnimation(actor, targetKey, move) {
  return new Promise(resolve => {
    const attackerEl = document.getElementById(`combatant-${actor}`);
    const targetEl   = document.getElementById(`combatant-${targetKey}`);
    if (!attackerEl || !targetEl) return resolve();
    const klass = move?.damageClass || "physical";
    const type  = move?.type || "normal";
    attackerEl.classList.add(`atk-${klass}`);
    targetEl.classList.add(`fx-${type}`);
    setTimeout(() => {
      attackerEl.classList.remove(`atk-${klass}`);
      targetEl.classList.remove(`fx-${type}`);
      resolve();
    }, 650);
  });
}

// ─── UI helpers ──────────────────────────────────────────────────────────────

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
    const c   = currentState[side];
    const bar = document.getElementById(`hp-${side}`);
    if (!bar) return resolve();
    const pct = Math.max(0, (c.currentHp / c.maxHp) * 100);
    bar.style.width = pct + "%";
    bar.classList.toggle("low",      pct < 50 && pct >= 20);
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

function showVictory() {
  const overlay = document.getElementById("victory-overlay");
  const title   = document.getElementById("victory-title");
  if (!overlay || !title) return;
  const status = currentState.status;
  const mode   = currentState.mode;
  if (mode === "pvp") {
    title.className   = "win";
    title.textContent = status === "player-won" ? "JOGADOR 1 VENCEU!" : "JOGADOR 2 VENCEU!";
  } else {
    title.className   = status === "player-won" ? "win" : "lose";
    title.textContent = status === "player-won" ? "VOCÊ VENCEU!" : "VOCÊ PERDEU!";
  }
  overlay.classList.add("show");
}

export function hideVictoryOverlay() {
  const overlay = document.getElementById("victory-overlay");
  if (overlay) overlay.classList.remove("show");
}

export function getCurrentBattleIds() {
  if (!currentState) return null;
  return {
    playerId:   currentState.player.pokemon.id,
    opponentId: currentState.opponent.pokemon.id,
    difficulty: currentState.difficultyKey || "normal",
    mode:       currentState.mode || "cpu"
  };
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
