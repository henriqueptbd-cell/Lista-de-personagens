# Modo Batalha PvP (Jogador vs Jogador, hot-seat local)

## Contexto

Hoje a batalha é exclusivamente vs CPU — a função `cpuChooseMove(state)` em `js/battle.js:148` decide o ataque do adversário automaticamente, e a tela de seleção (`js/select.js`) trata os dois slots como "Jogador" e "Adversário (CPU)".

O objetivo é adicionar um **modo PvP local hot-seat**: dois jogadores humanos usando o mesmo aparelho, com escolhas de ataque feitas em segredo (cada um vê os próprios moves só na sua vez), simulando o feeling do Pokémon clássico onde os dois ataques são escolhidos em paralelo e resolvidos depois pela ordem de velocidade.

**Decisões já validadas com o usuário:**
- **Turno**: simultâneo, em segredo (handoff "passe o aparelho" entre as duas escolhas, depois resolve por velocidade).
- **Entrada**: toggle "vs CPU / vs Amigo" na tela de seleção atual. Modo vs CPU permanece intacto.
- **Privacidade**: ocultar moves entre as duas escolhas. HP, sprites e log continuam visíveis.
- **Vitória**: "Jogador 1 Venceu!" / "Jogador 2 Venceu!".
- **Rematch**: mantém os mesmos Pokémons e o mesmo modo.

O motor de batalha (`battle.js`) já é agnóstico ao tipo de jogador — `executeTurn(state, attackerKey, moveIndex)` em `js/battle.js:171` aceita `"player"` e `"opponent"` igualmente. A maior parte do trabalho fica no fluxo de UI em `battle-ui.js`.

---

## Estado atual relevante (pra contextualizar quem for executar)

- `js/select.js:4` → `state = { player: null, opponent: null }` — sem modo.
- `js/select.js:38-43` → callback recebe só `(playerId, opponentId)`.
- `js/main.js:45-48` → repassa pra `startBattle(playerId, opponentId)`.
- `js/battle.js:104` → `initBattle(playerPokemon, opponentPokemon)` — não conhece modo.
- `js/battle-ui.js:91` → `runRound(playerMoveIndex)`: chama `cpuChooseMove` direto na linha 100.
- `js/battle-ui.js:196-203` → `showVictory(kind)` mostra texto fixo "VOCÊ VENCEU!" / "VOCÊ PERDEU!".
- `js/battle-ui.js:210-216` → `getCurrentBattleIds()` retorna só `playerId`/`opponentId` (usado pelo rematch em `main.js:97`).
- `index.html` em `#screen-select`: tem 2 `.slot[data-slot="player|opponent"]` com botão de início; **não tem** seletor de modo ainda.

---

## Mudanças

### 1. `js/select.js` — toggle de modo + labels dinâmicos

- Estado: trocar `state` para `{ player: null, opponent: null, mode: "cpu" }`.
- Em `attachListeners()`, adicionar listener pro toggle de modo (botões `.mode-btn` adicionados no HTML — ver passo 5):
  ```js
  document.querySelectorAll(".mode-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      state.mode = btn.dataset.mode; // "cpu" | "pvp"
      document.querySelectorAll(".mode-btn").forEach(b =>
        b.classList.toggle("active", b === btn)
      );
      updateSlotLabels();
    });
  });
  ```
- Adicionar `updateSlotLabels()`:
  ```js
  function updateSlotLabels() {
    const isPvp = state.mode === "pvp";
    const playerLabel = document.querySelector('.slot[data-slot="player"] .slot-title');
    const oppLabel    = document.querySelector('.slot[data-slot="opponent"] .slot-title');
    if (playerLabel) playerLabel.textContent = isPvp ? "JOGADOR 1" : "JOGADOR";
    if (oppLabel)    oppLabel.textContent    = isPvp ? "JOGADOR 2" : "ADVERSÁRIO";
  }
  ```
  Chamar `updateSlotLabels()` ao final de `initSelect()` pra setar o estado inicial.
- Callback final passa o modo: `onStartCallback(state.player, state.opponent, state.mode)` (linha 40).
- Em `resetSelect()`, **não** resetar o modo — é uma preferência que pode persistir entre batalhas.

### 2. `js/main.js` — repassar o modo

