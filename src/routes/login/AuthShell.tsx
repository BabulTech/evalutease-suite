/* eslint-disable sonarjs/pseudo-random -- all Math.random() calls here are for decorative canvas animation only */
import React, { useEffect, useRef } from "react";
// import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex flex-col relative bg-[#050c14]">
      <QuizBackground />
      <header className="relative z-10 flex items-center justify-between px-5 py-4 shrink-0">
        <img src="/jancho_logo_512.svg" alt="Jancho" className="size-20 object-contain" />
        {/* <LanguageSwitcher /> */}
      </header>
      <div className="relative z-10 flex-1 flex items-start sm:items-center justify-center p-4 sm:py-8 overflow-y-auto">
        <div className="w-full max-w-md bg-card/65 backdrop-blur-2xl border border-white/10 rounded-2xl sm:rounded-3xl p-5 sm:p-8 my-auto shadow-[0_0_60px_rgba(34,197,94,0.08),0_25px_50px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.07)]">
          {children}
        </div>
      </div>
    </div>
  );
}

function QuizBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf: number;
    let t = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    type Star = { x: number; y: number; r: number; twinkle: number; speed: number };
    const stars: Star[] = Array.from({ length: 200 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 1.5 + 0.2,
      twinkle: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.03 + 0.01,
    }));

    type Shoot = {
      x: number;
      y: number;
      vx: number;
      vy: number;
      len: number;
      alpha: number;
      life: number;
    };
    const shoots: Shoot[] = [];
    const spawnShoot = () => {
      const angle = (Math.random() * 30 + 20) * (Math.PI / 180);
      const speed = 8 + Math.random() * 8;
      shoots.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight * 0.5,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        len: 80 + Math.random() * 100,
        alpha: 1,
        life: 1,
      });
    };
    const shootTimer = setInterval(spawnShoot, 1800);

    type Orb = { cx: number; cy: number; r: number; phase: number; speed: number; hue: number };
    const orbs: Orb[] = [
      { cx: 0.15, cy: 0.25, r: 220, phase: 0, speed: 0.3, hue: 140 },
      { cx: 0.85, cy: 0.65, r: 180, phase: 2.1, speed: 0.25, hue: 160 },
      { cx: 0.5, cy: 0.85, r: 150, phase: 4.2, speed: 0.35, hue: 120 },
      { cx: 0.75, cy: 0.1, r: 120, phase: 1.0, speed: 0.2, hue: 180 },
    ];

    type Node = {
      x: number;
      y: number;
      vx: number;
      vy: number;
      r: number;
      pulse: number;
      hue: number;
    };
    const nodes: Node[] = Array.from({ length: 60 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      r: Math.random() * 3 + 1,
      pulse: Math.random() * Math.PI * 2,
      hue: 120 + Math.random() * 60,
    }));

    const CARDS = [
      { emoji: "🎯", label: "QUIZ", color: "#22c55e" },
      { emoji: "🧠", label: "THINK", color: "#4ade80" },
      { emoji: "⚡", label: "FAST", color: "#86efac" },
      { emoji: "🏆", label: "WIN", color: "#fbbf24" },
      { emoji: "🎓", label: "LEARN", color: "#60a5fa" },
      { emoji: "💡", label: "IDEA", color: "#a78bfa" },
      { emoji: "🔥", label: "HOT", color: "#f97316" },
      { emoji: "✨", label: "SMART", color: "#22d3ee" },
      { emoji: "🎮", label: "PLAY", color: "#ec4899" },
      { emoji: "📚", label: "STUDY", color: "#34d399" },
    ];
    type HCard = {
      x: number;
      y: number;
      vx: number;
      vy: number;
      w: number;
      h: number;
      rot: number;
      rotV: number;
      pulse: number;
      pSpeed: number;
      emoji: string;
      label: string;
      color: string;
    };
    const hcards: HCard[] = CARDS.map((c) => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      w: 120 + Math.random() * 50,
      h: 64,
      rot: Math.random() * Math.PI * 2,
      rotV: (Math.random() - 0.5) * 0.006,
      pulse: Math.random() * Math.PI * 2,
      pSpeed: 0.025 + Math.random() * 0.02,
      ...c,
    }));

    const drawAurora = () => {
      const W = canvas.width,
        H = canvas.height;
      for (let layer = 0; layer < 3; layer++) {
        const points: [number, number][] = [];
        const segments = 12;
        const baseY = H * (0.55 + layer * 0.12);
        for (let i = 0; i <= segments; i++) {
          points.push([
            (i / segments) * W,
            baseY +
              Math.sin(t * (0.4 + layer * 0.1) + i * 0.8) * (50 + layer * 20) +
              Math.cos(t * (0.2 + layer * 0.05) + i * 0.5) * 30,
          ]);
        }
        const grad = ctx.createLinearGradient(0, baseY - 80, 0, baseY + 80);
        const alpha = 0.04 + layer * 0.02;
        const hue = 140 + layer * 20;
        grad.addColorStop(0, `hsla(${hue},90%,60%,0)`);
        grad.addColorStop(0.4, `hsla(${hue},90%,60%,${alpha})`);
        grad.addColorStop(0.6, `hsla(${hue + 20},80%,70%,${alpha * 0.6})`);
        grad.addColorStop(1, `hsla(${hue},90%,60%,0)`);
        ctx.beginPath();
        ctx.moveTo(0, H);
        ctx.lineTo(points[0][0], points[0][1]);
        for (let i = 1; i < points.length; i++) {
          const prev = points[i - 1];
          const curr = points[i];
          ctx.quadraticCurveTo(prev[0], prev[1], (prev[0] + curr[0]) / 2, (prev[1] + curr[1]) / 2);
        }
        ctx.lineTo(W, H);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
      }
    };

    const draw = () => {
      t += 0.008;
      const W = canvas.width,
        H = canvas.height;
      const bg = ctx.createLinearGradient(0, 0, W * 0.3, H);
      bg.addColorStop(0, "#020812");
      bg.addColorStop(0.5, "#040d1a");
      bg.addColorStop(1, "#060e14");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      orbs.forEach((o) => {
        const ox = W * o.cx + Math.sin(t * o.speed + o.phase) * 60;
        const oy = H * o.cy + Math.cos(t * o.speed * 0.7 + o.phase) * 40;
        const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, o.r);
        g.addColorStop(0, `hsla(${o.hue},90%,55%,0.12)`);
        g.addColorStop(0.4, `hsla(${o.hue},80%,45%,0.06)`);
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(ox, oy, o.r, 0, Math.PI * 2);
        ctx.fill();
      });
      stars.forEach((s) => {
        s.twinkle += s.speed;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200,230,255,${0.3 + Math.sin(s.twinkle) * 0.5})`;
        ctx.fill();
      });
      drawAurora();
      ctx.save();
      ctx.strokeStyle = "rgba(34,197,94,0.035)";
      ctx.lineWidth = 0.8;
      const hex = 55;
      const rows = Math.ceil(H / (hex * 0.866)) + 2;
      const cols = Math.ceil(W / hex) + 2;
      for (let row = -1; row < rows; row++) {
        for (let col = -1; col < cols; col++) {
          const cx = col * hex + (row % 2) * (hex / 2) + ((t * 8) % hex);
          const cy = row * hex * 0.866;
          ctx.beginPath();
          for (let k = 0; k < 6; k++) {
            const angle = (k * 60 - 30) * (Math.PI / 180);
            const hx = cx + hex * 0.48 * Math.cos(angle);
            const hy = cy + hex * 0.48 * Math.sin(angle);
            if (k === 0) ctx.moveTo(hx, hy);
            else ctx.lineTo(hx, hy);
          }
          ctx.closePath();
          ctx.stroke();
        }
      }
      ctx.restore();
      nodes.forEach((n) => {
        n.x += n.vx;
        n.y += n.vy;
        n.pulse += 0.03;
        if (n.x < 0) n.x = W;
        if (n.x > W) n.x = 0;
        if (n.y < 0) n.y = H;
        if (n.y > H) n.y = 0;
      });
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 110) {
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = `hsla(${nodes[i].hue},80%,60%,${0.15 * (1 - d / 110)})`;
            ctx.lineWidth = 0.7;
            ctx.stroke();
          }
        }
      }
      nodes.forEach((n) => {
        const glow = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 4);
        const a = 0.6 + Math.sin(n.pulse) * 0.4;
        glow.addColorStop(0, `hsla(${n.hue},90%,70%,${a})`);
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${n.hue},100%,90%,${a})`;
        ctx.fill();
      });
      for (let i = shoots.length - 1; i >= 0; i--) {
        const s = shoots[i];
        s.x += s.vx;
        s.y += s.vy;
        s.life -= 0.015;
        if (s.life <= 0) {
          shoots.splice(i, 1);
          continue;
        }
        ctx.save();
        const grad = ctx.createLinearGradient(
          s.x,
          s.y,
          s.x - s.vx * (s.len / 10),
          s.y - s.vy * (s.len / 10),
        );
        grad.addColorStop(0, `rgba(255,255,255,${s.life})`);
        grad.addColorStop(1, "transparent");
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x - s.vx * (s.len / 10), s.y - s.vy * (s.len / 10));
        ctx.stroke();
        ctx.restore();
      }
      hcards.forEach((c) => {
        c.x += c.vx;
        c.y += c.vy;
        c.rot += c.rotV;
        c.pulse += c.pSpeed;
        if (c.x < -c.w) c.x = W + c.w;
        if (c.x > W + c.w) c.x = -c.w;
        if (c.y < -c.h) c.y = H + c.h;
        if (c.y > H + c.h) c.y = -c.h;
        const glow = 0.07 + Math.sin(c.pulse) * 0.04;
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.rot);
        ctx.globalAlpha = glow * 10;
        const ringG = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(c.w, c.h) * 0.7);
        ringG.addColorStop(0, c.color + "22");
        ringG.addColorStop(1, "transparent");
        ctx.fillStyle = ringG;
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(c.w, c.h) * 0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = glow * 8;
        ctx.beginPath();
        ctx.roundRect(-c.w / 2, -c.h / 2, c.w, c.h, 14);
        const cardG = ctx.createLinearGradient(-c.w / 2, -c.h / 2, c.w / 2, c.h / 2);
        cardG.addColorStop(0, c.color + "18");
        cardG.addColorStop(1, c.color + "08");
        ctx.fillStyle = cardG;
        ctx.fill();
        ctx.strokeStyle = c.color + "60";
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.globalAlpha = glow * 12;
        ctx.font = "bold 11px 'Inter', sans-serif";
        ctx.fillStyle = c.color;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${c.emoji}  ${c.label}`, 0, 0);
        ctx.restore();
      });
      const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.85);
      vig.addColorStop(0, "transparent");
      vig.addColorStop(1, "rgba(2,8,18,0.55)");
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, W, H);
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(shootTimer);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 size-full pointer-events-none"
      aria-hidden
      tabIndex={-1}
    />
  );
}
