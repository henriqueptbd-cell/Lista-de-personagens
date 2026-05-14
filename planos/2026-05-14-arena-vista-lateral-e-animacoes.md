# Repaginação da Arena: vista lateral + animações por tipo + menu ATK/DEF/ITEM/FUGIR

**Data:** 2026-05-14
**Branch base:** `develop` (após commit `99be7d3`)
**Referência visual:** mockup enviado pelo usuário (4 quadrantes Game Boy verde; quadrante 3 é a arena alvo: ambos Pokémons em pedestais, HP em cards acima, botões ATK/DEF/ITEM/FUGIR no rodapé)

---

## Contexto

A arena hoje renderiza o sprite `back_default` do jogador (visão de costas, estilo Game Boy clássico) e o `front_default` do oponente. Apesar de imersivo, a perspectiva esconde detalhes do Pokémon do próprio jogador e quebra a paridade visual entre os dois lados.

Pedido do usuário: repaginar a arena pra **vista lateral**, ambos os Pokémons inteiros e visíveis, virados um pro outro, com plataformas/pedestais embaixo dos sprites e painel de HP em card acima. Além disso, **animações de ataque por tipo** — chamas pra fogo, jato pra água, raio pra elétrico, etc. — saindo do atacante e indo até o alvo.

Hoje já existe o hook `playMoveAnimation()` (`js/battle-ui.js:247-262`) que adiciona classes `atk-${damageClass}` e `fx-${type}` por 650ms, mas sem visual real por trás. Vamos substituir por uma animação de projétil-emoji que viaja do atacante ao alvo.

---

## Decisões já validadas com o usuário

1. **Sprites**: Gen V Black/White animados quando disponíveis (gen 1-5), fallback pro `front_default` estático (gen 6+). Player vai aparecer virado pra direita (mirror com `transform: scaleX(-1)`); oponente fica natural. Os dois aparecem inteiros — **não usar mais** `back_default`.
2. **Animações**: emoji Unicode por tipo + keyframes CSS. Cada um dos 18 tipos tem cor e timing próprios.
3. **Painel inferior**: menu clássico em 2 níveis. ATK / DEF / ITEM / FUGIR. ATK abre submenu com 4 moves + botão "‹ VOLTAR". FUGIR pede confirmação. DEF/ITEM ficam "EM BREVE" (desabilitados).

---

## Estado atual relevante (após o último merge na develop)

- `js/battle-ui.js:78-84` → `pickSprite(pokemon, side)`: já tenta Gen V animado, mas **usa `back_default` quando `side === "player"`** — precisa virar sempre front.
- `js/battle-ui.js:43-76` → `renderBattle()`: layout atual com info ao lado do sprite, sem cards em cima, sem plataformas.
- `js/battle-ui.js:86-106` → `renderMoves(state, sideKey)`: grid 2x2 com move-name + stats + descrição. **Reaproveita** dentro do submenu ATK.
- `js/battle-ui.js:126-139` → `awaitMoveChoice(sideKey)`: hoje resolve direto a escolha de move. Vai virar `awaitPlayerAction(sideKey)`, que retorna `{kind: "move", index}` ou `{kind: "run"}`.
- `js/battle-ui.js:141-161` → `runRoundCPU` e `runRoundPvP`: precisam tratar `{kind: "run"}`.
- `js/battle-ui.js:247-262` → `playMoveAnimation(actor, targetKey, move)`: hook existente; vai ser reescrito pra criar um projétil-emoji absoluto sobre `.arena-stage`.
- `index.html:86-95` → `#screen-battle` tem `#arena` (renderizado por JS) + `.pvp-handoff`. Precisa adicionar `.run-confirm-overlay`.

**Nada precisa mudar** em `js/battle.js`, `js/select.js`, `js/main.js`, `js/translations.js`. O motor de batalha já entrega `move.type` e `move.damageClass` necessários.

---

## Mudanças

### 1. `js/battle-ui.js` — `pickSprite` sempre retorna o front