- `initSelect(allPokemons, (playerId, opponentId, mode) => { location.hash = "#/battle"; startBattle(playerId, opponentId, mode); });` (linha 45-48).
- `initVictoryActions()` no rematch: usar `ids.mode` também:
  ```js
  if (ids) startBattle(ids.playerId, ids.opponentId, ids.mode);
  ```

### 3. `js/battle.js` — guardar modo no state

- `initBattle(playerPokemon, opponentPokemon, mode = "cpu")` — aceitar 3º arg.
- Salvar `mode` no state retornado:
  ```js
  return { player, opponent, log: [], status: "ongoing", mode };
  ```
- **Nenhuma outra função de `battle.js` muda** — `executeTurn`, `decideTurnOrder`, `calculateDamage` já são agnósticas. `cpuChooseMove` continua existindo, só não será chamada em PvP.

### 4. `js/battle-ui.js` — núcleo da feature

#### 4a. `startBattle` aceita modo

```js
export async function startBattle(playerId, opponentId, mode = "cpu") {
  // ...
  const state = await initBattle(playerP, opponentP, mode);
  // ...
  if (mode === "pvp") {
    await appendLog(`Jogador 1 escolheu ${state.player.namePT}!`);
    await appendLog(`Jogador 2 escolheu ${state.opponent.namePT}!`);
  } else {
    await appendLog(`Vai, ${state.player.namePT}!`);
    await appendLog(`Um ${state.opponent.namePT} selvagem apareceu!`);
  }
}
```

#### 4b. `renderMoves` parametrizado por lado

Hoje renderiza sempre `state.player.moves`. Trocar para:
```js
function renderMoves(state, sideKey = "player") {
  const c = state[sideKey];
  return c.moves.map((m, i) => {
    const pp = c.currentPp[i];
    const typeName = TYPE_NAMES_PT[m.type] || m.type;
    return `
      <button class="move-btn" data-i="${i}" ${pp <= 0 ? "disabled" : ""}>
        <span class="move-name">${m.displayName}</span>
        <span class="move-meta">
          <span class="type-tag ${m.type}">${typeName}</span>
          <span>PP ${pp}/${m.pp}</span>
        </span>
      </button>
    `;
  }).join("");
}
```
Atualizar a chamada inicial em `renderBattle` para `renderMoves(state, "player")`.

#### 4c. Listener de move via Promise (uma escolha por vez)

O listener atual em `attachMoveListeners` é "infinito" — dispara `runRound` a cada clique. No PvP, precisamos esperar **uma** escolha de cada vez. Refatorar:

- Remover o `addEventListener` permanente — em vez disso, expor uma função `awaitMoveChoice(sideKey)`:
  ```js
  function awaitMoveChoice(sideKey) {
    return new Promise(resolve => {
      const grid = document.getElementById("move-grid");
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
  ```
- No modo CPU, o `runRound` antigo (gatilho via clique) continua valendo, mas reescrito pra usar `awaitMoveChoice`:
  ```js
  async function battleLoop() {
    while (currentState.status === "ongoing") {
      if (currentState.mode === "pvp") {
        await runRoundPvP();
      } else {
        await runRoundCPU();
      }
    }
  }
  ```
- `startBattle` chama `battleLoop()` depois dos logs iniciais.

#### 4d. `runRoundCPU` (modo atual, agora orquestrado por Promise)

```js
async function runRoundCPU() {
  const playerMoveIndex = await awaitMoveChoice("player");
  const opponentMoveIndex = cpuChooseMove(currentState);
  await resolveRound({ player: playerMoveIndex, opponent: opponentMoveIndex });
}
```

#### 4e. `runRoundPvP` (novo)

```js
async function runRoundPvP() {
  await showHandoff("Vez do Jogador 1", "Passe o aparelho e toque para continuar");
  const playerMoveIndex = await awaitMoveChoice("player");
  hideMoveGrid();

  await showHandoff("Vez do Jogador 2", "Passe o aparelho e toque para continuar");
  const opponentMoveIndex = await awaitMoveChoice("opponent");
  hideMoveGrid();

  await showHandoff("Batalha!", "", { auto: 700 });
  await resolveRound({ player: playerMoveIndex, opponent: opponentMoveIndex });
}
```

