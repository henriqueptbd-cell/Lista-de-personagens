import { getCachedPokemon, getPokemonNamePT } from "./api.js";
import { openDetailsModal } from "./pokedex.js";

const FEATURED_IDS = [25, 6, 150, 151, 149, 94, 143, 133, 130, 131, 9, 3];
const PARALLAX_IDS = [25, 6, 150, 9, 3, 94];

const TRIVIA = [
  "Sabia que Mewtwo foi criado em laboratório a partir do DNA do Mew?",
  "Magikarp parece fraco, mas evolui pra Gyarados — um dos mais fortes da Gen 1!",
  "Eevee tem 3 evoluções na Gen 1: Vaporeon (Água), Jolteon (Elétrico) e Flareon (Fogo).",
  "Charizard pode parecer Dragão, mas é Fogo/Voador — não tem tipo Dragão.",
  "Pikachu evolui pra Raichu usando uma Pedra do Trovão.",
  "Existem só 151 pokémons na primeira geração, mas no total já passam de 1000!",
  "Snorlax dorme 20 horas por dia e bloqueia caminhos no jogo original.",
  "Ditto pode se transformar em qualquer pokémon copiando seus moves.",
  "Mr. Mime tem o número 122 na Pokédex e é do tipo Psíquico/Fada.",
  "Dragonite é considerado um dos pokémons mais leais e amigáveis aos humanos.",
  "Articuno, Zapdos e Moltres são os 3 pássaros lendários da Gen 1.",
  "Mew foi escondido como segredo no jogo original — quase ninguém conseguia pegar."
];

export function renderHome() {
  const root = document.getElementById("screen-home");
  if (!root) return;
  root.innerHTML = `
    <section class="hero">
      <div id="hero-bg"></div>
      <div class="particles" id="particles"></div>
      <div class="parallax-mons" id="parallax-mons"></div>
      <div class="hero-content">
        <div class="hero-chips">
          <span class="chip">🎮 151 POKÉMONS</span>
          <span class="chip">⚔️ 4 MOVES CADA</span>
          <span class="chip">♾️ INFINITAS BATALHAS</span>
        </div>
        <h1 class="hero-title">POKÉDEX BATTLE</h1>
        <p class="hero-subtitle">Explore. Batalhe. Domine os 151 originais.</p>
        <div class="hero-ctas">
          <a href="#/pokedex" class="cta cta-primary">▶ EXPLORAR POKÉDEX</a>
          <a href="#/select" class="cta cta-secondary">⚔ ENTRAR NA ARENA</a>
        </div>
      </div>
    </section>

    <section class="stats-band">
      <div class="stats-grid">
        <div class="stat-big"><span class="num" data-target="151">0</span><span class="label">Pokémons</span></div>
        <div class="stat-big"><span class="num" data-target="18">0</span><span class="label">Tipos</span></div>
        <div class="stat-big"><span class="num" data-target="4">0</span><span class="label">Moves</span></div>
        <div class="stat-big"><span class="num">∞</span><span class="label">Batalhas</span></div>
      </div>
    </section>

    <h2 class="section-title">⚔ PREVIEW DE BATALHA</h2>
    <div class="battle-preview">
      <div class="preview-card">
        <div class="preview-fighters">
          <div class="preview-mon">
            <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png" alt="Pikachu" class="smooth-img">
            <div class="name">PIKACHU</div>
          </div>
          <div class="preview-vs">VS</div>
          <div class="preview-mon opponent">
            <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/6.png" alt="Charizard" class="smooth-img">
            <div class="name">CHARIZARD</div>
          </div>
        </div>
        <div class="preview-log">
          <span class="line">⚡ Pikachu usou Thunderbolt! É super eficaz!</span>
        </div>
        <a href="#/select" class="preview-cta">JOGAR AGORA →</a>
      </div>
    </div>

    <h2 class="section-title">🎮 O QUE DÁ PRA FAZER AQUI</h2>
    <div class="features">
      <div class="feature-card">
        <span class="feature-icon">📖</span>
        <h3>POKÉDEX COMPLETA</h3>
        <p>151 pokémons da Gen 1 com nomes em português, tipos, stats e habilidades. Toque pra ver os detalhes.</p>
      </div>
      <div class="feature-card">
        <span class="feature-icon">⚔️</span>
        <h3>MODO BATALHA</h3>
        <p>Escolha seu lutador e o adversário. Sistema completo: tipos efetivos, críticos, velocidade e PP. Vença a CPU.</p>
      </div>
      <div class="feature-card">
        <span class="feature-icon">🎲</span>
        <h3>MODO ALEATÓRIO</h3>
        <p>Sem ideia de quem escolher? Sorteie pokémons aleatórios e veja batalhas inesperadas.</p>
      </div>
    </div>

    <h2 class="section-title">💡 VOCÊ SABIA?</h2>
    <div class="trivia">
      <div class="trivia-box">
        <p class="trivia-text" id="trivia-text">${TRIVIA[0]}</p>
      </div>
      <div class="trivia-dots" id="trivia-dots"></div>
    </div>

    <h2 class="section-title">⭐ POKÉMONS EM DESTAQUE</h2>
    <div class="featured">
      <div class="featured-track" id="featured-track"></div>
    </div>
  `;

  initParticles();
  initStatsCounter();
  initTriviaCarousel();
  initParallax();
}

export function fillFeaturedAndParallax() {
  fillFeatured();
  fillParallax();
}