Substituir a função (linha 78-84):

```js
function pickSprite(pokemon) {
  const v = pokemon.sprites?.versions?.["generation-v"]?.["black-white"]?.animated;
  return v?.front_default || pokemon.sprites?.front_default;
}
```

E remover o argumento `side` nas chamadas (linha 45-46):

```js
const playerSprite   = pickSprite(state.player.pokemon);
const opponentSprite = pickSprite(state.opponent.pokemon);
```

### 2. `js/battle-ui.js` — novo layout da `.arena-stage` (cards em cima, plataformas embaixo)

Substituir o `innerHTML` em `renderBattle()` (linhas 48-75):

```js
arena.innerHTML = `
  <div class="arena-stage">
    <div class="combatant opponent" id="combatant-opponent">
      <div class="hp-card">
        <div class="name-row">
          <span class="name">${state.opponent.namePT}</span>
          <span class="lvl">Lv.${state.opponent.level}</span>
        </div>
        <div class="hp-row">
          <span class="hp-label">HP</span>
          <div class="hp-bar-bg"><div class="hp-bar" id="hp-opponent" style="width:100%"></div></div>
          <span class="hp-text" id="hp-text-opponent">${state.opponent.currentHp}/${state.opponent.maxHp}</span>
        </div>
        ${state.opponent.statusCondition ? `<div class="status-pill" id="status-opponent">${statusLabel(state.opponent.statusCondition)}</div>` : ""}
      </div>
      <div class="stage-area">
        <div class="sprite"><img src="${opponentSprite}" alt="${state.opponent.namePT}"></div>
        <div class="platform"></div>
      </div>
    </div>

    <div class="combatant player" id="combatant-player">
      <div class="hp-card">
        <div class="name-row">
          <span class="name">${state.player.namePT}</span>
          <span class="lvl">Lv.${state.player.level}</span>
        </div>
        <div class="hp-row">
          <span class="hp-label">HP</span>
          <div class="hp-bar-bg"><div class="hp-bar" id="hp-player" style="width:100%"></div></div>
          <span class="hp-text" id="hp-text-player">${state.player.currentHp}/${state.player.maxHp}</span>
        </div>
        ${state.player.statusCondition ? `<div class="status-pill" id="status-player">${statusLabel(state.player.statusCondition)}</div>` : ""}
      </div>
      <div class="stage-area">
        <div class="sprite"><img src="${playerSprite}" alt="${state.player.namePT}"></div>
        <div class="platform"></div>
      </div>
    </div>
  </div>

  <div class="battle-bottom">
    <div class="action-panel" id="action-panel">
      <div class="action-prompt" id="action-prompt">O que ${state.player.namePT} vai fazer?</div>
      <div class="action-grid" id="action-grid">
        <button class="action-btn" data-action="atk">▶ ATK</button>
        <button class="action-btn" data-action="def" disabled>DEF</button>
        <button class="action-btn" data-action="item" disabled>ITEM</button>
        <button class="action-btn" data-action="run">FUGIR</button>
      </div>
      <div class="move-grid hidden" id="move-grid"></div>
      <button class="back-btn hidden" id="back-btn">‹ VOLTAR</button>
    </div>
    <div class="battle-log" id="battle-log"></div>
  </div>
`;
```

Notas:
- HP card sobe pro topo (paridade visual com a referência).
- `.stage-area` agrupa sprite + plataforma elíptica.
- O bloco do **jogador** ganha a classe `.player` (hoje vem só vazio), pra o CSS aplicar mirror.
- Painel inferior agora é `.action-panel` com dois "níveis" alternados via classe `.hidden`.

### 3. `js/battle-ui.js` — `awaitPlayerAction` (2 níveis: ATK/DEF/ITEM/FUGIR → moves)

Trocar `awaitMoveChoice` (linhas 126-139) por:

