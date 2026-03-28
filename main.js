const pokemons = document.querySelectorAll(".pokemon");
const modal = document.getElementById("modal");
const pokemonDetails = document.getElementById("pokemon-details");
const closeBtn = document.querySelector(".close");

// Mapeamento de traduções
const translations = {
    // Estatísticas
    "hp": "Vida",
    "attack": "Ataque",
    "defense": "Defesa",
    "special-attack": "Atq. Especial",
    "special-defense": "Def. Especial",
    "speed": "Velocidade",
    // Tipos
    "grass": "Grama",
    "poison": "Veneno",
    "fire": "Fogo",
    "flying": "Voador",
    "water": "Água",
    "bug": "Inseto",
    "normal": "Normal",
    "electric": "Elétrico",
    "ground": "Terrestre",
    "fairy": "Fada",
    "fighting": "Lutador",
    "psychic": "Psíquico",
    "rock": "Rocha",
    "steel": "Aço",
    "ice": "Gelo",
    "ghost": "Fantasma",
    "dragon": "Dragão"
};

pokemons.forEach(pokemon => {
    pokemon.addEventListener("click", () => {
        const id = pokemon.getAttribute("data-id");
        const namePT = pokemon.querySelector("h2").innerText;
        fetchPokemonDetails(id, namePT);
    });
});

async function fetchPokemonDetails(id, namePT) {
    try {
        pokemonDetails.innerHTML = "<p>Carregando detalhes...</p>";
        modal.style.display = "block";

        const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
        const data = await response.json();

        displayPokemonDetails(data, namePT);
    } catch (error) {
        console.error("Erro ao buscar detalhes:", error);
        pokemonDetails.innerHTML = "<p>Erro ao carregar detalhes.</p>";
    }
}

function displayPokemonDetails(pokemon, namePT) {
    const { stats, abilities, sprites, types } = pokemon;
    
    const imageUrl = sprites.other["official-artwork"].front_default || sprites.front_default;
    
    // Traduzir tipos
    const typesHtml = types.map(t => {
        const typeName = t.type.name;
        return `<span class="type-tag ${typeName}">${translations[typeName] || typeName}</span>`;
    }).join("");

    const statsHtml = stats.map(s => `
        <div class="stat-item">
            <span>${translations[s.stat.name] || s.stat.name}</span>
            <strong>${s.base_stat}</strong>
        </div>
    `).join("");

    const abilitiesHtml = abilities.slice(0, 4).map(a => `
        <span class="attack-tag">${a.ability.name.replace("-", " ")}</span>
    `).join("");

    pokemonDetails.innerHTML = `
        <img src="${imageUrl}" alt="${namePT}">
        <h2>${namePT}</h2>
        <div class="types-modal">${typesHtml}</div>
        
        <div class="stats-container">
            ${statsHtml}
        </div>

        <div class="attacks-container">
            <h3>Habilidades / Ataques</h3>
            <div class="attack-list">
                ${abilitiesHtml}
            </div>
        </div>
    `;
}

closeBtn.onclick = () => modal.style.display = "none";
window.onclick = (event) => {
    if (event.target == modal) {
        modal.style.display = "none";
    }
};