Helpers novos:
- `hideMoveGrid()`: limpa `#move-grid` com `innerHTML = ""` — garante que ninguém vê os moves do outro durante a transição.
- `showHandoff(title, subtitle, { auto } = {})`: mostra o overlay `#pvp-handoff`, troca os textos, retorna Promise que resolve no clique do botão "Continuar" — ou após `auto` ms se passado (pra o "Batalha!" não exigir clique).

#### 4f. `resolveRound` — extrai a lógica de execução do `runRound` atual

```js
async function resolveRound(moves) { // moves = { player, opponent }
  const order = decideTurnOrder(currentState);
  for (const actor of order) {
    if (currentState.status !== "ongoing") break;
    if (currentState[actor].currentHp <= 0) continue;

    const moveIndex = moves[actor];
    const targetKey = actor === "player" ? "opponent" : "player";
    const result = executeTurn(currentState, actor, moveIndex);

    for (const line of result.log) await appendLog(line);

    if (result.damage > 0 || (result.missed === false && !result.isStatus)) {
      shakeSprite(targetKey);
      await animateHpBar(targetKey);
      await sleep(300);
    }

    if (result.targetFainted) {
      await faintSprite(targetKey);
      await sleep(800);
      showVictory();
      return;
    }
  }
}
```

#### 4g. `showVictory` parametrizado pelo modo

```js
function showVictory() {
  const overlay = document.getElementById("victory-overlay");
  const title = document.getElementById("victory-title");
  if (!overlay || !title) return;
  const status = currentState.status; // "player-won" | "opponent-won"
  const mode = currentState.mode;
  if (mode === "pvp") {
    title.className = "win";
    title.textContent = status === "player-won" ? "JOGADOR 1 VENCEU!" : "JOGADOR 2 VENCEU!";
  } else {
    title.className = status === "player-won" ? "win" : "lose";
    title.textContent = status === "player-won" ? "VOCÊ VENCEU!" : "VOCÊ PERDEU!";
  }
  overlay.classList.add("show");
}
```

#### 4h. `getCurrentBattleIds` retorna também o modo

```js
return {
  playerId: currentState.player.pokemon.id,
  opponentId: currentState.opponent.pokemon.id,
  mode: currentState.mode
};
```

### 5. `index.html` — toggle de modo + overlay de handoff

#### 5a. Tela de seleção (`#screen-select`)

Antes do bloco `.slots` (linha ~48), adicionar:
```html
<div class="mode-toggle">
  <button class="mode-btn active" data-mode="cpu">🤖 vs CPU</button>
  <button class="mode-btn" data-mode="pvp">👥 vs AMIGO</button>
</div>
```
Em cada `.slot`, garantir que existe um `<span class="slot-title">JOGADOR</span>` (ou equivalente) que o `updateSlotLabels()` possa atualizar. Se hoje for um `<h3>`, dar a ele a classe `slot-title` (mudança mínima).

#### 5b. Tela de batalha (`#screen-battle`)

Adicionar dentro de `#screen-battle`, **fora** do `.arena` (irmão), o overlay:
```html
<div class="pvp-handoff" id="pvp-handoff" hidden>
  <div class="handoff-card">
    <h2 class="handoff-title" id="handoff-title">Vez do Jogador 1</h2>
    <p class="handoff-sub" id="handoff-sub">Passe o aparelho e toque para continuar</p>
    <button class="handoff-btn" id="handoff-btn">TOCAR PARA CONTINUAR</button>
  </div>
</div>
```

### 6. `style.css` — toggle e handoff

#### 6a. `.mode-toggle`

```css
.mode-toggle {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  margin: 0 auto 1rem;
}
.mode-btn {
  font-family: 'Press Start 2P', monospace;
  font-size: 0.7rem;
  padding: 0.6rem 1rem;
  background: var(--gb-bg);
  color: var(--gb-darkest);
  border: 3px solid var(--gb-dark);
  cursor: pointer;
}
.mode-btn.active {
  background: var(--gb-dark);
  color: var(--gb-bg);
}
@media (max-width: 480px) {
  .mode-btn { font-size: 0.55rem; padding: 0.5rem 0.7rem; }
}
```

#### 6b. `.pvp-handoff` (overlay fullscreen sobre a tela de batalha)

