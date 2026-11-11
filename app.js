/* ============================================================
   نوادي صناع الحياة — عيد ميلاد محمود طارق
   Cinematic timeline + layered particle systems
   ============================================================ */

(function () {
  "use strict";

  /* ---------------- Elements ---------------- */
  const stage = document.getElementById("stage");
  const introEl = document.getElementById("intro");
  const chargeEl = document.getElementById("charge");
  const countdownEl = document.getElementById("countdown");
  const revealEl = document.getElementById("reveal");
  const revealName = document.getElementById("revealName");
  const messageEl = document.getElementById("message");
  const messageCard = document.getElementById("messageCard");
  const closingEl = document.getElementById("closing");
  const flashEl = document.getElementById("flash");
  const liveEl = document.getElementById("live");
  const skipBtn = document.getElementById("skipBtn");
  const skipLink = document.getElementById("skipLink");
  const skyBtn = document.getElementById("skyBtn");
  const replayBtn = document.getElementById("replayBtn");
  const cardHint = document.querySelector(".card-hint");

  const ambientCanvas = document.getElementById("ambient");
  const fxCanvas = document.getElementById("fx");
  const ambientCtx = ambientCanvas.getContext("2d");
  const fxCtx = fxCanvas.getContext("2d");

  const mqReduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const mqPointer = window.matchMedia("(hover: hover) and (pointer: fine)");

  /* ---------------- Utilities ---------------- */
  const TAU = Math.PI * 2;
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const rand = (min, max) => min + Math.random() * (max - min);
  const randInt = (min, max) => Math.floor(rand(min, max + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

  const COLORS = {
    amber: "#FBAE42",
    amberBright: "#FFD08A",
    amberDeep: "#F0912A",
    cream: "#F4F3EF",
    white: "#FFFDF6"
  };

  const PALETTES = {
    gold: [COLORS.amber, COLORS.amberBright, COLORS.white, COLORS.amberDeep],
    cream: [COLORS.cream, COLORS.white, COLORS.amberBright],
    warm: [COLORS.amber, COLORS.cream, COLORS.amberBright, COLORS.white],
    deep: [COLORS.amberDeep, COLORS.amber, COLORS.amberBright]
  };

  function hexToRgba(hex, alpha) {
    const h = hex.replace("#", "");
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    const num = parseInt(full, 16);
    return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
  }

  function announce(text) {
    if (liveEl) liveEl.textContent = text;
  }

  /* ---------------- Glow sprites ---------------- */
  const spriteCache = new Map();

  function getGlowSprite(color) {
    if (spriteCache.has(color)) return spriteCache.get(color);

    const size = 96;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    const half = size / 2;
    const grad = ctx.createRadialGradient(half, half, 0, half, half, half);

    grad.addColorStop(0, hexToRgba(color, 1));
    grad.addColorStop(0.18, hexToRgba(color, 0.85));
    grad.addColorStop(0.45, hexToRgba(color, 0.28));
    grad.addColorStop(1, hexToRgba(color, 0));

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    spriteCache.set(color, canvas);
    return canvas;
  }

  /* ---------------- Canvas sizing ---------------- */
  let dpr = 1;
  let viewW = window.innerWidth;
  let viewH = window.innerHeight;

  function sizeCanvases() {
    viewW = window.innerWidth;
    viewH = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);

    [ambientCanvas, fxCanvas].forEach((canvas) => {
      canvas.width = Math.round(viewW * dpr);
      canvas.height = Math.round(viewH * dpr);
      canvas.style.width = viewW + "px";
      canvas.style.height = viewH + "px";
    });

    ambientCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fxCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ============================================================
     Ambient field — background dust + foreground bokeh
     ============================================================ */
  const ambient = {
    particles: [],
    charge: 0,
    chargeTarget: 0,
    fade: 1,
    fadeTarget: 1,
    time: 0,

    reset() {
      this.charge = 0;
      this.chargeTarget = 0;
      this.fade = 1;
      this.fadeTarget = 1;
      this.time = 0;
      this.build();
    },

    build() {
      const budget = Math.round(clamp((viewW * viewH) / 24000, 30, 88));
      this.particles = [];

      for (let i = 0; i < budget; i++) {
        const depth = rand(0.18, 1);
        const foreground = depth > 0.82;
        this.particles.push({
          x: rand(0, viewW),
          y: rand(0, viewH),
          vx: 0,
          vy: 0,
          depth,
          r: foreground ? rand(1.8, 3.4) : rand(0.5, 1.5),
          alpha: foreground ? rand(0.16, 0.34) : rand(0.28, 0.72),
          tw: rand(0.6, 2.1),
          phase: rand(0, TAU),
          tone: Math.random() > 0.32 ? "cream" : "amber",
          foreground
        });
      }
    },

    scatter() {
      this.chargeTarget = 0;
      this.charge = 0;
      this.fade = 0.12;
      this.fadeTarget = 1;

      for (const p of this.particles) {
        p.x = rand(0, viewW);
        p.y = rand(0, viewH);
        p.vx = 0;
        p.vy = 0;
      }
    },

    update(dt) {
      this.time += dt;
      this.charge = lerp(this.charge, this.chargeTarget, clamp(dt * 2.4, 0, 1));
      this.fade = lerp(this.fade, this.fadeTarget, clamp(dt * 1.8, 0, 1));

      const cx = viewW / 2;
      const cy = viewH / 2;

      for (const p of this.particles) {
        // Slow upward drift with a lateral sway.
        p.y -= (5 + p.depth * 16) * dt;
        p.x += Math.sin(this.time * p.tw + p.phase) * (4 + p.depth * 9) * dt;

        if (this.charge > 0.015) {
          const dx = cx - p.x;
          const dy = cy - p.y;
          const dist = Math.hypot(dx, dy) || 1;
          const pull = 460 * this.charge * this.charge * (0.45 + p.depth);

          p.vx += (dx / dist) * pull * dt;
          p.vy += (dy / dist) * pull * dt;
          p.vx += (-dy / dist) * pull * 0.5 * dt;
          p.vy += (dx / dist) * pull * 0.5 * dt;

          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vx *= Math.exp(-0.9 * dt);
          p.vy *= Math.exp(-0.9 * dt);
        }

        // Wrap around the viewport.
        if (p.y < -20) { p.y = viewH + 12; p.x = rand(0, viewW); }
        if (p.y > viewH + 24) { p.y = -12; p.x = rand(0, viewW); }
        if (p.x < -24) p.x = viewW + 16;
        if (p.x > viewW + 24) p.x = -16;
      }
    },

    draw(staticFrame) {
      ambientCtx.clearRect(0, 0, viewW, viewH);
      ambientCtx.globalCompositeOperation = "lighter";

      const px = pointer.x;
      const py = pointer.y;

      for (const p of this.particles) {
        const twinkle = staticFrame
          ? 0.85
          : 0.55 + 0.45 * Math.sin(this.time * p.tw + p.phase);

        const parallaxX = p.foreground ? px * p.depth * 26 : px * p.depth * 10;
        const parallaxY = p.foreground ? py * p.depth * 18 : py * p.depth * 7;
        const x = p.x + parallaxX;
        const y = p.y + parallaxY;
        const alpha = p.alpha * twinkle * this.fade;

        if (alpha <= 0.005) continue;

        const sprite = getGlowSprite(p.tone === "amber" ? COLORS.amber : COLORS.cream);
        const size = p.r * (p.foreground ? 9 : 5.5);

        ambientCtx.globalAlpha = alpha;
        ambientCtx.drawImage(sprite, x - size / 2, y - size / 2, size, size);
      }

      ambientCtx.globalAlpha = 1;
      ambientCtx.globalCompositeOperation = "source-over";
    }
  };

  /* ============================================================
     FX engine — fireworks, confetti, rings, rockets
     ============================================================ */
  const fx = {
    sparks: [],
    confetti: [],
    rings: [],
    rockets: [],

    reset() {
      this.sparks.length = 0;
      this.confetti.length = 0;
      this.rings.length = 0;
      this.rockets.length = 0;
      fxCtx.clearRect(0, 0, viewW, viewH);
    },

    sparkLimit() {
      return viewW < 640 ? 720 : 1500;
    },

    spawnBurst(x, y, options) {
      const opts = options || {};
      const palette = PALETTES[opts.palette || "gold"] || PALETTES.gold;
      const quality = clamp(viewW / 1440, 0.55, 1);
      const count = Math.round((opts.count || 60) * quality);
      const speed = opts.speed || 300;
      const life = opts.life || rand(1.3, 2);
      const size = opts.size || 2;
      const gravity = opts.gravity != null ? opts.gravity : 150;

      for (let i = 0; i < count; i++) {
        const angle = rand(0, TAU);
        // A soft outer ring plus a brighter inner core.
        const ring = i % 3 === 0 ? rand(0.3, 0.55) : rand(0.55, 1);
        const velocity = speed * ring * rand(0.85, 1.12);

        this.sparks.push({
          x,
          y,
          px: x,
          py: y,
          vx: Math.cos(angle) * velocity,
          vy: Math.sin(angle) * velocity,
          color: palette[i % palette.length],
          size: size * rand(0.7, 1.3),
          life: life * rand(0.75, 1.1),
          maxLife: life,
          gravity,
          drag: rand(0.9, 1.5),
          twinkle: rand(0.7, 2.4),
          phase: rand(0, TAU),
          glitter: Math.random() > 0.85
        });
      }

      const overflow = this.sparks.length - this.sparkLimit();
      if (overflow > 0) this.sparks.splice(0, overflow);

      this.spawnRing(x, y, {
        max: Math.max(60, speed * 0.85),
        width: 2.5,
        color: palette[0],
        dur: 0.9
      });
    },

    spawnRing(x, y, options) {
      const opts = options || {};
      this.rings.push({
        x,
        y,
        r: 6,
        max: opts.max || 260,
        width: opts.width || 2,
        color: opts.color || COLORS.amber,
        life: opts.dur || 1,
        maxLife: opts.dur || 1
      });
    },

    spawnConfetti(x, y, count, options) {
      const opts = options || {};
      const colors = [COLORS.amber, COLORS.amberBright, COLORS.cream, COLORS.amberDeep, COLORS.white];
      const total = Math.round(count * clamp(viewW / 1440, 0.5, 1));

      for (let i = 0; i < total; i++) {
        const angle = opts.up
          ? rand(-Math.PI * 0.92, -Math.PI * 0.08)
          : rand(0, TAU);
        const speed = rand(90, 340);

        this.confetti.push({
          x,
          y,
          vx: Math.cos(angle) * speed * 1.25,
          vy: Math.sin(angle) * speed,
          w: rand(4, 9),
          h: rand(7, 15),
          color: colors[i % colors.length],
          rot: rand(0, TAU),
          vr: rand(-7, 7),
          phase: rand(0, TAU),
          life: rand(3.4, 5.2),
          maxLife: 5.2
        });
      }

      if (this.confetti.length > 420) {
        this.confetti.splice(0, this.confetti.length - 420);
      }
    },

    launchRocket(fromX, fromY, toX, toY, options) {
      this.rockets.push({
        x: fromX,
        y: fromY,
        px: fromX,
        py: fromY,
        sx: fromX,
        sy: fromY,
        tx: toX,
        ty: toY,
        t: 0,
        dur: (options && options.dur) || rand(0.55, 0.78),
        options: options || {},
        color: (options && options.color) || COLORS.amber
      });
    },

    update(dt) {
      /* --- rockets --- */
      for (let i = this.rockets.length - 1; i >= 0; i--) {
        const r = this.rockets[i];
        r.t += dt / r.dur;
        r.px = r.x;
        r.py = r.y;

        if (r.t >= 1) {
          this.spawnBurst(r.tx, r.ty, r.options);
          this.rockets.splice(i, 1);
          continue;
        }

        const e = easeOutCubic(r.t);
        r.x = lerp(r.sx, r.tx, e);
        r.y = lerp(r.sy, r.ty, e) - Math.sin(Math.PI * r.t) * 34;

        // Little exhaust sparks.
        if (Math.random() > 0.35) {
          this.sparks.push({
            x: r.x + rand(-2, 2),
            y: r.y + rand(-2, 2),
            px: r.x,
            py: r.y,
            vx: rand(-18, 18),
            vy: rand(10, 50),
            color: r.color,
            size: rand(0.8, 1.8),
            life: rand(0.25, 0.5),
            maxLife: 0.5,
            gravity: 30,
            drag: 2,
            twinkle: 3,
            phase: 0,
            glitter: false
          });
        }
      }

      /* --- sparks --- */
      for (let i = this.sparks.length - 1; i >= 0; i--) {
        const s = this.sparks[i];
        s.life -= dt;
        if (s.life <= 0) {
          this.sparks.splice(i, 1);
          continue;
        }

        s.px = s.x;
        s.py = s.y;
        s.vy += s.gravity * dt;
        const damp = Math.exp(-s.drag * dt);
        s.vx *= damp;
        s.vy *= damp;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
      }

      /* --- rings --- */
      for (let i = this.rings.length - 1; i >= 0; i--) {
        const ring = this.rings[i];
        ring.life -= dt;
        if (ring.life <= 0) {
          this.rings.splice(i, 1);
          continue;
        }
        const t = 1 - ring.life / ring.maxLife;
        ring.r = 6 + (ring.max - 6) * easeOutCubic(t);
      }

      /* --- confetti --- */
      for (let i = this.confetti.length - 1; i >= 0; i--) {
        const c = this.confetti[i];
        c.life -= dt;
        if (c.life <= 0) {
          this.confetti.splice(i, 1);
          continue;
        }

        c.vy += 190 * dt;
        c.vx *= Math.exp(-0.55 * dt);
        c.x += (c.vx + Math.sin(c.phase) * 26) * dt;
        c.y += c.vy * dt;
        c.rot += c.vr * dt;
        c.phase += dt * 2.2;
      }
    },

    draw() {
      fxCtx.clearRect(0, 0, viewW, viewH);

      /* Rings — additive */
      fxCtx.globalCompositeOperation = "lighter";
      for (const ring of this.rings) {
        const alpha = clamp(ring.life / ring.maxLife, 0, 1);
        fxCtx.globalAlpha = alpha * 0.7;
        fxCtx.strokeStyle = ring.color;
        fxCtx.lineWidth = ring.width * (0.4 + alpha);
        fxCtx.beginPath();
        fxCtx.arc(ring.x, ring.y, ring.r, 0, TAU);
        fxCtx.stroke();
      }

      /* Rocket trails */
      for (const r of this.rockets) {
        fxCtx.globalAlpha = 0.9;
        fxCtx.strokeStyle = hexToRgba(r.color, 0.75);
        fxCtx.lineWidth = 2;
        fxCtx.beginPath();
        fxCtx.moveTo(r.px, r.py);
        fxCtx.lineTo(r.x, r.y);
        fxCtx.stroke();

        const sprite = getGlowSprite(r.color);
        fxCtx.globalAlpha = 1;
        fxCtx.drawImage(sprite, r.x - 14, r.y - 14, 28, 28);
      }

      /* Sparks — short glowing trails */
      for (const s of this.sparks) {
        const ratio = clamp(s.life / s.maxLife, 0, 1);
        const twinkle = 0.7 + 0.3 * Math.sin(s.life * 18 + s.phase);
        const alpha = ratio * twinkle;

        fxCtx.globalAlpha = alpha;
        fxCtx.strokeStyle = s.color;
        fxCtx.lineWidth = s.size * (0.5 + ratio * 0.7);
        fxCtx.beginPath();
        fxCtx.moveTo(s.px, s.py);
        fxCtx.lineTo(s.x, s.y);
        fxCtx.stroke();

        const glowSize = s.size * (s.glitter ? 14 : 8);
        const sprite = getGlowSprite(s.color);
        fxCtx.globalAlpha = alpha * 0.85;
        fxCtx.drawImage(sprite, s.x - glowSize / 2, s.y - glowSize / 2, glowSize, glowSize);
      }

      /* Confetti — normal blending so colours stay true */
      fxCtx.globalCompositeOperation = "source-over";
      for (const c of this.confetti) {
        const alpha = clamp(c.life / 1.1, 0, 1);
        fxCtx.globalAlpha = alpha;
        fxCtx.save();
        fxCtx.translate(c.x, c.y);
        fxCtx.rotate(c.rot);
        fxCtx.fillStyle = c.color;
        fxCtx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h * (0.55 + 0.45 * Math.abs(Math.sin(c.phase))));
        fxCtx.restore();
      }

      fxCtx.globalAlpha = 1;
      fxCtx.globalCompositeOperation = "source-over";
    }
  };

  /* ============================================================
     Pointer parallax
     ============================================================ */
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };

  function onPointerMove(event) {
    if (event.pointerType === "touch" || mqReduce.matches) return;
    pointer.tx = (event.clientX / viewW - 0.5) * 2;
    pointer.ty = (event.clientY / viewH - 0.5) * 2;
  }

  function updateParallax() {
    if (mqReduce.matches || !mqPointer.matches) return;

    const nx = lerp(pointer.x, pointer.tx, 0.06);
    const ny = lerp(pointer.y, pointer.ty, 0.06);

    if (Math.abs(nx - pointer.x) < 0.0005 && Math.abs(ny - pointer.y) < 0.0005) return;

    pointer.x = nx;
    pointer.y = ny;
    stage.style.setProperty("--px", nx.toFixed(3));
    stage.style.setProperty("--py", ny.toFixed(3));
  }

  /* ============================================================
     Main loop
     ============================================================ */
  let rafId = 0;
  let lastTime = 0;
  let running = false;

  function frame(now) {
    if (!running) return;
    const dt = Math.min((now - lastTime) / 1000 || 0, 0.05);
    lastTime = now;

    ambient.update(dt);
    fx.update(dt);
    ambient.draw(false);
    fx.draw();
    updateParallax();

    rafId = requestAnimationFrame(frame);
  }

  function startLoop() {
    if (running || mqReduce.matches) return;
    running = true;
    lastTime = performance.now();
    rafId = requestAnimationFrame(frame);
  }

  function stopLoop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopLoop();
    } else if (!mqReduce.matches && !staticMode) {
      startLoop();
    }
  });

  /* ============================================================
     Cinematic timeline
     ============================================================ */
  let timers = [];
  let staticMode = false;

  function schedule(ms, fn) {
    timers.push(window.setTimeout(fn, ms));
  }

  function clearSequence() {
    timers.forEach((id) => clearTimeout(id));
    timers = [];
  }

  const lines = introEl ? Array.from(introEl.querySelectorAll(".intro-line")) : [];

  function setLine(index) {
    lines.forEach((line, i) => {
      line.classList.toggle("is-active", i === index - 1);
      line.classList.toggle("is-out", i < index - 1);
    });
  }

  function clearLines() {
    lines.forEach((line) => line.classList.remove("is-active", "is-out"));
  }

  function setCount(text) {
    if (!countdownEl) return;
    countdownEl.textContent = text;
    countdownEl.classList.remove("is-pop");
    // Restart the pop animation.
    void countdownEl.offsetWidth;
    countdownEl.classList.add("is-pop");
  }

  function flashFire() {
    flashEl.classList.remove("is-firing");
    void flashEl.offsetWidth;
    flashEl.classList.add("is-firing");
  }

  function nameCenter() {
    const rect = revealName.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  }

  function burstAtReveal() {
    stage.classList.remove("is-charging");
    stage.classList.add("is-revealed", "is-shaking");
    revealEl.setAttribute("aria-hidden", "false");

    flashFire();
    ambient.scatter();

    const c = nameCenter();
    const scale = clamp(viewW / 1440, 0.6, 1);

    fx.spawnBurst(c.x, c.y, {
      count: Math.round(105 * scale),
      speed: 410,
      palette: "gold",
      size: 2.4,
      life: 1.9
    });
    fx.spawnBurst(c.x, c.y, {
      count: Math.round(60 * scale),
      speed: 235,
      palette: "cream",
      size: 2,
      life: 1.5
    });
    fx.spawnRing(c.x, c.y, {
      max: Math.max(viewW, viewH) * 0.75,
      width: 3,
      color: COLORS.amber,
      dur: 1.1
    });
    fx.spawnConfetti(c.x, c.y - 8, 110, { up: true });

    schedule(420, () => {
      fx.spawnBurst(viewW * 0.18, viewH * 0.34, {
        count: 46, speed: 290, palette: "deep", size: 2, life: 1.6
      });
    });
    schedule(760, () => {
      fx.spawnBurst(viewW * 0.82, viewH * 0.29, {
        count: 52, speed: 310, palette: "cream", size: 2.1, life: 1.7
      });
    });

    schedule(640, () => stage.classList.remove("is-shaking"));

    announce("ظهر الاسم! محمود طارق — كل سنة وأنت طيب.");
  }

  function showMessage() {
    stage.classList.add("is-message", "is-closing");
    messageEl.setAttribute("aria-hidden", "false");
    closingEl.setAttribute("aria-hidden", "false");
    document.body.classList.add("is-interactive");
    revealEl.setAttribute("aria-hidden", "true");
    announce("رسالة عيد الميلاد ظاهرة الآن. اضغط زر أضئ السماء أو المس أي مكان.");
  }

  function showClosing() {
    stage.classList.add("is-closing");
    closingEl.setAttribute("aria-hidden", "false");
  }

  function beginCharge() {
    stage.classList.add("is-charging");
    ambient.chargeTarget = 1;
    announce("استعد...");
  }

  function runExperience() {
    schedule(80, () => stage.classList.add("is-lit"));

    schedule(650, () => setLine(1));
    schedule(2950, () => setLine(2));
    schedule(5100, () => setLine(3));

    schedule(6950, () => {
      clearLines();
      beginCharge();
    });

    schedule(7150, () => setCount("٣"));
    schedule(7930, () => setCount("٢"));
    schedule(8710, () => setCount("١"));
    schedule(9000, burstAtReveal);

    schedule(13000, showMessage);
    schedule(13750, showClosing);
  }

  /* ---------------- State reset ---------------- */

  function resetExperience() {
    clearSequence();
    staticMode = false;

    stage.className = "stage no-anim";
    stage.removeAttribute("style");

    document.body.classList.remove("is-interactive");
    window.scrollTo(0, 0);

    clearLines();

    if (countdownEl) {
      countdownEl.textContent = "";
      countdownEl.classList.remove("is-pop");
    }
    flashEl.classList.remove("is-firing");

    messageEl.setAttribute("aria-hidden", "true");
    closingEl.setAttribute("aria-hidden", "true");
    revealEl.setAttribute("aria-hidden", "true");
    skyBtn.hidden = false;
    skyBtn.querySelector(".btn-label").textContent = "أضئ السماء";
    cardHint.textContent = "المس أي مكان في الصفحة... السماء منوّرة بيك.";

    pointer.x = 0;
    pointer.y = 0;
    pointer.tx = 0;
    pointer.ty = 0;

    fx.reset();
    sizeCanvases();
    ambient.reset();
    ambient.draw(false);

    startLoop();

    // Clear the transition blocker immediately after the reset has been
    // committed. Using a forced reflow (instead of rAF) keeps replay reliable
    // even when the tab is throttled.
    void stage.offsetHeight;
    stage.classList.remove("no-anim");
  }

  function start() {
    resetExperience();
    stage.classList.remove("no-anim");
    if (mqReduce.matches) {
      finishStatic();
      return;
    }
    runExperience();
  }

  /* ---------------- Skip / reduced motion ---------------- */

  function finishStatic() {
    staticMode = true;
    clearSequence();
    stopLoop();
    ambient.chargeTarget = 0;
    ambient.charge = 0;
    ambient.fade = 1;

    stage.classList.remove("is-charging", "is-shaking", "is-finale");
    stage.classList.add("is-lit", "is-revealed", "is-message", "is-closing");

    revealEl.setAttribute("aria-hidden", "true");
    messageEl.setAttribute("aria-hidden", "false");
    closingEl.setAttribute("aria-hidden", "false");
    document.body.classList.add("is-interactive");

    skyBtn.hidden = true;
    cardHint.textContent = "تم إيقاف المؤثرات الحركية حسب إعداد جهازك — وكل سنة وأنت طيب ❤️";

    sizeCanvases();
    ambient.reset();
    ambient.draw(true);
    fx.reset();

    announce("تم عرض الرسالة مباشرةً لأن المؤثرات الحركية مخفّفة على جهازك.");
  }

  function skipIntro() {
    clearSequence();
    fx.reset();

    stage.classList.remove("is-charging", "is-shaking");
    stage.classList.add("is-lit", "is-revealed", "is-message", "is-closing");

    ambient.chargeTarget = 0;
    ambient.charge = 0;

    revealEl.setAttribute("aria-hidden", "true");
    messageEl.setAttribute("aria-hidden", "false");
    closingEl.setAttribute("aria-hidden", "false");
    document.body.classList.add("is-interactive");

    if (!mqReduce.matches) {
      const c = { x: viewW / 2, y: viewH * 0.4 };
      fx.spawnBurst(c.x, c.y, { count: 80, speed: 340, palette: "warm", size: 2.2, life: 1.6 });
      fx.spawnConfetti(c.x, c.y, 70, { up: true });
    }

    messageCard.focus({ preventScroll: true });
    announce("تم تخطي المقدمة. رسالة عيد الميلاد ظاهرة الآن.");
  }

  /* ---------------- Interactions ---------------- */

  let skyCooldown = 0;

  function illuminateSky() {
    const now = performance.now();
    if (now - skyCooldown < 900) return;
    skyCooldown = now;

    const buttonRect = skyBtn.getBoundingClientRect();
    const originX = buttonRect.left + buttonRect.width / 2;
    const originY = buttonRect.top + buttonRect.height / 2;
    const scale = clamp(viewW / 1440, 0.65, 1);

    const targets = [
      { x: viewW * 0.2, y: viewH * 0.26, palette: "gold" },
      { x: viewW * 0.5, y: viewH * 0.16, palette: "cream" },
      { x: viewW * 0.8, y: viewH * 0.24, palette: "deep" },
      { x: viewW * 0.33, y: viewH * 0.4, palette: "warm" },
      { x: viewW * 0.67, y: viewH * 0.37, palette: "gold" }
    ];

    stage.classList.add("is-finale");
    schedule(1600, () => stage.classList.remove("is-finale"));

    targets.forEach((target, index) => {
      schedule(index * 150, () => {
        fx.launchRocket(originX, originY, target.x, target.y, {
          dur: rand(0.5, 0.72),
          count: Math.round(70 * scale),
          speed: rand(300, 390),
          palette: target.palette,
          size: 2.2,
          life: 1.8
        });
      });
    });

    fx.spawnConfetti(originX, originY, 80, { up: true });
    fx.spawnRing(originX, originY, { max: Math.max(viewW, viewH) * 0.6, width: 2.5, color: COLORS.amber, dur: 1 });

    const label = skyBtn.querySelector(".btn-label");
    label.textContent = "السماء منوّرة ✨";
    schedule(2200, () => { label.textContent = "أضئ السماء"; });

    announce("السماء اتضوّت بتمنياتنا ليك يا محمود.");
  }

  let lastManualBurst = 0;

  function handleStagePointer(event) {
    if (!stage.classList.contains("is-message") || mqReduce.matches) return;
    if (event.target.closest("button, a, input, textarea, select, .card")) return;

    const now = performance.now();
    if (now - lastManualBurst < 190) return;
    lastManualBurst = now;

    const x = event.clientX;
    const y = event.clientY;

    fx.spawnBurst(x, y, {
      count: randInt(38, 62),
      speed: rand(220, 330),
      palette: pick(["gold", "warm", "cream"]),
      size: rand(1.6, 2.4),
      life: rand(1.1, 1.7)
    });
    fx.spawnConfetti(x, y, 22, { up: true });
  }

  /* ---------------- Events ---------------- */

  window.addEventListener("resize", () => {
    const oldW = viewW;
    sizeCanvases();

    if (Math.abs(oldW - viewW) > 40) {
      ambient.build();
    }

    if (staticMode) ambient.draw(true);
  });

  window.addEventListener("pointermove", onPointerMove, { passive: true });

  stage.addEventListener("pointerdown", handleStagePointer, { passive: true });

  skipBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    skipIntro();
  });

  if (skipLink) {
    skipLink.addEventListener("click", (event) => {
      event.preventDefault();
      skipIntro();
    });
  }

  skyBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    if (mqReduce.matches) return;
    illuminateSky();
  });

  replayBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    start();
    announce("تبدأ المفاجأة من جديد.");

    // The replay button lives in the now-hidden message, so move focus to a
    // control that is actually visible during the intro.
    window.setTimeout(() => {
      if (mqReduce.matches) {
        messageCard.focus({ preventScroll: true });
      } else {
        skipBtn.focus({ preventScroll: true });
      }
    }, 220);
  });

  messageEl.addEventListener("pointerdown", (event) => {
    // Keep card interactions calm while still allowing backdrop fireworks.
    if (event.target.closest(".card")) event.stopPropagation();
  });

  if (mqReduce.addEventListener) {
    mqReduce.addEventListener("change", (event) => {
      if (event.matches) {
        finishStatic();
      } else {
        start();
      }
    });
  }

  /* ---------------- Boot ---------------- */

  sizeCanvases();
  ambient.reset();
  ambient.draw(false);
  fx.draw();

  const fontReady = document.fonts && document.fonts.ready
    ? document.fonts.ready
    : Promise.resolve();

  Promise.race([
    fontReady,
    new Promise((resolve) => setTimeout(resolve, 1400))
  ]).then(() => {
    if (mqReduce.matches) {
      finishStatic();
    } else {
      start();
    }
  });
})();
