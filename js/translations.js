export const STAT_NAMES_PT = {
  "hp": "Vida",
  "attack": "Ataque",
  "defense": "Defesa",
  "special-attack": "Atq. Especial",
  "special-defense": "Def. Especial",
  "speed": "Velocidade"
};

export const TYPE_NAMES_PT = {
  "normal": "Normal",
  "fire": "Fogo",
  "water": "Água",
  "electric": "Elétrico",
  "grass": "Grama",
  "ice": "Gelo",
  "fighting": "Lutador",
  "poison": "Veneno",
  "ground": "Terra",
  "flying": "Voador",
  "psychic": "Psíquico",
  "bug": "Inseto",
  "rock": "Pedra",
  "ghost": "Fantasma",
  "dragon": "Dragão",
  "dark": "Sombrio",
  "steel": "Metal",
  "fairy": "Fada"
};

export const MOVE_DESC_PT = {
  "tackle": "Investida simples e confiável.",
  "scratch": "Arranhão veloz e direto.",
  "ember": "Lança chamas quentes no alvo.",
  "water-gun": "Jato d'água de média intensidade.",
  "thunder-shock": "Choque elétrico básico. Pode paralisar.",
  "thunderbolt": "Choque elétrico forte. Pode paralisar.",
  "hydro-pump": "Jato de água poderoso e implacável.",
  "quick-attack": "Ataque rápido que quase sempre vence a prioridade.",
  "swift": "Estrelas mágicas que nunca erram.",
  "psychic": "Poder psíquico para confundir e ferir.",
  "earthquake": "Tremor que atinge tudo no campo.",
  "surf": "Onda gigante que causa grande dano.",
  "hyper-beam": "Raio devastador. Recarrega no próximo turno.",
  "ice-beam": "Rajada congelante com chance de congelar.",
  "blizzard": "Tempestade de gelo que pode paralisar.",
  "solar-beam": "Luz solar concentrada. Requer carregamento.",
  "vine-whip": "Chicote de vinhas rápido e afiado.",
  "razor-leaf": "Folhas cortantes com alta chance de acerto crítico.",
  "flamethrower": "Labareda forte com chance de queimar.",
  "sludge-bomb": "Onda tóxica pesada. Pode envenenar.",
  "dragon-rage": "Ataque fixo que causa dano constante.",
  "psybeam": "Raios psíquicos que podem confundir.",
  "iron-tail": "Cauda metálica de impacto poderoso.",
  "brick-break": "Soco que quebra barreiras e defesas.",
  "double-team": "Cria clones que aumentam a evasão.",
  "agility": "Aumenta a velocidade de forma significativa.",
  "rest": "Recupera vida total dormindo por um turno.",
  "fire-blast": "Explosão ígnea devastadora.",
  "thunder": "Relâmpago poderoso com chance de paralisar.",
  "sky-attack": "Ataque aéreo que exige concentração primeiro.",
  "kinesis": "Movimento mental para atrapalhar o oponente.",
  "confusion": "Onda psíquica que pode deixar confuso.",
  "wing-attack": "Asas afiadas cortam o adversário.",
  "razor-wind": "Vento cortante que necessita de preparação.",
  "bubblebeam": "Canhão de bolhas que desacelera o inimigo.",
  "poison-sting": "Faca venenosa com chance de envenenar.",
  "fire-spin": "Círculo de fogo que prende o alvo.",
  "hyper-fang": "Mordida intensa que causa grande dano.",
  "earth-power": "Força sísmica concentrada no terreno.",
  "rock-slide": "Pedras que caem e podem assustar.",
  "shadow-ball": "Esfera sombria que enfraquece defesas especiais.",
  "dragon-breath": "Sopro dracônico que pode paralisar.",
  "brick-break": "Soco que quebra cortes e reflexos.",
  "mega-kick": "Chute poderoso de longo alcance.",
  "body-slam": "Impacto corporal que pode paralisar.",
  "double-edge": "Ataque forte com recuo de vida.",
  "hyper-beam": "Raio devastador. Recarrega no próximo turno.",
  "aerial-ace": "Golpe aéreo que nunca erra.",
  "submission": "Ataque físico intenso de combate.",
  "earthquake": "Tremor que atinge tudo no campo.",
  "poison-jab": "Golpe venenoso com chance de envenenar.",
  "brick-break": "Soco que quebra barreiras e defesas.",
  "solar-beam": "Luz solar concentrada. Requer carregamento.",
  "leaf-blade": "Lâmina de folhas precisa e afiada.",
  "shadow-ball": "Esfera sombria que enfraquece defesas especiais.",
  "focus-punch": "Soco concentrado que falha se receber dano.",
  "rock-smash": "Soco que derruba defesas físicas.",
  "flamethrower": "Labareda forte com chance de queimar.",
  "thunder-punch": "Socos elétricos com chance de paralisar.",
  "poison-gas": "Nuvem venenosa que envolve o adversário.",
  "leech-life": "Drena vida do inimigo para você.",
  "wing-attack": "Asas afiadas cortam o adversário.",
  "dig": "Enterra e ataca na volta.",
  "surf": "Onda gigante que causa grande dano.",
  "ice-punch": "Socos congelantes com chance de congelar.",
  "thunder-punch": "Socos elétricos com chance de paralisar.",
  "shadow-punch": "Punho sombrio que sempre acerta.",
  "aurora-beam": "Feixe gélido que pode baixar ataque.",
  "fire-punch": "Socos flamejantes com chance de queimar.",
  "swift": "Estrelas mágicas que nunca erram."
};

export function describeMove(move) {
  if (!move || typeof move !== "object") return "Movimento desconhecido.";
  const key = move.name;
  if (MOVE_DESC_PT[key]) return MOVE_DESC_PT[key];
  const typeName = TYPE_NAMES_PT[move.type] || move.type;
  if (!move.power || move.power === 0) return "Movimento de status.";
  if (move.power >= 100) return `Ataque ${typeName} devastador.`;
  if (move.power >= 60) return `Ataque ${typeName} sólido.`;
  return `Ataque ${typeName} rápido.`;
}

export const DAMAGE_CLASS_PT = {
  "physical": "Físico",
  "special": "Especial",
  "status": "Status"
};

export function translateMoveName(englishName) {
  if (!englishName) return "—";
  return englishName
    .split("-")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