```css
.pvp-handoff {
  position: fixed;
  inset: 0;
  background: var(--gb-darkest);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}
.pvp-handoff[hidden] { display: none; }
.handoff-card {
  background: var(--gb-bg);
  border: 4px solid var(--gb-dark);
  padding: 2rem;
  text-align: center;
  max-width: 360px;
}
.handoff-title {
  font-family: 'Press Start 2P', monospace;
  font-size: 1rem;
  color: var(--gb-darkest);
  margin-bottom: 1rem;
}
.handoff-sub {
  font-family: 'VT323', monospace;
  font-size: 1.1rem;
  color: var(--gb-dark);
  margin-bottom: 1.5rem;
}
.handoff-btn {
  font-family: 'Press Start 2P', monospace;
  font-size: 0.7rem;
  padding: 1rem 1.5rem;
  background: var(--gb-dark);
  color: var(--gb-bg);
  border: 3px solid var(--gb-darkest);
  cursor: pointer;
  width: 100%;
}
.handoff-btn:active { transform: translateY(2px); }
```

Implementação JS do `showHandoff` (em `battle-ui.js`):
```js
function showHandoff(title, subtitle, { auto } = {}) {
  return new Promise(resolve => {
    const overlay = document.getElementById("pvp-handoff");
    document.getElementById("handoff-title").textContent = title;
    document.getElementById("handoff-sub").textContent = subtitle;
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
```

---

## Arquivos a modificar

- `/home/user/Lista-de-personagens/index.html` — toggle de modo em `#screen-select`, overlay handoff em `#screen-battle`, `slot-title` nas slots.
- `/home/user/Lista-de-personagens/style.css` — `.mode-toggle`/`.mode-btn`, `.pvp-handoff`/`.handoff-*`.
- `/home/user/Lista-de-personagens/js/select.js` — `state.mode`, toggle listener, `updateSlotLabels()`, callback com 3º arg.
- `/home/user/Lista-de-personagens/js/main.js` — recebe e repassa `mode` em `initSelect` e no rematch.
- `/home/user/Lista-de-personagens/js/battle.js` — `initBattle(player, opp, mode="cpu")`, salva `state.mode`.
- `/home/user/Lista-de-personagens/js/battle-ui.js` — refatoração: `awaitMoveChoice`, `battleLoop`, `runRoundCPU`, `runRoundPvP`, `resolveRound`, `showHandoff`, `hideMoveGrid`, `renderMoves(state, sideKey)`, `showVictory` por modo, `getCurrentBattleIds` com `mode`.

**Branch**: `claude/fix-site-visibility-HpGHL`.

---

## Verificação

```bash
cd /home/user/Lista-de-personagens
python3 -m http.server 8000
# Abrir http://localhost:8000 em DevTools mobile (375px) e desktop.
```

Checklist:

- [ ] Tela de seleção mostra dois botões: "🤖 vs CPU" (selecionado por padrão) e "👥 vs AMIGO".
- [ ] Clicar "vs AMIGO" troca o título dos slots para "JOGADOR 1" e "JOGADOR 2". Clicar "vs CPU" volta pra "JOGADOR" / "ADVERSÁRIO".
- [ ] **Modo vs CPU (regressão)**: começar uma batalha normal — não tem nenhuma tela de handoff, fluxo idêntico ao atual. Vitória mostra "VOCÊ VENCEU!" / "VOCÊ PERDEU!".
- [ ] **Modo vs AMIGO**:
  - [ ] Logs iniciais dizem "Jogador 1 escolheu Charizard!" / "Jogador 2 escolheu Blastoise!".
  - [ ] Overlay fullscreen "Vez do Jogador 1 — Passe o aparelho e toque para continuar" cobre os moves.
  - [ ] Ao clicar "TOCAR PARA CONTINUAR", overlay some, grid de moves do Jogador 1 aparece.
  - [ ] Clicar um move: grid desaparece imediatamente (nem se vê o "botão clicado").
  - [ ] Surge overlay "Vez do Jogador 2". Repete o fluxo com os moves do Pokémon do Jogador 2.
  - [ ] Após Jogador 2 clicar, overlay "Batalha!" aparece por ~700ms e some sozinho.
  - [ ] Os 2 ataques resolvem por ordem de velocidade (igual modo CPU): log + animações de HP + shake.
  - [ ] Se ninguém desmaiar, volta pra overlay "Vez do Jogador 1" — próximo turno.
  - [ ] Quando alguém desmaia, vitória mostra "JOGADOR 1 VENCEU!" ou "JOGADOR 2 VENCEU!" (sem "você perdeu").