```js
function awaitPlayerAction(sideKey) {
  return new Promise(resolve => {
    const actionGrid = document.getElementById("action-grid");
    const moveGrid   = document.getElementById("move-grid");
    const backBtn    = document.getElementById("back-btn");
    const prompt     = document.getElementById("action-prompt");
    if (!actionGrid) return resolve({ kind: "move", index: 0 });

    actionGrid.classList.remove("hidden");
    moveGrid.classList.add("hidden");
    backBtn.classList.add("hidden");
    prompt.textContent = `O que ${currentState[sideKey].namePT} vai fazer?`;

    const cleanup = () => {
      actionGrid.removeEventListener("click", onAction);
      moveGrid.removeEventListener("click", onMove);
      backBtn.removeEventListener("click", onBack);
    };

    const onAction = (e) => {
      const btn = e.target.closest(".action-btn");
      if (!btn || btn.disabled) return;
      const action = btn.dataset.action;

      if (action === "atk") {
        actionGrid.classList.add("hidden");
        moveGrid.classList.remove("hidden");
        backBtn.classList.remove("hidden");
        moveGrid.innerHTML = renderMoves(currentState, sideKey);
        prompt.textContent = "Escolha um ataque:";
        return;
      }
      if (action === "run") {
        cleanup();
        confirmRun().then(confirmed => {
          if (confirmed) resolve({ kind: "run" });
          else awaitPlayerAction(sideKey).then(resolve);
        });
      }
      // def, item: ignorados (estão disabled)
    };

    const onMove = (e) => {
      const btn = e.target.closest(".move-btn");
      if (!btn || btn.disabled) return;
      cleanup();
      resolve({ kind: "move", index: parseInt(btn.dataset.i, 10) });
    };

    const onBack = () => {
      actionGrid.classList.remove("hidden");
      moveGrid.classList.add("hidden");
      backBtn.classList.add("hidden");
      prompt.textContent = `O que ${currentState[sideKey].namePT} vai fazer?`;
    };

    actionGrid.addEventListener("click", onAction);
    moveGrid.addEventListener("click", onMove);
    backBtn.addEventListener("click", onBack);
  });
}
```

Atualizar `runRoundCPU` (linha 141-146) e `runRoundPvP` (linha 148-161):

```js
async function runRoundCPU() {
  if (!currentState || currentState.status !== "ongoing") return;
  const a = await awaitPlayerAction("player");
  if (a.kind === "run") { await handlePlayerRun("player"); return; }
  const opponentMoveIndex = cpuChooseMove(currentState);
  await resolveRound({ player: a.index, opponent: opponentMoveIndex });
}

async function runRoundPvP() {
  if (!currentState || currentState.status !== "ongoing") return;

  await showHandoff("Vez do Jogador 1", "Passe o aparelho e toque para continuar");
  const a1 = await awaitPlayerAction("player");
  if (a1.kind === "run") { await handlePlayerRun("player"); return; }
  hideActionPanel();

  await showHandoff("Vez do Jogador 2", "Passe o aparelho e toque para continuar");
  const a2 = await awaitPlayerAction("opponent");
  if (a2.kind === "run") { await handlePlayerRun("opponent"); return; }
  hideActionPanel();

  await showHandoff("Batalha!", "", { auto: 700 });
  await resolveRound({ player: a1.index, opponent: a2.index });
}
```

Novos helpers (próximos a `hideMoveGrid`):

```js
function hideActionPanel() {
  document.getElementById("action-grid")?.classList.add("hidden");
  document.getElementById("move-grid")?.classList.add("hidden");
  document.getElementById("back-btn")?.classList.add("hidden");
}

function confirmRun() {
  return new Promise(resolve => {
    const overlay = document.getElementById("run-confirm-overlay");
    if (!overlay) return resolve(false);
    overlay.hidden = false;
    const yes = document.getElementById("run-yes");
    const no  = document.getElementById("run-no");
    const cleanup = () => {
      overlay.hidden = true;
      yes.removeEventListener("click", onYes);
      no.removeEventListener("click", onNo);
    };
    const onYes = () => { cleanup(); resolve(true); };
    const onNo  = () => { cleanup(); resolve(false); };
    yes.addEventListener("click", onYes);
    no.addEventListener("click", onNo);
  });
}

async function handlePlayerRun(side = "player") {
  currentState.status = side === "player" ? "opponent-won" : "player-won";
  await appendLog(`${currentState[side].namePT} fugiu da batalha!`);
  await sleep(600);
  showVictory();
}
```

