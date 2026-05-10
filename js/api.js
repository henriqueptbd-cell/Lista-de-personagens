const API = "https://pokeapi.co/api/v2";
const pokemonCache = new Map();
const moveCache = new Map();
let namesPT = null;

export async function loadTranslations() {
  if (namesPT) return namesPT;
  try {
    const res = await fetch("./data/pokemon-names-ptbr.json");
    if (!res.ok) throw new Error("Falha ao carregar nomes PT-BR");
    namesPT = await res.json();
    return namesPT;
  } catch (e) {
    console.error("loadTranslations:", e);
    namesPT = {};
    return namesPT;
  }
}

export function getPokemonNamePT(id) {
  if (!namesPT) return `#${id}`;
  return namesPT[String(id)] || `#${id}`;
}

export async function fetchPokemon(id) {
  if (pokemonCache.has(id)) return pokemonCache.get(id);
  const res = await fetch(`${API}/pokemon/${id}`);
  if (!res.ok) throw new Error(`Pokemon ${id} indisponível`);
  const data = await res.json();
  pokemonCache.set(id, data);
  return data;
}

export async function fetchMove(idOrName) {
  const key = String(idOrName);
  if (moveCache.has(key)) return moveCache.get(key);
  const res = await fetch(`${API}/move/${key}`);
  if (!res.ok) throw new Error(`Move ${key} indisponível`);
  const data = await res.json();
  moveCache.set(key, data);
  return data;
}

export async function fetchAllGen1(onProgress) {
  const ids = Array.from({ length: 151 }, (_, i) => i + 1);
  const batchSize = 20;
  const results = [];
  let done = 0;
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const fetched = await Promise.all(batch.map(id => fetchPokemon(id).catch(err => {
      console.error(`Erro pokemon ${id}:`, err);
      return null;
    })));
    fetched.forEach(p => { if (p) results.push(p); });
    done += batch.length;
    if (onProgress) onProgress(Math.min(done, 151), 151);
  }
  return results;
}

export function getCachedPokemon(id) {
  return pokemonCache.get(id) || null;
}
