(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  const hpFill = document.getElementById("hp-fill");
  const scoreEl = document.getElementById("score");
  const waveEl = document.getElementById("wave");
  const killsEl = document.getElementById("kills");
  const charNameEl = document.getElementById("char-name");
  const overlay = document.getElementById("overlay");
  const selectOverlay = document.getElementById("select-overlay");
  const pauseOverlay = document.getElementById("pause-overlay");
  const gameoverOverlay = document.getElementById("gameover-overlay");
  const startBtn = document.getElementById("start-btn");
  const confirmBtn = document.getElementById("confirm-btn");
  const backMenuBtn = document.getElementById("back-menu-btn");
  const resumeBtn = document.getElementById("resume-btn");
  const restartBtn = document.getElementById("restart-btn");
  const finalScore = document.getElementById("final-score");
  const finalWave = document.getElementById("final-wave");
  const finalKills = document.getElementById("final-kills");
  const selectCards = document.querySelectorAll(".scard");

  const CHARACTERS = {
    jinu: {
      id: "jinu",
      name: "진우",
      weapon: "CRIMSON AR",
      accent: "#ff4f6a",
      accentSoft: "#ff9aaa",
      glow: "rgba(255, 79, 106, 0.28)",
      speed: 210,
      maxHp: 100,
      fireRate: 0.15,
      bulletSpeed: 640,
      bulletLife: 0.95,
      bulletR: 3.2,
      pellets: 1,
      spread: 0.08,
      damage: 1,
      recoil: 1.5,
      gunStyle: "ar",
    },
    abby: {
      id: "abby",
      name: "애비",
      weapon: "GOLDEN SG",
      accent: "#e8c04a",
      accentSoft: "#ffe08a",
      glow: "rgba(232, 192, 74, 0.28)",
      speed: 175,
      maxHp: 120,
      fireRate: 0.42,
      bulletSpeed: 480,
      bulletLife: 0.38,
      bulletR: 3.8,
      pellets: 5,
      spread: 0.32,
      damage: 1,
      recoil: 3.2,
      gunStyle: "sg",
    },
    baby: {
      id: "baby",
      name: "베이비",
      weapon: "AZURE SMG",
      accent: "#4a9dff",
      accentSoft: "#9accff",
      glow: "rgba(74, 157, 255, 0.28)",
      speed: 265,
      maxHp: 85,
      fireRate: 0.07,
      bulletSpeed: 700,
      bulletLife: 0.7,
      bulletR: 2.6,
      pellets: 1,
      spread: 0.14,
      damage: 1,
      recoil: 0.8,
      gunStyle: "smg",
    },
  };

  let selectedId = "jinu";
  let loadout = CHARACTERS.jinu;

  const keys = Object.create(null);
  const mouse = { x: W / 2, y: H / 2, down: false };

  let state = "menu"; // menu | select | playing | paused | dead
  let lastTime = 0;
  let shake = 0;
  let score = 0;
  let kills = 0;
  let wave = 1;
  let waveTimer = 0;
  let spawnQueue = 0;
  let spawnCooldown = 0;
  let muzzleFlash = 0;
  let time = 0;
  /** @type {Array<{x:number,y:number,r:number,speed:number,phase:number,alpha:number}>} */
  let ambience = [];

  const player = {
    x: W / 2,
    y: H / 2,
    r: 14,
    speed: 220,
    hp: 100,
    maxHp: 100,
    fireCooldown: 0,
    invuln: 0,
    angle: 0,
  };

  /** @type {Array<{x:number,y:number,vx:number,vy:number,life:number,r:number,damage:number,color:string}>} */
  let bullets = [];
  /** @type {Array<{x:number,y:number,r:number,speed:number,hp:number,maxHp:number,type:string,hitFlash:number,angle:number,bob:number}>} */
  let zombies = [];
  /** @type {Array<{x:number,y:number,vx:number,vy:number,life:number,color:string,size:number}>} */
  let particles = [];
  /** @type {Array<{x:number,y:number,text:string,life:number,vy:number}>} */
  let floats = [];

  function applyLoadout(id) {
    selectedId = id;
    loadout = CHARACTERS[id] || CHARACTERS.jinu;
    player.speed = loadout.speed;
    player.maxHp = loadout.maxHp;
    player.hp = loadout.maxHp;
    if (charNameEl) charNameEl.textContent = loadout.name;
    document.documentElement.style.setProperty("--accent", loadout.accent);
    document.documentElement.style.setProperty("--accent-soft", loadout.accentSoft);
  }

  function syncSelectUI() {
    selectCards.forEach((card) => {
      const on = card.dataset.id === selectedId;
      card.classList.toggle("is-selected", on);
    });
  }

  function initAmbience() {
    ambience = [];
    for (let i = 0; i < 40; i++) {
      ambience.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: rand(1, 2.5),
        speed: rand(8, 28),
        phase: Math.random() * Math.PI * 2,
        alpha: rand(0.08, 0.28),
      });
    }
  }

  initAmbience();

  function resetGame() {
    applyLoadout(selectedId);
    player.x = W / 2;
    player.y = H / 2;
    player.hp = player.maxHp;
    player.fireCooldown = 0;
    player.invuln = 0;
    bullets = [];
    zombies = [];
    particles = [];
    floats = [];
    score = 0;
    kills = 0;
    wave = 1;
    waveTimer = 0;
    spawnQueue = 0;
    spawnCooldown = 0;
    shake = 0;
    muzzleFlash = 0;
    startWave(1);
    updateHud();
  }

  function fire() {
    if (player.fireCooldown > 0) return;
    player.fireCooldown = loadout.fireRate;
    muzzleFlash = 0.06;

    const muzzle = loadout.gunStyle === "sg" ? 20 : 22;
    const bx = player.x + Math.cos(player.angle) * muzzle;
    const by = player.y + Math.sin(player.angle) * muzzle;
    const count = loadout.pellets;

    for (let i = 0; i < count; i++) {
      const spread =
        count === 1
          ? (Math.random() - 0.5) * loadout.spread
          : (i / (count - 1) - 0.5) * loadout.spread + (Math.random() - 0.5) * 0.04;
      const angle = player.angle + spread;
      const speed = loadout.bulletSpeed * (0.92 + Math.random() * 0.12);
      bullets.push({
        x: bx,
        y: by,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: loadout.bulletLife,
        r: loadout.bulletR,
        damage: loadout.damage,
        color: loadout.accentSoft,
      });
    }

    spawnParticles(bx, by, loadout.accentSoft, count === 1 ? 3 : 6, 60);

    player.x -= Math.cos(player.angle) * loadout.recoil;
    player.y -= Math.sin(player.angle) * loadout.recoil;
    shake = Math.max(shake, loadout.gunStyle === "sg" ? 6 : 3);
  }

  function startWave(n) {
    wave = n;
    const count = 8 + n * 4;
    spawnQueue = count;
    spawnCooldown = 0.25;
    waveTimer = 0;
    floats.push({
      x: W / 2,
      y: H / 2 - 40,
      text: `웨이브 ${n}`,
      life: 1.6,
      vy: -20,
    });
  }

  function updateHud() {
    hpFill.style.width = `${Math.max(0, (player.hp / player.maxHp) * 100)}%`;
    scoreEl.textContent = String(score);
    waveEl.textContent = String(wave);
    killsEl.textContent = String(kills);
  }

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  function pickSpawnPoint() {
    const margin = 40;
    const side = (Math.random() * 4) | 0;
    if (side === 0) return { x: rand(0, W), y: -margin };
    if (side === 1) return { x: rand(0, W), y: H + margin };
    if (side === 2) return { x: -margin, y: rand(0, H) };
    return { x: W + margin, y: rand(0, H) };
  }

  function spawnZombie() {
    const p = pickSpawnPoint();
    const roll = Math.random();
    let type = "normal";
    if (wave >= 3 && roll < 0.12) type = "tank";
    else if (wave >= 2 && roll < 0.28) type = "fast";

    let r = 16;
    let speed = 55 + wave * 4;
    let hp = 2 + Math.floor(wave / 2);

    if (type === "fast") {
      r = 12;
      speed = 110 + wave * 6;
      hp = 1 + Math.floor(wave / 3);
    } else if (type === "tank") {
      r = 24;
      speed = 35 + wave * 2;
      hp = 6 + wave;
    }

    zombies.push({
      x: p.x,
      y: p.y,
      r,
      speed,
      hp,
      maxHp: hp,
      type,
      hitFlash: 0,
      angle: 0,
      bob: Math.random() * Math.PI * 2,
    });
  }

  function spawnParticles(x, y, color, count, speed = 120) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = rand(speed * 0.3, speed);
      particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: rand(0.25, 0.7),
        color,
        size: rand(2, 5),
      });
    }
  }

  function killZombie(z, index) {
    const points = z.type === "tank" ? 50 : z.type === "fast" ? 25 : 10;
    score += points;
    kills += 1;
    floats.push({
      x: z.x,
      y: z.y - 10,
      text: `+${points}`,
      life: 0.8,
      vy: -40,
    });
    spawnParticles(z.x, z.y, "#d8d4e8", z.type === "tank" ? 18 : 10, 140);
    spawnParticles(z.x, z.y, "#1a1a1a", 8, 90);
    spawnParticles(z.x, z.y, "#6a8ab8", 5, 60);
    zombies.splice(index, 1);
    shake = Math.max(shake, 5);
    updateHud();
  }

  function hurtPlayer(amount) {
    if (player.invuln > 0) return;
    player.hp -= amount;
    player.invuln = 0.7;
    shake = 10;
    spawnParticles(player.x, player.y, "#e85d4c", 8, 100);
    updateHud();
    if (player.hp <= 0) {
      player.hp = 0;
      state = "dead";
      finalScore.textContent = String(score);
      finalWave.textContent = String(wave);
      finalKills.textContent = String(kills);
      gameoverOverlay.classList.remove("hidden");
    }
  }

  function update(dt) {
    time += dt;

    for (const a of ambience) {
      a.y -= a.speed * dt;
      a.x += Math.sin(time * 0.8 + a.phase) * 12 * dt;
      if (a.y < -10) {
        a.y = H + 10;
        a.x = Math.random() * W;
      }
    }

    if (state !== "playing") return;

    player.angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);

    let mx = 0;
    let my = 0;
    if (keys["w"] || keys["arrowup"]) my -= 1;
    if (keys["s"] || keys["arrowdown"]) my += 1;
    if (keys["a"] || keys["arrowleft"]) mx -= 1;
    if (keys["d"] || keys["arrowright"]) mx += 1;

    if (mx || my) {
      const len = Math.hypot(mx, my);
      mx /= len;
      my /= len;
      player.x += mx * player.speed * dt;
      player.y += my * player.speed * dt;
    }

    player.x = Math.max(player.r, Math.min(W - player.r, player.x));
    player.y = Math.max(player.r, Math.min(H - player.r, player.y));

    player.fireCooldown = Math.max(0, player.fireCooldown - dt);
    player.invuln = Math.max(0, player.invuln - dt);
    muzzleFlash = Math.max(0, muzzleFlash - dt);
    shake = Math.max(0, shake - dt * 28);

    if (mouse.down) fire();

    // waves
    waveTimer += dt;
    if (spawnQueue > 0) {
      spawnCooldown -= dt;
      if (spawnCooldown <= 0) {
        spawnZombie();
        spawnQueue -= 1;
        spawnCooldown = Math.max(0.2, 0.55 - wave * 0.03);
      }
    } else if (zombies.length === 0) {
      startWave(wave + 1);
      score += wave * 20;
      updateHud();
    }

    // bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < -20 || b.x > W + 20 || b.y < -20 || b.y > H + 20) {
        bullets.splice(i, 1);
        continue;
      }

      for (let j = zombies.length - 1; j >= 0; j--) {
        const z = zombies[j];
        const dx = z.x - b.x;
        const dy = z.y - b.y;
        if (dx * dx + dy * dy < (z.r + b.r) * (z.r + b.r)) {
          z.hp -= b.damage || 1;
          z.hitFlash = 0.12;
          spawnParticles(b.x, b.y, b.color || loadout.accentSoft, 4, 90);
          bullets.splice(i, 1);
          if (z.hp <= 0) killZombie(z, j);
          break;
        }
      }
    }

    // zombies
    for (let i = zombies.length - 1; i >= 0; i--) {
      const z = zombies[i];
      z.hitFlash = Math.max(0, z.hitFlash - dt);
      z.bob += dt * (z.type === "fast" ? 8 : 4);
      const dx = player.x - z.x;
      const dy = player.y - z.y;
      const dist = Math.hypot(dx, dy) || 1;
      z.angle = Math.atan2(dy, dx);
      z.x += (dx / dist) * z.speed * dt;
      z.y += (dy / dist) * z.speed * dt;

      if (dist < player.r + z.r - 2) {
        const dmg = z.type === "tank" ? 18 : z.type === "fast" ? 8 : 12;
        hurtPlayer(dmg);
        // push apart
        const push = (player.r + z.r - dist) * 0.5;
        z.x -= (dx / dist) * push;
        z.y -= (dy / dist) * push;
      }
    }

    // light zombie separation
    for (let i = 0; i < zombies.length; i++) {
      for (let j = i + 1; j < zombies.length; j++) {
        const a = zombies[i];
        const b = zombies[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const minD = a.r + b.r;
        const d2 = dx * dx + dy * dy;
        if (d2 > 0 && d2 < minD * minD) {
          const d = Math.sqrt(d2);
          const push = ((minD - d) / 2) * 0.4;
          const nx = dx / d;
          const ny = dy / d;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
        }
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }

    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i];
      f.y += f.vy * dt;
      f.life -= dt;
      if (f.life <= 0) floats.splice(i, 1);
    }
  }

  function drawPine(x, baseY, scale, color) {
    const s = scale;
    ctx.fillStyle = "#3a2818";
    ctx.fillRect(x - 3 * s, baseY - 18 * s, 6 * s, 18 * s);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, baseY - 70 * s);
    ctx.lineTo(x + 22 * s, baseY - 38 * s);
    ctx.lineTo(x + 10 * s, baseY - 38 * s);
    ctx.lineTo(x + 26 * s, baseY - 18 * s);
    ctx.lineTo(x + 8 * s, baseY - 18 * s);
    ctx.lineTo(x + 28 * s, baseY);
    ctx.lineTo(x - 28 * s, baseY);
    ctx.lineTo(x - 8 * s, baseY - 18 * s);
    ctx.lineTo(x - 26 * s, baseY - 18 * s);
    ctx.lineTo(x - 10 * s, baseY - 38 * s);
    ctx.lineTo(x - 22 * s, baseY - 38 * s);
    ctx.closePath();
    ctx.fill();
  }

  function drawGround() {
    // mountain dusk sky
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#1a2838");
    sky.addColorStop(0.35, "#243828");
    sky.addColorStop(0.62, "#1a2a20");
    sky.addColorStop(1, "#121c16");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // far mountain range
    ctx.fillStyle = "#2a3a48";
    ctx.beginPath();
    ctx.moveTo(0, 280);
    ctx.lineTo(80, 200);
    ctx.lineTo(160, 240);
    ctx.lineTo(280, 150);
    ctx.lineTo(380, 210);
    ctx.lineTo(480, 130);
    ctx.lineTo(580, 190);
    ctx.lineTo(700, 140);
    ctx.lineTo(820, 200);
    ctx.lineTo(960, 170);
    ctx.lineTo(960, 320);
    ctx.lineTo(0, 320);
    ctx.closePath();
    ctx.fill();

    // mid mountain ridges
    ctx.fillStyle = "#1e3228";
    ctx.beginPath();
    ctx.moveTo(0, 340);
    ctx.lineTo(120, 260);
    ctx.lineTo(240, 300);
    ctx.lineTo(360, 230);
    ctx.lineTo(500, 290);
    ctx.lineTo(640, 220);
    ctx.lineTo(780, 280);
    ctx.lineTo(960, 240);
    ctx.lineTo(960, 400);
    ctx.lineTo(0, 400);
    ctx.closePath();
    ctx.fill();

    // snow caps
    ctx.fillStyle = "rgba(220, 230, 240, 0.35)";
    ctx.beginPath();
    ctx.moveTo(250, 165);
    ctx.lineTo(280, 150);
    ctx.lineTo(310, 168);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(450, 145);
    ctx.lineTo(480, 130);
    ctx.lineTo(510, 150);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(670, 155);
    ctx.lineTo(700, 140);
    ctx.lineTo(730, 158);
    ctx.closePath();
    ctx.fill();

    // forest floor
    const floor = ctx.createLinearGradient(0, 360, 0, H);
    floor.addColorStop(0, "#243828");
    floor.addColorStop(0.4, "#1a281c");
    floor.addColorStop(1, "#141e16");
    ctx.fillStyle = floor;
    ctx.fillRect(0, 360, W, H - 360);

    // dirt path
    ctx.fillStyle = "rgba(70, 58, 40, 0.35)";
    ctx.beginPath();
    ctx.moveTo(W * 0.35, 380);
    ctx.quadraticCurveTo(W * 0.45, 480, W * 0.4, H);
    ctx.lineTo(W * 0.62, H);
    ctx.quadraticCurveTo(W * 0.58, 480, W * 0.65, 380);
    ctx.closePath();
    ctx.fill();

    // moss patches
    ctx.fillStyle = "rgba(50, 90, 55, 0.28)";
    for (let i = 0; i < 14; i++) {
      const x = 40 + ((i * 137) % (W - 80));
      const y = 400 + ((i * 79) % (H - 420));
      ctx.beginPath();
      ctx.ellipse(x, y, 28 + (i % 4) * 8, 12 + (i % 3) * 4, i * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // rocks
    ctx.fillStyle = "rgba(80, 90, 85, 0.4)";
    for (let i = 0; i < 8; i++) {
      const x = 60 + ((i * 211) % (W - 120));
      const y = 420 + ((i * 97) % (H - 450));
      ctx.beginPath();
      ctx.ellipse(x, y, 14 + (i % 3) * 5, 8 + (i % 2) * 3, 0.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // pine trees — back
    for (const [x, y, s, c] of [
      [40, 390, 0.9, "#1a3a28"],
      [110, 400, 0.75, "#163424"],
      [200, 385, 1.0, "#1c402c"],
      [760, 395, 0.85, "#1a3a28"],
      [850, 388, 1.05, "#163424"],
      [920, 400, 0.7, "#1c402c"],
    ]) {
      drawPine(x, y, s, c);
    }

    // pine trees — front frame
    for (const [x, y, s, c] of [
      [-10, 520, 1.35, "#0e2818"],
      [70, 560, 1.15, "#12301c"],
      [880, 550, 1.2, "#0e2818"],
      [960, 530, 1.4, "#12301c"],
    ]) {
      drawPine(x, y, s, c);
    }

    // drifting mountain mist
    for (let i = 0; i < 6; i++) {
      const px = ((i * 180 + time * 18) % (W + 220)) - 110;
      const py = 250 + (i % 3) * 50 + Math.sin(time * 0.35 + i) * 12;
      const mist = ctx.createRadialGradient(px, py, 8, px, py, 130);
      mist.addColorStop(0, "rgba(180, 200, 190, 0.1)");
      mist.addColorStop(1, "rgba(180, 200, 190, 0)");
      ctx.fillStyle = mist;
      ctx.beginPath();
      ctx.ellipse(px, py, 150, 40, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // fireflies
    for (const a of ambience) {
      ctx.globalAlpha = a.alpha * (0.55 + 0.45 * Math.sin(time * 2 + a.phase));
      ctx.fillStyle = a.phase > Math.PI ? "#d4f0a8" : "#ffe6a0";
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawShadow(x, y, rx, ry) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.beginPath();
    ctx.ellipse(x, y + 14, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPlayer() {
    const accent = loadout.accent;
    const accentSoft = loadout.accentSoft;

    drawShadow(player.x, player.y, 16, 6);

    const aura = ctx.createRadialGradient(player.x, player.y, 4, player.x, player.y, 46);
    aura.addColorStop(0, loadout.glow);
    aura.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 46, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);

    if (player.invuln > 0 && Math.floor(player.invuln * 12) % 2 === 0) {
      ctx.globalAlpha = 0.45;
    }

    ctx.fillStyle = "#1a1220";
    ctx.beginPath();
    ctx.ellipse(0, 2, 11, 13, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.ellipse(0, 2, 11, 13, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = "#2a1830";
    ctx.beginPath();
    ctx.ellipse(0, 1, 6, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(0, 0, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f5c84a";
    ctx.beginPath();
    ctx.arc(0, -0.2, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#f5c84a";
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 2, -0.2 + Math.sin(a) * 2);
      ctx.lineTo(Math.cos(a) * 3.8, -0.2 + Math.sin(a) * 3.8);
      ctx.stroke();
    }

    ctx.fillStyle = "#e8c4a0";
    ctx.beginPath();
    ctx.arc(0, -10, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#0d0a12";
    ctx.beginPath();
    ctx.ellipse(0, -13, 8.5, 6.5, 0, Math.PI, 0);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-8, -12);
    ctx.quadraticCurveTo(-9, -20, -2, -18);
    ctx.quadraticCurveTo(2, -22, 6, -17);
    ctx.quadraticCurveTo(10, -19, 8.5, -11);
    ctx.lineTo(7, -10);
    ctx.quadraticCurveTo(0, -14, -7, -10);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(3, -18);
    ctx.quadraticCurveTo(7, -16, 7, -11);
    ctx.stroke();

    ctx.fillStyle = "#120818";
    ctx.beginPath();
    ctx.ellipse(0, -16.5, loadout.id === "baby" ? 9 : 11, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
    if (loadout.id !== "abby") {
      ctx.fillStyle = "#1a1024";
      ctx.fillRect(-5, -22, 10, 6);
      ctx.fillStyle = accent;
      ctx.fillRect(-5, -17, 10, 1.5);
    }

    ctx.fillStyle = "#1a1020";
    ctx.beginPath();
    ctx.ellipse(-2.8, -10, 1.6, 1.1, -0.2, 0, Math.PI * 2);
    ctx.ellipse(2.8, -10, 1.6, 1.1, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(-2.5, -10, 0.6, 0, Math.PI * 2);
    ctx.arc(3.1, -10, 0.6, 0, Math.PI * 2);
    ctx.fill();

    if (loadout.gunStyle === "sg") {
      ctx.fillStyle = "#3a3018";
      ctx.fillRect(6, -4, 20, 7);
      ctx.fillStyle = accent;
      ctx.fillRect(12, -5, 10, 2.5);
      ctx.fillStyle = "#5a4820";
      ctx.fillRect(22, -3.5, 12, 6);
    } else if (loadout.gunStyle === "smg") {
      ctx.fillStyle = "#1a2838";
      ctx.fillRect(6, -2.5, 18, 5);
      ctx.fillStyle = accent;
      ctx.fillRect(10, -3.5, 8, 2);
      ctx.fillStyle = "#203040";
      ctx.fillRect(20, -2, 10, 4);
      ctx.fillRect(10, 2, 4, 6);
    } else {
      ctx.fillStyle = "#1a1220";
      ctx.fillRect(6, -3, 24, 5);
      ctx.fillStyle = accent;
      ctx.fillRect(14, -4, 8, 2);
      ctx.fillStyle = "#3a2848";
      ctx.fillRect(24, -2.5, 8, 4);
    }

    if (muzzleFlash > 0) {
      ctx.shadowColor = accentSoft;
      ctx.shadowBlur = 16;
      ctx.fillStyle = "#ffe0f0";
      ctx.beginPath();
      ctx.moveTo(28, 0);
      ctx.lineTo(40, -7);
      ctx.lineTo(46, 0);
      ctx.lineTo(40, 7);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    ctx.restore();

    ctx.save();
    ctx.strokeStyle = accent + "59";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(
      player.x + Math.cos(player.angle) * 28,
      player.y + Math.sin(player.angle) * 28
    );
    ctx.lineTo(
      player.x + Math.cos(player.angle) * 140,
      player.y + Math.sin(player.angle) * 140
    );
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }


  function drawGhost(z) {
    const bobY = Math.sin(z.bob) * (z.type === "tank" ? 1.5 : 3.5);
    drawShadow(z.x, z.y + bobY, z.r * 0.9, z.r * 0.28);

    ctx.save();
    ctx.translate(z.x, z.y + bobY);
    ctx.rotate(z.angle);

    const flash = z.hitFlash > 0;
    const isTank = z.type === "tank";
    const isFast = z.type === "fast";

    // ethereal aura
    ctx.globalAlpha = 0.22 + 0.08 * Math.sin(time * 3 + z.bob);
    ctx.fillStyle = isTank ? "#6a5068" : isFast ? "#8898b8" : "#c8d0e8";
    ctx.beginPath();
    ctx.arc(0, 0, z.r * 1.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    if (isTank) {
      const robe = flash ? "#f0e8d8" : "#1a3a2a";
      ctx.fillStyle = robe;
      ctx.fillRect(-z.r * 0.7, -z.r * 0.3, z.r * 1.4, z.r * 1.4);

      ctx.fillStyle = flash ? "#f5e6c8" : "#d8c8a8";
      ctx.fillRect(z.r * 0.2, -z.r * 0.85, z.r * 0.9, z.r * 0.35);
      ctx.fillRect(z.r * 0.2, z.r * 0.5, z.r * 0.9, z.r * 0.35);

      ctx.fillStyle = flash ? "#fff" : "#e8dcc8";
      ctx.beginPath();
      ctx.arc(0, -z.r * 0.55, z.r * 0.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(-z.r * 0.35, -z.r * 1.35, z.r * 0.7, z.r * 0.55);
      ctx.fillRect(-z.r * 0.45, -z.r * 0.85, z.r * 0.9, z.r * 0.15);

      ctx.fillStyle = "#c41e1e";
      ctx.fillRect(-z.r * 0.18, -z.r * 0.75, z.r * 0.36, z.r * 0.45);
      ctx.fillStyle = "#f5e6a8";
      ctx.font = `${Math.max(8, z.r * 0.45)}px serif`;
      ctx.textAlign = "center";
      ctx.fillText("符", 0, -z.r * 0.42);

      ctx.shadowColor = "#ff3030";
      ctx.shadowBlur = 8;
      ctx.fillStyle = "#ff3030";
      ctx.beginPath();
      ctx.arc(-z.r * 0.18, -z.r * 0.55, 2.2, 0, Math.PI * 2);
      ctx.arc(z.r * 0.18, -z.r * 0.55, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    } else {
      const robe = flash ? "#ffffff" : isFast ? "#d8dce8" : "#f2f0f5";

      ctx.fillStyle = robe;
      ctx.globalAlpha = 0.92;
      ctx.beginPath();
      ctx.moveTo(-z.r * 0.55, -z.r * 0.2);
      ctx.quadraticCurveTo(-z.r * 0.9, z.r * 0.8, -z.r * 0.2, z.r * 1.2);
      ctx.lineTo(z.r * 0.2, z.r * 1.2);
      ctx.quadraticCurveTo(z.r * 0.9, z.r * 0.8, z.r * 0.55, -z.r * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.strokeStyle = robe;
      ctx.lineWidth = isFast ? 5 : 7;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-z.r * 0.2, 0);
      ctx.quadraticCurveTo(z.r * 0.5, -z.r * 0.5, z.r * 1.15, -z.r * 0.25);
      ctx.moveTo(-z.r * 0.2, z.r * 0.15);
      ctx.quadraticCurveTo(z.r * 0.5, z.r * 0.55, z.r * 1.15, z.r * 0.35);
      ctx.stroke();

      ctx.fillStyle = flash ? "#fff" : "#e8e4dc";
      ctx.beginPath();
      ctx.arc(0, -z.r * 0.15, z.r * 0.55, 0, Math.PI * 2);
      ctx.fill();

      if (!isFast) {
        ctx.strokeStyle = "#8b0000";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-z.r * 0.15, -z.r * 0.05);
        ctx.lineTo(-z.r * 0.12, z.r * 0.25);
        ctx.stroke();
      }

      ctx.fillStyle = "#0a0a0a";
      ctx.beginPath();
      ctx.ellipse(0, -z.r * 0.35, z.r * 0.7, z.r * 0.55, 0, Math.PI, 0);
      ctx.fill();
      for (let i = -3; i <= 3; i++) {
        const sx = i * z.r * 0.18;
        ctx.beginPath();
        ctx.moveTo(sx, -z.r * 0.2);
        ctx.quadraticCurveTo(
          sx + (i % 2) * 3,
          z.r * 0.5,
          sx + Math.sin(i) * 4,
          z.r * (isFast ? 0.7 : 1.05)
        );
        ctx.lineWidth = isFast ? 2.5 : 3.5;
        ctx.strokeStyle = "#0a0a0a";
        ctx.stroke();
      }

      ctx.shadowColor = isFast ? "#88ccff" : "#ff2222";
      ctx.shadowBlur = 10;
      ctx.fillStyle = isFast ? "#88ccff" : "#ff2222";
      ctx.beginPath();
      ctx.arc(z.r * 0.12, -z.r * 0.08, isFast ? 2.8 : 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(z.r * 0.15, -z.r * 0.1, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    if (z.hp < z.maxHp) {
      const bw = z.r * 2;
      const bh = 4;
      const by = z.y + bobY - z.r - 14;
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(z.x - bw / 2, by, bw, bh);
      const hg = ctx.createLinearGradient(z.x - bw / 2, 0, z.x + bw / 2, 0);
      hg.addColorStop(0, "#ff4fa3");
      hg.addColorStop(1, "#e8c87a");
      ctx.fillStyle = hg;
      ctx.fillRect(z.x - bw / 2, by, bw * (z.hp / z.maxHp), bh);
    }
  }

  function drawCrosshair() {
    if (state !== "playing") return;
    const x = mouse.x;
    const y = mouse.y;
    ctx.save();
    ctx.strokeStyle = "rgba(255, 154, 208, 0.75)";
    ctx.lineWidth = 1.5;
    const gap = 5;
    const arm = 9;
    ctx.beginPath();
    ctx.moveTo(x - arm, y);
    ctx.lineTo(x - gap, y);
    ctx.moveTo(x + gap, y);
    ctx.lineTo(x + arm, y);
    ctx.moveTo(x, y - arm);
    ctx.lineTo(x, y - gap);
    ctx.moveTo(x, y + gap);
    ctx.lineTo(x, y + arm);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function draw() {
    ctx.save();
    if (shake > 0) {
      ctx.translate(
        (Math.random() - 0.5) * shake,
        (Math.random() - 0.5) * shake
      );
    }

    drawGround();

    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life * 2);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    for (const b of bullets) {
      const trail = ctx.createLinearGradient(
        b.x,
        b.y,
        b.x - b.vx * 0.03,
        b.y - b.vy * 0.03
      );
      trail.addColorStop(0, "rgba(255, 240, 250, 0.95)");
      trail.addColorStop(1, "rgba(255, 79, 163, 0)");
      ctx.strokeStyle = trail;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - b.vx * 0.03, b.y - b.vy * 0.03);
      ctx.stroke();

      ctx.shadowColor = b.color || loadout.accent;
      ctx.shadowBlur = 12;
      ctx.fillStyle = b.color || loadout.accentSoft;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // depth sort ghosts roughly by y
    const sorted = zombies.slice().sort((a, b) => a.y - b.y);
    for (const z of sorted) drawGhost(z);
    if (state !== "menu") drawPlayer();

    for (const f of floats) {
      ctx.globalAlpha = Math.min(1, f.life * 2);
      const waveText = f.text.startsWith("웨이브");
      ctx.fillStyle = waveText ? "#ff9ad0" : "#fff";
      ctx.shadowColor = waveText ? "#ff4fa3" : "rgba(0,0,0,0.5)";
      ctx.shadowBlur = waveText ? 18 : 4;
      ctx.font = waveText
        ? "36px 'Black Han Sans', sans-serif"
        : "bold 14px 'Noto Sans KR', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    drawCrosshair();

    // cinematic vignette
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.78);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(0.7, "rgba(8,4,12,0.2)");
    vg.addColorStop(1, "rgba(4,2,8,0.62)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    // corner accent lines
    ctx.strokeStyle = "rgba(255, 79, 163, 0.22)";
    ctx.lineWidth = 1.5;
    const c = 22;
    ctx.beginPath();
    ctx.moveTo(14, 14 + c);
    ctx.lineTo(14, 14);
    ctx.lineTo(14 + c, 14);
    ctx.moveTo(W - 14, 14 + c);
    ctx.lineTo(W - 14, 14);
    ctx.lineTo(W - 14 - c, 14);
    ctx.moveTo(14, H - 14 - c);
    ctx.lineTo(14, H - 14);
    ctx.lineTo(14 + c, H - 14);
    ctx.moveTo(W - 14, H - 14 - c);
    ctx.lineTo(W - 14, H - 14);
    ctx.lineTo(W - 14 - c, H - 14);
    ctx.stroke();

    ctx.restore();
  }

  function loop(ts) {
    const dt = Math.min(0.033, (ts - lastTime) / 1000 || 0);
    lastTime = ts;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  function toCanvasPos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  }

  window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    keys[k] = true;

    if (k === " " || k === "escape") {
      e.preventDefault();
      if (state === "playing") {
        state = "paused";
        pauseOverlay.classList.remove("hidden");
      } else if (state === "paused") {
        state = "playing";
        pauseOverlay.classList.add("hidden");
      }
    }
  });

  window.addEventListener("keyup", (e) => {
    keys[e.key.toLowerCase()] = false;
  });

  canvas.addEventListener("mousemove", (e) => {
    const p = toCanvasPos(e);
    mouse.x = p.x;
    mouse.y = p.y;
  });

  canvas.addEventListener("mousedown", (e) => {
    if (e.button === 0) {
      mouse.down = true;
      const p = toCanvasPos(e);
      mouse.x = p.x;
      mouse.y = p.y;
    }
  });

  window.addEventListener("mouseup", (e) => {
    if (e.button === 0) mouse.down = false;
  });

  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  function openSelect() {
    overlay.classList.add("hidden");
    gameoverOverlay.classList.add("hidden");
    pauseOverlay.classList.add("hidden");
    selectOverlay.classList.remove("hidden");
    syncSelectUI();
    state = "select";
  }

  function begin() {
    selectOverlay.classList.add("hidden");
    overlay.classList.add("hidden");
    gameoverOverlay.classList.add("hidden");
    pauseOverlay.classList.add("hidden");
    resetGame();
    state = "playing";
  }

  selectCards.forEach((card) => {
    card.addEventListener("click", () => {
      applyLoadout(card.dataset.id);
      syncSelectUI();
    });
  });

  startBtn.addEventListener("click", openSelect);
  restartBtn.addEventListener("click", openSelect);
  confirmBtn.addEventListener("click", begin);
  backMenuBtn.addEventListener("click", () => {
    selectOverlay.classList.add("hidden");
    overlay.classList.remove("hidden");
    state = "menu";
  });
  resumeBtn.addEventListener("click", () => {
    state = "playing";
    pauseOverlay.classList.add("hidden");
  });

  applyLoadout("jinu");
  syncSelectUI();

  // idle draw on menu
  draw();
  requestAnimationFrame(loop);
})();