`hideMoveGrid` (linha 163-166) pode ser removida — `hideActionPanel` cobre o caso.

### 4. `js/battle-ui.js` — `playMoveAnimation` com projétil-emoji por tipo

Substituir totalmente (linhas 247-262):

```js
const TYPE_EMOJI = {
  fire:     "🔥",
  water:    "💧",
  grass:    "🌿",
  electric: "⚡",
  ice:      "❄️",
  ground:   "🪨",
  rock:     "🪨",
  flying:   "🌪️",
  psychic:  "🧠",
  poison:   "☠️",
  bug:      "🐛",
  fighting: "👊",
  ghost:    "👻",
  dragon:   "🐉",
  steel:    "⚙️",
  dark:     "🌑",
  fairy:    "✨",
  normal:   "💥"
};

function playMoveAnimation(actor, targetKey, move) {
  return new Promise(resolve => {
    const stage  = document.querySelector(".arena-stage");
    const fromEl = document.getElementById(`combatant-${actor}`);
    const toEl   = document.getElementById(`combatant-${targetKey}`);
    if (!stage || !fromEl || !toEl) return resolve();

    const stageRect = stage.getBoundingClientRect();
    const fromRect  = fromEl.querySelector(".sprite").getBoundingClientRect();
    const toRect    = toEl.querySelector(".sprite").getBoundingClientRect();

    const startX = fromRect.left - stageRect.left + fromRect.width / 2;
    const startY = fromRect.top  - stageRect.top  + fromRect.height / 2;
    const endX   = toRect.left   - stageRect.left + toRect.width / 2;
    const endY   = toRect.top    - stageRect.top  + toRect.height / 2;

    const type  = move?.type || "normal";
    const emoji = TYPE_EMOJI[type] || TYPE_EMOJI.normal;

    const projectile = document.createElement("div");
    projectile.className = `attack-anim type-${type}`;
    projectile.setAttribute("aria-hidden", "true");
    projectile.textContent = emoji;
    projectile.style.setProperty("--start-x", `${startX}px`);
    projectile.style.setProperty("--start-y", `${startY}px`);
    projectile.style.setProperty("--end-x",   `${endX}px`);
    projectile.style.setProperty("--end-y",   `${endY}px`);
    stage.appendChild(projectile);

    // Glow no alvo durante o impacto (mantém a hook fx-${type} que já existia).
    toEl.classList.add(`fx-${type}`);
    setTimeout(() => toEl.classList.remove(`fx-${type}`), 700);

    setTimeout(() => {
      projectile.remove();
      resolve();
    }, 650);
  });
}
```

### 5. `style.css` — novo layout, mirror, plataformas, painel de ações, animações por tipo

#### 5a. Layout lateral (arena-stage, hp-card, stage-area, platform, mirror)