- [ ] **Rematch**: após vitória em PvP, "Lutar de novo" reinicia a batalha **no modo PvP** com os mesmos Pokémons (volta direto pra "Vez do Jogador 1", sem voltar pra seleção).
- [ ] **Privacidade**: durante o overlay "Vez do Jogador 2", os moves do Jogador 1 **não** são visíveis em lugar nenhum da tela. HP/sprites continuam visíveis (intencional).
- [ ] **Mobile 375px**: overlay handoff cabe na tela, botão é grande o suficiente para tocar, toggle no select não quebra layout.
- [ ] Trocar de modo após uma batalha (voltar pra `#/select`): toggle ainda lembra a seleção anterior (não reseta).

---

## Riscos & Notas

1. **Refator do listener de moves**: hoje `attachMoveListeners()` instala um listener permanente que chama `runRound` direto. Trocar pra um loop com `awaitMoveChoice` é uma mudança estrutural — precisa garantir que o modo CPU continue funcionando exatamente igual. Por isso o checklist tem item explícito de regressão CPU.

2. **`battleLoop` precisa parar quando alguém faint**: `resolveRound` retorna após chamar `showVictory()`, mas o `while` em `battleLoop` checa `currentState.status !== "ongoing"` — então o loop encerra naturalmente. Importante: se durante `executeTurn` o status virar `"player-won"`/`"opponent-won"` no meio da ordem, o segundo ataque é pulado pelo `if (currentState.status !== "ongoing") break;` dentro do for. Já é o comportamento atual — manter.

3. **Confirmação de move**: o clique no botão de move resolve a Promise imediatamente — não há "tem certeza?". Em hot-seat, um toque acidental compromete o turno do jogador. Se virar reclamação, dá pra adicionar uma etapa "Confirmar ataque" depois — fora do escopo deste plano.

4. **Velocidade no PvP**: `decideTurnOrder` usa `stats.spd` igual no PvP. Se os dois Pokémons tiverem velocidades muito diferentes, sempre o mais rápido ataca primeiro. Isso é fiel ao Pokémon clássico e mantém consistência com o modo CPU. Não mudar agora.

5. **Layout do toggle de modo + slots**: o toggle adiciona altura à tela de seleção. Conferir no mobile que o botão "INICIAR BATALHA" não fica abaixo da dobra; se ficar, reduzir `margin-bottom` do `.mode-toggle` ou compactar a seção de slots.

6. **Estado do `mode` em `resetSelect`**: a função é chamada em `main.js:86` toda vez que se entra em `#/select`. Manter o modo entre batalhas é uma decisão de UX (jogador que estava em PvP provavelmente quer continuar em PvP). Documentado no passo 1.

7. **z-index do `.pvp-handoff`**: precisa ficar acima do header/nav mas abaixo do `#victory-overlay` (caso a vitória dispare em paralelo com algum bug). Definido como `z-index: 50` no CSS; conferir se o `#victory-overlay` é maior (pelo CSS atual deve ser, mas vale verificar).

---

# Plano 2 — Animações de Ataque (reaproveitáveis, sem assets novos)

## Contexto

Hoje, durante um ataque, só existe `.shake` no defensor (`js/battle-ui.js:163-168` + keyframes em `style.css` ~linha 930) e `.faint` quando alguém desmaia (~linha 938). O "golpe" em si é só uma linha de log + a HP bar caindo — falta um feedback visual do ataque acontecendo.

A pista do irmão do usuário é boa: **não dá pra desenhar uma animação por move** (150+ moves), mas dá pra agrupar por **2 dimensões que a PokéAPI já fornece**:

- `move.damage_class` → `"physical" | "special" | "status"` (3 categorias)
- `move.type` → 17 tipos canônicos (fire, water, electric, ...)

Com **3 animações de movimento do atacante × 17 efeitos coloridos no defensor**, cobrimos 100% dos moves usando ~20 classes CSS. Tudo CSS puro + JS pra adicionar/remover classe — sem libs, sem GIFs externos.

**Bônus opcional** que a PokéAPI já entrega de graça: `pokemon.sprites.versions['generation-v']['black-white'].animated.{front,back}_default` — são GIFs animados (idle) dos sprites pixel da Gen V. Cobrem quase toda a Gen 1 e dão "vida" ao Pokémon parado. Fallback obrigatório pros que não têm.

## Decisões