function fillFeatured() {
  const track = document.getElementById("featured-track");
  if (!track) return;
  track.innerHTML = FEATURED_IDS.map(id => {
    const p = getCachedPokemon(id);
    const namePT = getPokemonNamePT(id);
    const art = p?.sprites?.other?.["official-artwork"]?.front_default
      || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
    return `
      <div class="featured-card" data-id="${id}" tabindex="0" role="button" aria-label="${namePT}">
        <img src="${art}" alt="${namePT}" loading="lazy" class="smooth-img">
        <div class="name">${namePT}</div>
      </div>
    `;
  }).join("");
  track.addEventListener("click", (e) => {
    const card = e.target.closest(".featured-card");
    if (!card) return;
    const id = parseInt(card.dataset.id, 10);
    const p = getCachedPokemon(id);
    if (p) openDetailsModal(p);
  });
}

function fillParallax() {
  const wrap = document.getElementById("parallax-mons");
  if (!wrap) return;
  const positions = [
    { top: "8%", left: "5%" },
    { top: "12%", right: "8%" },
    { top: "55%", left: "3%" },
    { top: "60%", right: "5%" },
    { top: "30%", left: "45%" },
    { top: "75%", left: "30%" }
  ];
  wrap.innerHTML = PARALLAX_IDS.map((id, i) => {
    const art = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
    const pos = positions[i] || {};
    const style = Object.entries(pos).map(([k,v]) => `${k}:${v}`).join(";");
    return `<img src="${art}" alt="" class="parallax-mon smooth-img" style="${style}; animation-delay: ${i * 0.5}s" data-depth="${(i % 3) + 1}">`;
  }).join("");
}

function initParticles() {
  if (prefersReducedMotion()) return;
  const wrap = document.getElementById("particles");
  if (!wrap) return;
  const isMobile = window.innerWidth < 768;
  const count = isMobile ? 15 : 35;
  const types = ["pokeball", "bolt", "star"];
  const frag = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    const span = document.createElement("span");
    const type = types[i % types.length];
    span.className = `particle ${type}`;
    const left = Math.random() * 100;
    const dur = 8 + Math.random() * 14;
    const delay = Math.random() * dur;
    span.style.cssText = `left: ${left}%; animation-duration: ${dur}s; animation-delay: -${delay}s;`;
    frag.appendChild(span);
  }
  wrap.appendChild(frag);
}

function initStatsCounter() {
  const targets = document.querySelectorAll(".stat-big .num[data-target]");
  if (!("IntersectionObserver" in window)) {
    targets.forEach(el => el.textContent = el.dataset.target);
    return;
  }
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target;
      const target = parseInt(el.dataset.target, 10);
      animateCount(el, target);
      obs.unobserve(el);
    });
  }, { threshold: 0.4 });
  targets.forEach(el => obs.observe(el));
}

function animateCount(el, target) {
  const duration = 1200;
  const start = performance.now();
  function step(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.floor(target * eased);
    if (t < 1) requestAnimationFrame(step);
    else el.textContent = target;
  }
  requestAnimationFrame(step);
}

function initTriviaCarousel() {
  const text = document.getElementById("trivia-text");
  const dotsWrap = document.getElementById("trivia-dots");
  if (!text || !dotsWrap) return;
  dotsWrap.innerHTML = TRIVIA.map((_, i) => `<span class="dot ${i === 0 ? "active" : ""}" data-i="${i}"></span>`).join("");
  let idx = 0;
  const update = (newIdx) => {
    text.classList.add("fade-out");
    setTimeout(() => {
      idx = newIdx;
      text.textContent = TRIVIA[idx];
      text.classList.remove("fade-out");
      dotsWrap.querySelectorAll(".dot").forEach((d, i) => d.classList.toggle("active", i === idx));
    }, 400);
  };
  setInterval(() => update((idx + 1) % TRIVIA.length), 6000);
  dotsWrap.addEventListener("click", (e) => {
    const dot = e.target.closest(".dot");
    if (!dot) return;
    update(parseInt(dot.dataset.i, 10));
  });
}

function initParallax() {
  if (prefersReducedMotion()) return;
  const hero = document.querySelector(".hero");
  const wrap = document.getElementById("parallax-mons");
  if (!hero || !wrap) return;

  const isCoarse = window.matchMedia("(pointer: coarse)").matches;

  if (!isCoarse) {
    hero.addEventListener("mousemove", (e) => {
      const rect = hero.getBoundingClientRect();
      const cx = (e.clientX - rect.left) / rect.width - 0.5;
      const cy = (e.clientY - rect.top) / rect.height - 0.5;
      wrap.querySelectorAll(".parallax-mon").forEach(img => {
        const depth = parseInt(img.dataset.depth || "1", 10);
        img.style.transform = `translate(${cx * depth * 20}px, ${cy * depth * 20}px)`;
      });
    });
    return;
  }

  // Mobile: use device orientation if available
  if (window.DeviceOrientationEvent) {
    const handler = (e) => {
      const gx = (e.gamma || 0) / 45;
      const gy = (e.beta || 0) / 90;
      wrap.querySelectorAll(".parallax-mon").forEach(img => {
        const depth = parseInt(img.dataset.depth || "1", 10);
        img.style.transform = `translate(${gx * depth * 12}px, ${gy * depth * 8}px)`;
      });
    };
    if (typeof DeviceOrientationEvent.requestPermission === "function") {
      const enable = () => {
        DeviceOrientationEvent.requestPermission().then(state => {
          if (state === "granted") window.addEventListener("deviceorientation", handler);
        }).catch(() => {});
        window.removeEventListener("touchstart", enable);
      };
      window.addEventListener("touchstart", enable, { once: true });
    } else {
      window.addEventListener("deviceorientation", handler);
    }
  }
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
