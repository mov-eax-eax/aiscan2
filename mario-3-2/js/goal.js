/* =========================================================================
   MARIO 3-2 — goal.js
   The end-of-level white flag post, its "course clear" card panel (three
   spinning SMB3 cards), and the celebration effects. Emits 'goal' once.
   ========================================================================= */
(function () {
  'use strict';
  const M = window.M32 || (window.M32 = {});
  const C = M.C;
  const PAL = M.PAL;

  /* ------------------------------------------------- small canvas helpers */
  function texFromCanvas(w, h, draw) {
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const g = cv.getContext('2d');
    draw(g, w, h);
    const t = new THREE.CanvasTexture(cv);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.LinearFilter;
    return t;
  }

  const CARD_DRAW = {
    mushroom(g, w, h) {
      g.clearRect(0, 0, w, h);
      // background card
      g.fillStyle = '#f7f2e2';
      g.fillRect(0, 0, w, h);
      g.strokeStyle = '#2a2a2a';
      g.lineWidth = 8;
      g.strokeRect(4, 4, w - 8, h - 8);
      // cap
      g.fillStyle = '#e23a2e';
      g.beginPath();
      g.arc(w / 2, h * 0.42, w * 0.30, Math.PI, 0);
      g.fill();
      // spots
      g.fillStyle = '#fff6e8';
      g.beginPath();
      g.arc(w * 0.36, h * 0.36, w * 0.085, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.arc(w * 0.64, h * 0.34, w * 0.06, 0, Math.PI * 2);
      g.fill();
      // stem
      g.fillStyle = '#f6d9a8';
      g.fillRect(w * 0.38, h * 0.52, w * 0.24, h * 0.22);
      // eyes
      g.fillStyle = '#2a2a2a';
      g.fillRect(w * 0.42, h * 0.56, w * 0.06, h * 0.09);
      g.fillRect(w * 0.52, h * 0.56, w * 0.06, h * 0.09);
    },
    flower(g, w, h) {
      g.fillStyle = '#f7f2e2';
      g.fillRect(0, 0, w, h);
      g.strokeStyle = '#2a2a2a';
      g.lineWidth = 8;
      g.strokeRect(4, 4, w - 8, h - 8);
      g.fillStyle = '#f5a24a';
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        g.beginPath();
        g.ellipse(w / 2 + Math.cos(a) * w * 0.18, h * 0.44 + Math.sin(a) * h * 0.18, w * 0.1, h * 0.12, a, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = '#ffe14d';
      g.beginPath();
      g.arc(w / 2, h * 0.44, w * 0.13, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#2a2a2a';
      g.fillRect(w * 0.44, h * 0.48, w * 0.04, h * 0.06);
      g.fillRect(w * 0.54, h * 0.48, w * 0.04, h * 0.06);
      g.fillStyle = '#4caf50';
      g.fillRect(w * 0.47, h * 0.6, w * 0.06, h * 0.22);
    },
    star(g, w, h) {
      g.fillStyle = '#f7f2e2';
      g.fillRect(0, 0, w, h);
      g.strokeStyle = '#2a2a2a';
      g.lineWidth = 8;
      g.strokeRect(4, 4, w - 8, h - 8);
      g.fillStyle = '#ffd75e';
      g.strokeStyle = '#c08a12';
      g.lineWidth = 5;
      g.beginPath();
      const cx = w / 2, cy = h * 0.48, R = w * 0.32, r = w * 0.14;
      for (let i = 0; i < 10; i++) {
        const a = (i * Math.PI) / 5 - Math.PI / 2;
        const rr = i % 2 === 0 ? R : r;
        const px = cx + Math.cos(a) * rr;
        const py = cy + Math.sin(a) * rr;
        i ? g.lineTo(px, py) : g.moveTo(px, py);
      }
      g.closePath();
      g.fill();
      g.stroke();
      g.fillStyle = '#2a2a2a';
      g.fillRect(w * 0.42, h * 0.46, w * 0.05, h * 0.08);
      g.fillRect(w * 0.53, h * 0.46, w * 0.05, h * 0.08);
    },
    coin(g, w, h) {
      g.fillStyle = '#f7f2e2';
      g.fillRect(0, 0, w, h);
      g.strokeStyle = '#2a2a2a';
      g.lineWidth = 8;
      g.strokeRect(4, 4, w - 8, h - 8);
      g.fillStyle = '#ffcf3d';
      g.strokeStyle = '#b8860b';
      g.lineWidth = 6;
      g.beginPath();
      g.arc(w / 2, h / 2, w * 0.30, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillStyle = '#fff2b0';
      g.fillRect(w * 0.44, h * 0.32, w * 0.05, h * 0.36);
      g.fillRect(w * 0.52, h * 0.32, w * 0.03, h * 0.36);
    },
  };

  M32.Goal = class Goal {
    constructor(scene, level, level3d) {
      this.scene = scene;
      this.level = level || { goal: { x: 6150, y: 40 } };
      this.level3d = level3d;
      this.group = new THREE.Group();
      this.group.name = 'goal';
      this.group.position.z = 1;
      scene.add(this.group);
      this.triggered = false;
      this.t = 0;
      this.anim = 0;
      this.cardSpin = 0;
      this.cards = [];
      this.fireworkT = 0;
      this.flagMesh = null;
      this.poleTopY = 0;
      this.baseX = this.level.goal ? this.level.goal.x : 6150;
      this.baseY = this._surfaceAt(this.baseX);
      this._build();
      this.triggerBox = { x: this.baseX - 34, y: this.baseY, w: 68, h: 340 };
    }

    _surfaceAt(x) {
      if (this.level.goal && isFinite(this.level.goal.y) && this.level.goal.y > 40) return this.level.goal.y;
      if (this.level3d) {
        if (typeof this.level3d.surfaceY === 'function') {
          const y = this.level3d.surfaceY(x);
          if (isFinite(y)) return y;
        }
        if (typeof this.level3d.solidAt === 'function') {
          // scan upward for the top of the beach
          for (let y = 1000; y > 0; y -= 8) {
            const s = this.level3d.solidAt(x, y);
            if (s) return s.y + s.h;
          }
        }
      }
      return 900;
    }

    /* ---------------------------------------------------------------- art */
    _build() {
      const g = this.group;
      const base = this.baseY;
      const px = this.baseX;
      const matPole = new THREE.MeshLambertMaterial({ color: 0xe8eef2 });
      const matPoleDark = new THREE.MeshLambertMaterial({ color: 0xaab8c2 });
      const matGold = new THREE.MeshLambertMaterial({ color: PAL.gold, emissive: 0x4a3300 });
      const matPost = new THREE.MeshLambertMaterial({ color: 0x8a5a2b });
      const matWood = new THREE.MeshLambertMaterial({ color: 0xc98a4b });

      // small wooden pedestal on the beach
      const ped = new THREE.Mesh(new THREE.BoxGeometry(86, 22, 30), matWood);
      ped.position.set(px, base + 11, 0);
      g.add(ped);
      const ped2 = new THREE.Mesh(new THREE.BoxGeometry(60, 14, 22), matPost);
      ped2.position.set(px, base + 29, 0);
      g.add(ped2);

      // flag pole — kept inside the camera's reachable band (<= y 1080) so the
      // flag, ball and cards are all on screen when the player arrives.
      const poleH = 118;
      const pole = new THREE.Mesh(new THREE.BoxGeometry(9, poleH, 9), matPole);
      pole.position.set(px, base + 34 + poleH / 2, 0);
      g.add(pole);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(3, poleH - 12, 2), matPoleDark);
      stripe.position.set(px + 5, base + 34 + poleH / 2, 6);
      g.add(stripe);
      this.poleTopY = base + 34 + poleH;
      const ball = new THREE.Mesh(new THREE.SphereGeometry(13, 12, 10), matGold);
      ball.position.set(px, this.poleTopY + 11, 0);
      g.add(ball);
      this.ball = ball;

      // flag cloth — a white flag that lowers on clear
      const flagTex = texFromCanvas(96, 64, (gg2, w, h) => {
        gg2.fillStyle = '#f8fbff';
        gg2.fillRect(0, 0, w, h);
        gg2.fillStyle = '#dfe9f2';
        for (let i = 0; i < 4; i++) gg2.fillRect(0, h - 8 - i * 12, w, 4);
        // little star emblem
        gg2.save();
        gg2.translate(w * 0.5, h * 0.5);
        gg2.fillStyle = '#ffd75e';
        gg2.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = (i * Math.PI) / 5 - Math.PI / 2;
          const rr = i % 2 === 0 ? 17 : 7;
          const sx = Math.cos(a) * rr;
          const sy = Math.sin(a) * rr;
          i ? gg2.lineTo(sx, sy) : gg2.moveTo(sx, sy);
        }
        gg2.closePath();
        gg2.fill();
        gg2.restore();
      });
      const flagMat = new THREE.MeshLambertMaterial({ map: flagTex, side: THREE.DoubleSide });
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(84, 56, 6, 1), flagMat);
      flag.position.set(px + 46, this.poleTopY - 34, 1);
      g.add(flag);
      this.flagMesh = flag;
      this.flagBaseY = flag.position.y;

      // SMB3 card panel — three cards flip up on the LEFT of the pole, above the
      // beach approach so the player sees them all the way in.
      const cardW = 58;
      const cardH = 78;
      const names = ['mushroom', 'flower', 'star'];
      const panelY = base + 78;
      const panelCx = px - 172;
      this.panelY = panelY;
      for (let i = 0; i < 3; i++) {
        const tex = texFromCanvas(96, 128, CARD_DRAW[names[i]]);
        const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide });
        const card = new THREE.Mesh(new THREE.PlaneGeometry(cardW, cardH), mat);
        card.position.set(panelCx - 70 + i * 70, panelY, 2);
        card.visible = false;
        g.add(card);
        this.cards.push({
          mesh: card,
          name: names[i],
          baseX: card.position.x,
          baseY: panelY,
          delay: i * 0.18,
          settled: false,
        });
      }
      // soft radial glow behind the panel (no hard rectangle edges)
      const glowTex = texFromCanvas(128, 128, (g2, w, h) => {
        const rg = g2.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
        rg.addColorStop(0, 'rgba(255,244,200,0.95)');
        rg.addColorStop(0.45, 'rgba(255,236,170,0.42)');
        rg.addColorStop(1, 'rgba(255,230,150,0)');
        g2.fillStyle = rg;
        g2.fillRect(0, 0, w, h);
      });
      const glow = new THREE.Mesh(
        new THREE.PlaneGeometry(300, 170),
        new THREE.MeshBasicMaterial({
          map: glowTex,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      );
      glow.position.set(panelCx, panelY, -1);
      g.add(glow);
      this.panelGlow = glow;
      this.banner = null;
    }

    /* ------------------------------------------------------------- state */
    reset() {
      this.triggered = false;
      this.anim = 0;
      this.t = 0;
      this.cardSpin = 0;
      this.fireworkT = 0;
      if (this.flagMesh) {
        this.flagMesh.position.y = this.flagBaseY;
        this.flagMesh.rotation.z = 0;
        this.flagMesh.visible = true;
      }
      if (this.cards) {
        for (const c of this.cards) {
          c.mesh.visible = false;
          c.mesh.rotation.y = 0;
          c.mesh.scale.set(1, 1, 1);
          c.mesh.position.set(c.baseX, c.baseY, 2);
          c.settled = false;
        }
      }
      if (this.panelGlow) this.panelGlow.material.opacity = 0;
      if (this.banner) this.banner.material.opacity = 0;
      if (this.ball) this.ball.material.color.setHex(PAL.gold);
    }

    trigger() {
      if (this.triggered) return;
      this.triggered = true;
      this.t = 0;
      this.anim = 0;
      M.Game.emit('goal', { x: this.baseX, y: this.baseY });
      const P = M.Game.particles;
      if (P) {
        P.burst(this.baseX, this.poleTopY, {
          count: 40,
          color: 0xffe14d,
          speed: 420,
          size: 9,
          life: 1.2,
          gravity: 520,
          sprite: 'star',
        });
      }
    }

    /* ------------------------------------------------------------ update */
    update(dt) {
      this.t += dt;
      // idle: gently wave the flag
      if (this.flagMesh) {
        const wave = this.triggered ? 0 : Math.sin(this.t * 3.1) * 0.05;
        this.flagMesh.rotation.z = wave;
      }
      if (!this.triggered) {
        const player = M.Game.player;
        if (player && !player.dead && this._overlaps(player)) this.trigger();
        // subtle panel pulse while waiting
        return;
      }

      // celebration animation
      this.anim = Math.min(1, this.anim + dt);
      const a = M.easeOutCubic(Math.min(1, this.anim * 0.6));
      if (this.flagMesh) {
        // flag slides down the pole
        const low = this.poleTopY - 150;
        this.flagMesh.position.y = M.lerp(this.flagBaseY, low, a);
        this.flagMesh.rotation.z = Math.sin(this.t * 6) * 0.08 * (1 - a) + 0.05;
      }
      if (this.ball) {
        this.ball.rotation.y += dt * 3;
        this.ball.scale.setScalar(1 + Math.sin(this.t * 5) * 0.06);
      }
      // cards flip in with a stagger
      const t = this.t;
      for (let i = 0; i < this.cards.length; i++) {
        const c = this.cards[i];
        const start = 0.9 + c.delay;
        if (t > start) {
          c.mesh.visible = true;
          const k = Math.min(1, (t - start) / 0.9);
          const spin = (1 - k) * Math.PI * 6;
          c.mesh.rotation.y = spin;
          const pop = 1 + Math.sin(k * Math.PI) * 0.25;
          c.mesh.scale.set(pop, pop, 1);
          c.mesh.position.y = c.baseY + (1 - M.easeOutCubic(k)) * -40;
          if (k >= 1 && !c.settled) {
            c.settled = true;
            const P = M.Game.particles;
            if (P) {
              P.burst(this.baseX - 74 + i * 74, c.baseY, {
                count: 10,
                color: 0xffffff,
                speed: 160,
                size: 6,
                life: 0.6,
                gravity: 200,
                sprite: 'spark',
              });
            }
          }
        }
      }
      if (this.panelGlow) this.panelGlow.material.opacity = Math.min(0.34, this.t * 0.3) * (0.8 + Math.sin(this.t * 4) * 0.2);
      if (this.banner) {
        this.banner.material.opacity = Math.min(1, Math.max(0, (this.t - 2.2) * 1.4)) * 0.95;
        this.banner.position.y = this.panelY + 112 + Math.max(0, (0.5 - this.t * 0.3)) * 0;
      }

      // fireworks while celebrating
      this.fireworkT -= dt;
      if (this.fireworkT <= 0 && this.t < 7) {
        this.fireworkT = 0.55;
        const P = M.Game.particles;
        if (P) {
          const x = this.baseX + (Math.random() * 2 - 1) * 260;
          const y = this.poleTopY + 120 + Math.random() * 160;
          const colors = [0xff5a4a, 0x5ad2ff, 0xffe14d, 0x8cff6b, 0xff8cf0];
          P.burst(x, y, {
            count: 26,
            color: colors[(Math.random() * colors.length) | 0],
            speed: 300,
            size: 8,
            life: 1.1,
            gravity: 340,
            spread: 'circle',
            sprite: 'star',
          });
        }
        if (M.Game.audio) M.Game.audio.play('bubble', { vol: 0.35, pitch: 1.4 });
      }
    }

    _overlaps(player) {
      const b = this.triggerBox;
      const pw = player.w || 26;
      const ph = player.h || 30;
      const pb = { x: player.x - pw / 2, y: player.y, w: pw, h: ph };
      return M.aabb(pb, b);
    }
  };

  // core.js may not define M32.Goal if goal.js loads before it — it does; guard anyway.
})(window);