- **Animar por (damage_class, type)**, não por nome do move. Código mínimo, cobertura total.
- **Pura CSS + JS de orquestração**. Sem libs (anime.js, GSAP, etc).
- **Tempo curto**: 600-700ms por animação — não atrapalha o fluxo do turno.
- **Acessível**: respeita `prefers-reduced-motion` (encurta tudo pra ~150ms).
- **Sprites Gen V animados**: incluído neste plano como passo opcional (fácil de remover se não rolar).

---

## Mudanças

### 1. `js/battle-ui.js` — orquestrar a animação

Criar helper `playMoveAnimation(actor, targetKey, move)`:
```js
function playMoveAnimation(actor, targetKey, move) {
  return new Promise(resolve => {
    const attackerEl = document.getElementById(`combatant-${actor}`);
    const targetEl   = document.getElementById(`combatant-${targetKey}`);
    if (!attackerEl || !targetEl) return resolve();

    const klass = move.damageClass || "physical"; // "physical" | "special" | "status"
    const type  = move.type || "normal";

    attackerEl.classList.add(`atk-${klass}`);
    targetEl.classList.add(`fx-${type}`);

    setTimeout(() => {
      attackerEl.classList.remove(`atk-${klass}`);
      targetEl.classList.remove(`fx-${type}`);
      resolve();
    }, 650);
  });
}
```

Integrar em `resolveRound` (do plano PvP) ou no `runRound` atual, **logo após** o `log.push("X usou Y!")` e **antes** do `shakeSprite` + `animateHpBar`:

```js
// ...para cada ataque dentro da ordem:
const result = executeTurn(currentState, actor, moveIndex);
for (const line of result.log) await appendLog(line);

if (!result.missed) {
  await playMoveAnimation(actor, targetKey, currentState[actor].moves[moveIndex]);
}

if (result.damage > 0 || (result.missed === false && !result.isStatus)) {
  shakeSprite(targetKey);
  await animateHpBar(targetKey);
  await sleep(300);
}
```

Detalhe: se `result.missed === true`, pular `playMoveAnimation` — o ataque "passou batido" e não precisa de FX no defensor. Pode-se animar só o atacante com `atk-*` (efeito de "lançou pro nada") mas mantenho simples no v1.

### 2. `style.css` — keyframes do **atacante** (por damage_class)

```css
/* === PHYSICAL: corpo a corpo, projeta o sprite no oponente === */
@keyframes atk-physical-player {
  0%   { transform: translateX(0); }
  40%  { transform: translateX(50px) scale(1.08); }
  55%  { transform: translateX(50px) scale(1.08); }
  100% { transform: translateX(0); }
}
@keyframes atk-physical-opponent {
  0%   { transform: translateX(0); }
  40%  { transform: translateX(-50px) scale(1.08); }
  55%  { transform: translateX(-50px) scale(1.08); }
  100% { transform: translateX(0); }
}
.combatant.atk-physical .sprite img {
  animation: atk-physical-player 0.6s ease-out;
}
.combatant.opponent.atk-physical .sprite img {
  animation: atk-physical-opponent 0.6s ease-out;
}

/* === SPECIAL: recua, carrega brilho, dispara === */
@keyframes atk-special {
  0%   { transform: scale(1)              translateX(0);    filter: brightness(1); }
  25%  { transform: scale(0.9)            translateX(-15px); filter: brightness(1.3) saturate(1.4); }
  55%  { transform: scale(1.05)           translateX(0);    filter: brightness(1.8) saturate(1.6); }
  100% { transform: scale(1)              translateX(0);    filter: brightness(1); }
}
.combatant.atk-special .sprite img { animation: atk-special 0.65s ease-out; }
.combatant.opponent.atk-special .sprite img {
  /* mesma animação, eixo X invertido via mirror se necessário — opcional, na maioria fica bom igual */
}

/* === STATUS: aura pulsante, sem deslocar === */
@keyframes atk-status {
  0%, 100% { transform: scale(1);    filter: brightness(1)  saturate(1); }
  50%      { transform: scale(1.08); filter: brightness(1.5) saturate(1.6) hue-rotate(15deg); }
}
.combatant.atk-status .sprite img { animation: atk-status 0.6s ease-in-out; }
```

### 3. `style.css` — keyframes do **efeito no defensor** (por tipo)

Único keyframe de "flash radial", colorido por variável CSS:

