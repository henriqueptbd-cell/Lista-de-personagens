import { fetchMove } from "./api.js";
import { getEffectiveness, getEffectivenessLabel } from "./types.js";
import { translateMoveName } from "./translations.js";

const LEVEL = 50;
const CRIT_CHANCE = 0.0625;
const CRIT_MULT = 1.5;
const STAB_MULT = 1.5;

function statByName(pokemon, name) {
  const s = pokemon.stats.find(x => x.stat.name === name);
  return s ? s.base_stat : 50;
}

function calcHp(base, level = LEVEL) {
  return Math.floor((2 * base + 31) * level / 100) + level + 10;
}

function calcStat(base, level = LEVEL) {
  return Math.floor((2 * base + 31) * level / 100) + 5;
}

export async function selectMovesForPokemon(pokemon) {
  const movePool = pokemon.moves.map(m => m.move.name);
  if (movePool.length === 0) return [];

  const shuffled = [...movePool].sort(() => Math.random() - 0.5);
  const tried = [];
  const collected = [];
  let i = 0;

  while (collected.length < 4 && i < shuffled.length) {
    const slice = shuffled.slice(i, i + 6);
    i += 6;
    const fetched = await Promise.all(slice.map(name =>
      fetchMove(name).catch(() => null)
    ));
    for (const m of fetched) {
      if (!m) continue;
      tried.push(m);
      if (m.power && m.power > 0) {
        collected.push(normalizeMove(m));
        if (collected.length >= 4) break;
      }
    }
  }

  if (collected.length < 4) {
    for (const m of tried) {
      if (collected.length >= 4) break;
      if (!m.power || m.power === 0) {
        collected.push(normalizeMove(m));
      }
    }
  }

  if (collected.length === 0) {
    collected.push({
      name: "tackle",
      displayName: "Tackle",
      power: 40,
      accuracy: 100,
      type: pokemon.types[0]?.type?.name || "normal",
      damageClass: "physical",
      pp: 35
    });
  }

  return collected.slice(0, 4);
}

function normalizeMove(m) {
  return {
    name: m.name,
    displayName: translateMoveName(m.name),
    power: m.power || 0,
    accuracy: m.accuracy ?? 100,
    type: m.type?.name || "normal",
    damageClass: m.damage_class?.name || "physical",
    pp: m.pp || 10
  };
}

export async function createCombatant(pokemon, level = LEVEL) {
  const moves = await selectMovesForPokemon(pokemon);
  return {
    pokemon,
    level,
    maxHp: calcHp(statByName(pokemon, "hp"), level),
    currentHp: calcHp(statByName(pokemon, "hp"), level),
    stats: {
      atk: calcStat(statByName(pokemon, "attack"), level),
      def: calcStat(statByName(pokemon, "defense"), level),
      spAtk: calcStat(statByName(pokemon, "special-attack"), level),
      spDef: calcStat(statByName(pokemon, "special-defense"), level),
      spd: calcStat(statByName(pokemon, "speed"), level)
    },
    types: pokemon.types.map(t => t.type.name),
    moves,
    currentPp: moves.map(m => m.pp)
  };
}

export async function initBattle(playerPokemon, opponentPokemon) {
  const [player, opponent] = await Promise.all([
    createCombatant(playerPokemon),
    createCombatant(opponentPokemon)
  ]);
  return {
    player,
    opponent,
    log: [],
    status: "ongoing"
  };
}

export function calculateDamage(attacker, defender, move) {
  if (!move || move.power === 0) {
    return { damage: 0, effectiveness: 1, crit: false, missed: false, isStatus: true };
  }
  const accuracy = move.accuracy ?? 100;
  if (Math.random() * 100 > accuracy) {
    return { damage: 0, effectiveness: 1, crit: false, missed: true, isStatus: false };
  }
  const crit = Math.random() < CRIT_CHANCE;
  const stab = attacker.types.includes(move.type) ? STAB_MULT : 1;
  const effectiveness = getEffectiveness(move.type, defender.types);
  const isPhysical = move.damageClass === "physical";
  const atk = isPhysical ? attacker.stats.atk : attacker.stats.spAtk;
  const def = isPhysical ? defender.stats.def : defender.stats.spDef;
  const variance = 0.85 + Math.random() * 0.15;

  let damage = Math.floor(((2 * attacker.level / 5 + 2) * move.power * (atk / def)) / 50 + 2);
  damage = Math.floor(damage * stab * effectiveness * (crit ? CRIT_MULT : 1) * variance);
  damage = Math.max(effectiveness === 0 ? 0 : 1, damage);

  return { damage, effectiveness, crit, missed: false, isStatus: false };
}

export function decideTurnOrder(state) {
  const ps = state.player.stats.spd;
  const os = state.opponent.stats.spd;
  if (ps > os) return ["player", "opponent"];
  if (os > ps) return ["opponent", "player"];
  return Math.random() < 0.5 ? ["player", "opponent"] : ["opponent", "player"];
}

export function cpuChooseMove(state) {
  const movesAvailable = state.opponent.moves
    .map((m, i) => ({ m, i, pp: state.opponent.currentPp[i] }))
    .filter(x => x.pp > 0);

  if (movesAvailable.length === 0) {
    return state.opponent.moves.findIndex(m => m) || 0;
  }

  if (Math.random() < 0.3) {
    let best = movesAvailable[0];
    let bestScore = -1;
    for (const x of movesAvailable) {
      const eff = getEffectiveness(x.m.type, state.player.types);
      const score = (x.m.power || 1) * eff;
      if (score > bestScore) { bestScore = score; best = x; }
    }
    return best.i;
  }

  return movesAvailable[Math.floor(Math.random() * movesAvailable.length)].i;
}

export function executeTurn(state, attackerKey, moveIndex) {
  const attacker = state[attackerKey];
  const defenderKey = attackerKey === "player" ? "opponent" : "player";
  const defender = state[defenderKey];
  const move = attacker.moves[moveIndex];
  const log = [];

  if (state.status !== "ongoing") {
    return { damage: 0, effectiveness: 1, crit: false, missed: false, log, targetFainted: false };
  }

  if (state[attackerKey].currentPp[moveIndex] <= 0) {
    log.push(`${attacker.namePT || "Pokémon"} não tem PP em ${move.displayName}!`);
    return { damage: 0, effectiveness: 1, crit: false, missed: true, log, targetFainted: false };
  }

  state[attackerKey].currentPp[moveIndex]--;

  const subjectName = attacker.namePT || translateMoveName(attacker.pokemon.name);
  log.push(`${subjectName} usou ${move.displayName}!`);

  const result = calculateDamage(attacker, defender, move);

  if (result.missed) {
    log.push("Mas errou o ataque!");
    return { ...result, log, targetFainted: false };
  }

  if (result.isStatus) {
    log.push("(Movimento sem dano direto.)");
    return { ...result, log, targetFainted: false };
  }

  defender.currentHp = Math.max(0, defender.currentHp - result.damage);

  if (result.crit) log.push("Acerto crítico!");
  const effLabel = getEffectivenessLabel(result.effectiveness);
  if (effLabel) log.push(effLabel);

  const targetFainted = defender.currentHp <= 0;
  if (targetFainted) {
    const targetName = defender.namePT || translateMoveName(defender.pokemon.name);
    log.push(`${targetName} desmaiou!`);
    state.status = defenderKey === "opponent" ? "player-won" : "opponent-won";
  }

  return { ...result, log, targetFainted };
}