```css
.arena-stage {
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 1rem;
  padding: 1rem 0.5rem 0;
  min-height: 220px;
}

.combatant {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  max-width: 48%;
}

.hp-card {
  background: var(--gb-bg);
  border: 3px solid var(--gb-dark);
  padding: 0.45rem 0.6rem;
  width: 100%;
  font-family: 'Press Start 2P', monospace;
  font-size: 0.55rem;
  color: var(--gb-darkest);
}
.hp-card .name-row  { display: flex; justify-content: space-between; margin-bottom: 0.3rem; }
.hp-card .hp-row    { display: flex; align-items: center; gap: 0.4rem; }
.hp-card .hp-label  { font-size: 0.5rem; }
.hp-card .hp-bar-bg { flex: 1; height: 8px; background: var(--gb-dark); }
.hp-card .hp-bar    { height: 100%; background: var(--gb-bg); transition: width 0.5s ease; }
.hp-card .hp-bar.low      { background: #c0c020; }
.hp-card .hp-bar.critical { background: #c02020; }
.hp-card .hp-text   { font-size: 0.5rem; }

.stage-area {
  position: relative;
  margin-top: 0.6rem;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.stage-area .sprite img {
  width: 96px;
  height: 96px;
  image-rendering: pixelated;
}

/* Player olha pra direita; oponente fica natural (olhando "pra frente").
 * Como ambos sprites são front-views, espelhar só o player aproxima a vista lateral. */
.combatant.player .sprite img {
  transform: scaleX(-1);
}

.platform {
  width: 110%;
  height: 18px;
  margin-top: -10px;
  background: radial-gradient(ellipse, var(--gb-dark) 30%, transparent 70%);
  opacity: 0.55;
  border-radius: 50%;
}

@media (max-width: 480px) {
  .arena-stage              { min-height: 170px; padding: 0.6rem 0.3rem 0; }
  .stage-area .sprite img   { width: 72px; height: 72px; }
  .hp-card                  { font-size: 0.45rem; padding: 0.3rem 0.4rem; }
  .hp-card .hp-label,
  .hp-card .hp-text         { font-size: 0.42rem; }
}
```

#### 5b. Painel de ações (ATK/DEF/ITEM/FUGIR + moves + back)

```css
.action-panel {
  background: var(--gb-bg);
  border: 3px solid var(--gb-dark);
  padding: 0.6rem 0.6rem 0.7rem;
  position: relative;
}
.action-prompt {
  font-family: 'Press Start 2P', monospace;
  font-size: 0.6rem;
  color: var(--gb-darkest);
  margin-bottom: 0.55rem;
}
.action-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.4rem;
}
.action-btn {
  font-family: 'Press Start 2P', monospace;
  font-size: 0.75rem;
  padding: 0.7rem 0.4rem;
  background: var(--gb-bg);
  border: 3px solid var(--gb-dark);
  color: var(--gb-darkest);
  cursor: pointer;
  text-align: left;
}
.action-btn:hover:not(:disabled),
.action-btn:focus-visible:not(:disabled) {
  background: var(--gb-dark);
  color: var(--gb-bg);
}
.action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.back-btn {
  position: absolute;
  top: -0.6rem;
  left: 0.6rem;
  font-family: 'Press Start 2P', monospace;
  font-size: 0.5rem;
  background: var(--gb-dark);
  color: var(--gb-bg);
  border: 2px solid var(--gb-darkest);
  padding: 0.3rem 0.6rem;
  cursor: pointer;
}

.hidden { display: none !important; }
```

#### 5c. Animações de ataque (`.attack-anim` + keyframes por tipo + glow no alvo)

