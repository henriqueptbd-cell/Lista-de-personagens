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