```css
.combatant .sprite { position: relative; overflow: visible; }
.combatant .sprite::after {
  content: "";
  position: absolute;
  inset: -20%;
  pointer-events: none;
  opacity: 0;
  border-radius: 50%;
  background: radial-gradient(circle, var(--fx-color, white) 0%, transparent 65%);
  mix-blend-mode: screen;
}
@keyframes fx-flash {
  0%   { opacity: 0;   transform: scale(0.4); }
  30%  { opacity: 0.95; transform: scale(1.2); }
  70%  { opacity: 0.6; transform: scale(1.4); }
  100% { opacity: 0;   transform: scale(1.6); }
}
.combatant[class*="fx-"] .sprite::after { animation: fx-flash 0.55s ease-out; }

/* Paleta por tipo — mesmas cores dos type-tag */
.combatant.fx-fire     { --fx-color: #ff5722; }
.combatant.fx-water    { --fx-color: #2196f3; }
.combatant.fx-electric { --fx-color: #ffeb3b; }
.combatant.fx-grass    { --fx-color: #4caf50; }
.combatant.fx-ice      { --fx-color: #90caf9; }
.combatant.fx-fighting { --fx-color: #b71c1c; }
.combatant.fx-poison   { --fx-color: #9c27b0; }
.combatant.fx-ground   { --fx-color: #8d6e63; }
.combatant.fx-flying   { --fx-color: #b3e5fc; }
.combatant.fx-psychic  { --fx-color: #e91e63; }
.combatant.fx-bug      { --fx-color: #8bc34a; }
.combatant.fx-rock     { --fx-color: #795548; }
.combatant.fx-ghost    { --fx-color: #7b1fa2; }
.combatant.fx-dragon   { --fx-color: #5e35b1; }
.combatant.fx-dark     { --fx-color: #424242; }
.combatant.fx-steel    { --fx-color: #b0bec5; }
.combatant.fx-fairy    { --fx-color: #f48fb1; }
.combatant.fx-normal   { --fx-color: #fafafa; }
```

Bônus: se quiser variar mais com pouco código, dá pra trocar o gradiente por uma propriedade `--fx-shape` (radial vs riscado vs raio) e definir 3-4 "shapes" — ex: `electric` usa um gradiente em zigue-zague, `water` usa círculos múltiplos, etc. **Não no v1** — adicionar incrementalmente.

### 4. `style.css` — `prefers-reduced-motion`

```css
@media (prefers-reduced-motion: reduce) {
  .combatant.atk-physical .sprite img,
  .combatant.opponent.atk-physical .sprite img,
  .combatant.atk-special  .sprite img,
  .combatant.atk-status   .sprite img,
  .combatant[class*="fx-"] .sprite::after {
    animation-duration: 0.15s !important;
  }
}
```

### 5. (Opcional, recomendado) — Sprites animados Gen V

Em `js/battle-ui.js`, criar:
```js
function pickSprite(pokemon, side) {
  const v = pokemon.sprites?.versions?.["generation-v"]?.["black-white"]?.animated;
  if (side === "player") {
    return v?.back_default
        || pokemon.sprites?.back_default
        || pokemon.sprites?.front_default;
  }
  return v?.front_default
      || pokemon.sprites?.front_default;
}
```

Em `renderBattle()` (linhas 31-33), substituir:
```js
const playerSprite   = pickSprite(state.player.pokemon, "player");
const opponentSprite = pickSprite(state.opponent.pokemon, "opponent");
```