```css
.attack-anim {
  position: absolute;
  left: 0; top: 0;
  font-size: 2.4rem;
  pointer-events: none;
  z-index: 10;
  filter: drop-shadow(0 0 4px currentColor);
  transform: translate(var(--start-x), var(--start-y));
  animation: attack-base 600ms ease-out forwards;
}

@keyframes attack-base {
  0%   { transform: translate(var(--start-x), var(--start-y)) scale(0.6); opacity: 0; }
  20%  { transform: translate(var(--start-x), var(--start-y)) scale(1.0); opacity: 1; }
  80%  { transform: translate(var(--end-x),   var(--end-y))   scale(1.0); opacity: 1; }
  100% { transform: translate(var(--end-x),   var(--end-y))   scale(1.8); opacity: 0; }
}

/* Cor + microvariação por tipo */
.attack-anim.type-fire     { color: #ff6b35; }
.attack-anim.type-water    { color: #4aa3df; }
.attack-anim.type-grass    { color: #6ec06e; }
.attack-anim.type-electric { color: #f7d11d; animation: attack-electric 500ms steps(8) forwards; }
.attack-anim.type-ice      { color: #9cd9e3; }
.attack-anim.type-ground   { color: #c7a45a; animation: attack-ground 700ms ease-in forwards; }
.attack-anim.type-rock     { color: #8a6a3a; animation: attack-ground 700ms ease-in forwards; }
.attack-anim.type-flying   { color: #a4c4f5; }
.attack-anim.type-psychic  { color: #f06ea0; }
.attack-anim.type-poison   { color: #a040a0; }
.attack-anim.type-bug      { color: #98b830; }
.attack-anim.type-fighting { color: #c03028; }
.attack-anim.type-ghost    { color: #705898; }
.attack-anim.type-dragon   { color: #7038f8; }
.attack-anim.type-steel    { color: #b8b8d0; }
.attack-anim.type-dark     { color: #4f3a2c; }
.attack-anim.type-fairy    { color: #ee99ac; }
.attack-anim.type-normal   { color: #a8a878; }

@keyframes attack-electric {
  0%, 25%, 50%, 75%, 100% {
    transform: translate(var(--end-x),   var(--end-y))   scale(1.4);
    opacity: 1;
  }
  12.5%, 37.5%, 62.5%, 87.5% {
    transform: translate(var(--start-x), var(--start-y)) scale(1);
    opacity: 0.6;
  }
}

@keyframes attack-ground {
  0%   { transform: translate(var(--start-x), calc(var(--start-y) - 40px)) scale(0.8); opacity: 0; }
  30%  { transform: translate(var(--start-x), var(--start-y)) scale(1); opacity: 1; }
  100% { transform: translate(var(--end-x),   var(--end-y))   scale(1.6); opacity: 0; }
}

/* Glow no alvo durante o impacto — reaproveita as classes fx-${type} já criadas pelo JS antigo */
.combatant.fx-fire     { filter: drop-shadow(0 0 6px #ff6b35); }
.combatant.fx-water    { filter: drop-shadow(0 0 6px #4aa3df); }
.combatant.fx-grass    { filter: drop-shadow(0 0 6px #6ec06e); }
.combatant.fx-electric { filter: drop-shadow(0 0 6px #f7d11d); }
.combatant.fx-ice      { filter: drop-shadow(0 0 6px #9cd9e3); }
.combatant.fx-ground,
.combatant.fx-rock     { filter: drop-shadow(0 0 6px #c7a45a); }
.combatant.fx-flying   { filter: drop-shadow(0 0 6px #a4c4f5); }
.combatant.fx-psychic  { filter: drop-shadow(0 0 6px #f06ea0); }
.combatant.fx-poison   { filter: drop-shadow(0 0 6px #a040a0); }
.combatant.fx-bug      { filter: drop-shadow(0 0 6px #98b830); }
.combatant.fx-fighting { filter: drop-shadow(0 0 6px #c03028); }
.combatant.fx-ghost    { filter: drop-shadow(0 0 6px #705898); }
.combatant.fx-dragon   { filter: drop-shadow(0 0 6px #7038f8); }
.combatant.fx-steel    { filter: drop-shadow(0 0 6px #b8b8d0); }
.combatant.fx-dark     { filter: drop-shadow(0 0 6px #4f3a2c); }
.combatant.fx-fairy    { filter: drop-shadow(0 0 6px #ee99ac); }
.combatant.fx-normal   { filter: drop-shadow(0 0 6px #a8a878); }
```

#### 5d. Overlay de confirmação de fuga

```css
.run-confirm-overlay {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex; align-items: center; justify-content: center;
  z-index: 40;
}
.run-confirm-overlay[hidden] { display: none; }
.run-card {
  background: var(--gb-bg);
  border: 4px solid var(--gb-dark);
  padding: 1.4rem;
  text-align: center;
  max-width: 340px;
  font-family: 'Press Start 2P', monospace;
  color: var(--gb-darkest);
}
.run-card h2 { font-size: 0.9rem; margin-bottom: 0.8rem; }
.run-card p  { font-family: 'VT323', monospace; font-size: 1.1rem; margin-bottom: 1.2rem; }
.run-actions { display: flex; gap: 0.6rem; }
.run-actions button {
  flex: 1;
  font-family: 'Press Start 2P', monospace;
  font-size: 0.6rem;
  padding: 0.7rem 0.4rem;
  cursor: pointer;
  border: 3px solid var(--gb-darkest);
}
.run-yes { background: #c02020; color: #fff; }
.run-no  { background: var(--gb-dark); color: var(--gb-bg); }
```

