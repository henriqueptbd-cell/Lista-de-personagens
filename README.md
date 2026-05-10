# 🎮 Pokédex Battle — HC Projetos

Pokédex interativa com **151 pokémons da primeira geração** e uma **arena de batalha completa contra a CPU**, criada como presente para meu irmão mais novo. Mistura estética moderna na entrada (gradientes, partículas animadas, parallax) com nostalgia Game Boy na Pokédex e na Arena.

## 🚀 Funcionalidades

- **Home chamativa**: hero animado com partículas, parallax 3D nos pokémons icônicos, estatísticas com count-up, preview de batalha em loop e curiosidades rotativas — pensada mobile-first.
- **Pokédex completa**: 151 pokémons da Gen 1 buscados dinamicamente da PokéAPI, com nomes em português, tipos, stats e habilidades.
- **Modal de detalhes**: arte oficial em alta resolução, 6 estatísticas (HP, Ataque, Defesa, Atq./Def. Especial, Velocidade) e tags de tipo coloridas.
- **Modo Batalha**: escolha seu pokémon e o adversário (ou sorteie qualquer um deles), 4 moves por lutador (poder, precisão, PP, tipo), efetividade de tipos (super eficaz/pouco eficaz/sem efeito), acertos críticos, STAB, turnos baseados em velocidade, log com efeito typewriter, animações de shake/desmaio, vitória/derrota.
- **Totalmente responsivo**: mobile-first, otimizado pra celular (a maioria vai jogar pelo celular).

## 🛠️ Stack

- **HTML5 + CSS3 + JavaScript ES6 modules** — sem build step, sem framework, sem libs.
- **PokéAPI** — dados em tempo real, com cache em memória.
- **Google Fonts** — Press Start 2P (UI arcade) + VT323 (logs e textos longos).

## 📁 Estrutura

```
.
├── index.html
├── style.css
├── data/
│   └── pokemon-names-ptbr.json
└── js/
    ├── main.js          (bootstrap + hash router)
    ├── api.js           (fetch + cache PokéAPI)
    ├── translations.js  (PT-BR de stats, tipos, classes)
    ├── types.js         (tabela de efetividade 18×18)
    ├── home.js          (landing/hero)
    ├── pokedex.js       (grid + modal de detalhes)
    ├── select.js        (seleção dos lutadores)
    ├── battle.js        (engine de batalha — lógica pura)
    └── battle-ui.js     (render arena + animações)
```

## ▶️ Rodando localmente

Como o projeto usa módulos ES6, precisa ser servido via HTTP (não funciona abrindo o `index.html` direto via `file://`):

```bash
python3 -m http.server 8000
```

Depois abra `http://localhost:8000` no browser.

Em produção (GitHub Pages) funciona direto, sem necessidade de configuração extra.

## 📬 Contato

**HC Projetos**
📧 [henriqueptbd@gmail.com](mailto:henriqueptbd@gmail.com)

---

*Feito com 💚. Dados pelos amigos da [PokéAPI](https://pokeapi.co).*
*© 2026 HC Projetos.*