Resultado: a maioria dos Pokémons fica com idle animado (respiração, batida d'asa, etc) durante toda a batalha — sensação de vida grátis, sem custo de código. Os que não têm sprite animado (poucos) caem no front_default estático.

---

## Arquivos a modificar

- `/home/user/Lista-de-personagens/js/battle-ui.js` — `playMoveAnimation()`, integrar no fluxo do turno, (opcional) `pickSprite()`.
- `/home/user/Lista-de-personagens/style.css` — 3 keyframes `atk-*`, 1 keyframe `fx-flash`, 17 classes `.fx-*` com `--fx-color`, regra de `prefers-reduced-motion`.

**Branch**: mesma do PvP (`claude/fix-site-visibility-HpGHL`) — pode entrar no mesmo PR ou separado.

---

## Verificação

```bash
cd /home/user/Lista-de-personagens
python3 -m http.server 8000
# Testar em desktop e mobile (375px)
```

Checklist:

- [ ] **Physical** (Tackle, Scratch, Body Slam): o atacante avança ~50px na direção do oponente e volta. Bate visualmente.
- [ ] **Special** (Thunderbolt, Flamethrower, Hydro Pump): o atacante recua, brilha forte, e o defensor recebe um flash colorido grande.
- [ ] **Status** (Growl, Tail Whip, Toxic): o atacante pulsa com aura colorida, o defensor recebe um flash mais fraco.
- [ ] **Cores por tipo conferem**: Thunderbolt → flash amarelo no defensor; Flamethrower → laranja; Hydro Pump → azul; Solar Beam → verde; Earthquake → marrom; Confusion → rosa.
- [ ] **Sequência correta**: a animação roda **depois** do log "X usou Y!" e **antes** do shake + HP cair. Sem sobreposição estranha.
- [ ] **Miss**: quando o ataque erra, pula a animação de FX no defensor (não tem flash sem dano).
- [ ] **Compatível com modo PvP**: as animações funcionam igual nos dois ataques resolvidos por `resolveRound`.
- [ ] **`prefers-reduced-motion: reduce`** (ativar em DevTools → Rendering → Emulate CSS media): animações ficam quase instantâneas.
- [ ] **Mobile 375px**: o avanço de 50px do sprite não sai da arena nem encosta no oponente de forma estranha. Se sair, reduzir pra 35-40px com media query.
- [ ] **Sprites Gen V (se incluído)**: maioria dos Pokémons da Gen 1 ficam com idle animado. Os raros que não têm continuam estáticos sem quebrar.
- [ ] **Sem regressão**: shake e faint continuam funcionando normalmente.

---

## Riscos & Notas

1. **Sobreposição com `.shake`**: o shake atual roda **depois** da animação. Pode parecer "dobrado". Se ficar feio, condicionar: rodar shake só quando `result.damage > 0 && !result.crit` (crítico já tem brilho próprio) ou remover o shake completamente já que o FX cobre o feedback. Decidir no playtest.

2. **`damage_class` vazio**: alguns moves antigos podem vir com `damage_class` null da API. `normalizeMove` em `battle.js:72` já faz `m.damage_class?.name || "physical"` — então default seguro.

3. **17 tipos × cor**: se algum tipo aparecer sem classe `.fx-*` correspondente, cai no `var(--fx-color, white)` — flash branco. Não quebra.

4. **GIFs Gen V tamanho**: cada GIF tem 30-80KB. 151 × ~50KB = ~7MB se todos carregados. Já carregamos sob demanda (só na batalha), então custo é o de **2 pokémons por batalha** = ~100KB. Aceitável.

5. **`overflow: visible` no `.sprite`**: o flash transborda o sprite (intencional). Conferir se isso quebra algum layout em mobile. Se quebrar, mover `::after` pro `.combatant` em vez do `.sprite`.

6. **Duração total do turno**: hoje ~ 1.5s por ataque (log typewriter + shake + HP). Com animação, +650ms → ~2.2s. Em PvP, isso some no fluxo (o pessoal está conversando entre turnos). Se virar reclamação, comprimir keyframes pra 0.4s.

7. **Crítico e super-efetivo**: poderia ter FX especial (ex: borda dourada no `.crit`, double-flash no super-efetivo). **Não no v1** — adicionar depois como camada incremental.

8. **Status moves sem alvo claro** (Agility, Growth — buffam o próprio user): a animação roda no defensor mesmo assim, com flash. Tecnicamente errado, mas visualmente OK ("o oponente reage à mudança"). Refinar depois com `move.target` da PokéAPI se necessário.

---

## Como o Plano 2 se relaciona com o Plano 1 (PvP)

Os dois são **independentes** — podem ser executados em qualquer ordem.

- Se PvP for primeiro: `playMoveAnimation` entra em `resolveRound()` (helper novo do PvP) e o modo CPU passa pelo mesmo caminho.
- Se Animações for primeiro: entra no `runRound()` atual; depois, ao implementar o PvP, basta replicar a chamada em `resolveRound()`.

Boa estratégia: **Animações primeiro** (mudança visual visível e isolada, fácil de revisar), depois **PvP** (mudança estrutural maior). Aí o PvP já nasce bonito.