### 6. `index.html` — overlay de confirmação de fuga

Adicionar dentro de `#screen-battle`, ao lado de `.pvp-handoff` (depois da linha 94):

```html
<div class="run-confirm-overlay" id="run-confirm-overlay" hidden>
  <div class="run-card">
    <h2>FUGIR DA BATALHA?</h2>
    <p>Você perde o duelo se fugir agora.</p>
    <div class="run-actions">
      <button class="run-yes" id="run-yes">SIM, FUGIR</button>
      <button class="run-no"  id="run-no">NÃO, VOLTAR</button>
    </div>
  </div>
</div>
```

---

## Arquivos a modificar

- `/home/user/Lista-de-personagens/js/battle-ui.js` — `pickSprite` sem `side`, novo HTML em `renderBattle`, fluxo `awaitPlayerAction` em 2 níveis, helpers `confirmRun`/`handlePlayerRun`/`hideActionPanel`, novo `playMoveAnimation` com projétil-emoji.
- `/home/user/Lista-de-personagens/style.css` — refator de `.arena-stage`, novo `.hp-card`, `.stage-area`, `.platform`, mirror do player, `.action-panel`/`.action-grid`/`.action-btn`/`.back-btn`/`.hidden`, `.attack-anim` + keyframes por tipo + `.fx-${type}`, `.run-confirm-overlay`.
- `/home/user/Lista-de-personagens/index.html` — `#run-confirm-overlay` em `#screen-battle`.

**Não muda**: `js/battle.js`, `js/select.js`, `js/main.js`, `js/translations.js`. O motor de batalha já entrega `move.type` e `move.damageClass`.

---

## Verificação

```bash
cd /home/user/Lista-de-personagens
python3 -m http.server 8000
# Abrir em desktop e mobile (DevTools 375px).
```

**Vista lateral**
- [ ] Tela de batalha mostra ambos os Pokémons inteiros (não mais "costas").
- [ ] Jogador à esquerda olhando pra direita (espelhado). Oponente à direita olhando pra esquerda.
- [ ] Embaixo de cada sprite, plataforma elíptica decorativa.
- [ ] Card de HP acima de cada sprite: nome + Lv. + barra + número + status pill (quando aplicável).
- [ ] Gen 1-5: sprite Gen V animado (respira, balança). Gen 6+: sprite estático front.
- [ ] Mobile 375px: sprites encolhem pra 72px, cards de HP continuam legíveis, sem scroll horizontal.

**Menu de ações**
- [ ] Painel inferior mostra ATK / DEF / ITEM / FUGIR (DEF e ITEM cinzas e desabilitados).
- [ ] Acima dos botões: "O que [Nome] vai fazer?".
- [ ] Clicar ATK: botões somem, aparecem os 4 moves + botão "‹ VOLTAR".
- [ ] Clicar VOLTAR: volta pra ATK/DEF/ITEM/FUGIR.
- [ ] Clicar um move: dispara o turno.
- [ ] Clicar FUGIR: overlay "FUGIR DA BATALHA?" com SIM/NÃO.
  - [ ] SIM: log "[Nome] fugiu da batalha!", vitória do adversário.
  - [ ] NÃO: fecha overlay, volta pro painel de ações.

**Animações**
- [ ] Cada ataque mostra emoji do tipo viajando do atacante ao alvo (~600ms).
- [ ] Fogo (🔥): cresce e some no alvo.
- [ ] Elétrico (⚡): pisca rápido tipo strobe.
- [ ] Terra/Rocha (🪨): cai de cima.
- [ ] Cor da animação varia por tipo (paleta no CSS).
- [ ] Alvo ganha glow (drop-shadow) do tipo durante o impacto.
- [ ] Moves status (sem dano) não disparam animação — `playMoveAnimation` só é chamado quando `!result.missed` e há dano/efeito (lógica existente em `resolveRound`).

**Regressões**
- [ ] Modo PvP: handoff overlay continua funcionando; cada jogador tem seu fluxo ATK→moves.
- [ ] Dificuldade: log "Modo: FÁCIL/NORMAL/DIFÍCIL" no início. Crits/accuracy modificados como antes.
- [ ] Status (envenenado/molhado): pill aparece no card de HP do afetado; veneno tira HP no fim do turno; molhado reduz dano de fogo.
- [ ] Vitória PvP / vs CPU: "JOGADOR 1/2 VENCEU!" ou "VOCÊ VENCEU/PERDEU!".
- [ ] Rematch: usa o mesmo modo + dificuldade.

---

## Riscos & Notas

1. **Sprite espelhado em Pokémons assimétricos** (Voltorb com listra deslocada, Hitmonlee, Drowzee). Aceitável trade-off pela simplicidade. Se virar reclamação, criar `MIRROR_BLOCKLIST = new Set([100, ...])` no `pickSprite` que retorna o sprite sem flip.

2. **GIFs animados Gen V têm fundo transparente**, mas alguns têm leve dithering verde nas bordas no fundo escuro. Se incomodar: aplicar `image-rendering: pixelated; mix-blend-mode: multiply;` no `<img>`. Verificar antes de aplicar.

3. **Posição da animação medida via `getBoundingClientRect`**: se a página rolar durante o typewriter do log, as coordenadas podem ficar erradas. Mitigação: medir dentro do mesmo tick antes de criar o projétil (já é o caso) + `position: sticky` ou `overflow: hidden` no `#arena`. Default: medir no momento da criação, sem fixar.

4. **Modal de fuga + Victory overlay**: garantir z-index — `victory-overlay` precisa estar acima de `run-confirm-overlay`. Já está no CSS atual (victory tem z-index alto), conferir.

5. **Acessibilidade**: emoji do projétil com `aria-hidden="true"`. Botões ATK/DEF/ITEM/FUGIR mantêm texto direto e foco visível (`focus-visible`). Enter/Space funcionam nativamente em `<button>`.

6. **Performance**: 1 elemento DOM criado/removido por ataque (~650ms). Sem leak. Custo desprezível mesmo em batalhas longas.

7. **Animação em moves status**: hoje moves sem dano não disparam projétil (a guarda `if (!result.missed)` em `resolveRound` evita, mas moves status retornam `missed: false, isStatus: true` — o atual passa pela animação. Decidir: pular animação se `result.isStatus` também. **Adicionar `if (!result.missed && !result.isStatus)` antes do `playMoveAnimation`**. Pequena correção no `resolveRound`.

8. **Layout em telas largas (>1200px)**: arena segue o `gb-screen` (max-width existente). Não vira fullscreen — mantém o feeling de console.

9. **HP card "153/153" vs "153 / 153"**: a referência usa sem espaços (`156/156`). Ajustar `hp-text` pra ficar compacto como na imagem (já está no template novo).

10. **Botão FUGIR no PvP**: se Jogador 1 fugir, Jogador 2 vence. `handlePlayerRun(side)` já trata o side certo. Faz sentido mecanicamente.

11. **`fx-${type}` no atacante também?** Hoje só o alvo recebe o glow. Se quiser polir, dá pra adicionar `fromEl.classList.add(\`atk-glow-${type}\`)` por 300ms pra dar feedback "carregando o ataque". Fora do escopo; pode entrar numa iteração futura.

12. **Substituição vs evolução**: este plano substitui o layout antigo (não coexiste). Quem implementar pode deletar com tranquilidade os blocos antigos de `.combatant > .info` no CSS — o novo `.hp-card` toma o lugar.
