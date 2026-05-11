import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

const schema = z.object({
  email: z.string().trim().email("Invalid email").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(100),
});

function LoginPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    navigate({ to: "/dashboard" });
  };

  const onGoogle = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/dashboard" },
    });
    if (error) {
      setLoading(false);
      toast.error(error.message);
    }
    // browser redirects automatically on success
  };

  return (
    <AuthShell>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-4xl font-bold">{t("auth.title")}</h1>
          <p className="text-muted-foreground text-sm mt-2 max-w-sm">{t("auth.subtitle")}</p>
        </div>
        <Logo size="sm" />
      </div>

      <div className="grid grid-cols-2 gap-2 mb-6 p-1 bg-secondary/50 rounded-xl">
        <button className="rounded-lg py-2.5 text-sm font-semibold bg-primary text-primary-foreground shadow-glow">
          {t("auth.signin")}
        </button>
        <Link
          to="/signup"
          className="rounded-lg py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground text-center"
        >
          {t("auth.signup")}
        </Link>
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full h-12 mb-3 gap-3 bg-secondary/40 hover:bg-secondary border-border"
        onClick={onGoogle}
        disabled={loading}
      >
        <GoogleIcon />
        <span className="font-semibold">{t("auth.continueGoogle")}</span>
      </Button>

      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground tracking-widest">{t("auth.or")}</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <Label htmlFor="email" className="mb-1.5">{t("auth.email")}</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <Link to="/forgot-password" className="text-xs text-primary hover:underline">
              {t("auth.forgot")}
            </Link>
          </div>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </div>
        <Button type="submit" disabled={loading} className="w-full h-12 bg-gradient-primary text-primary-foreground font-semibold shadow-glow hover:opacity-90">
          {loading ? t("common.loading") : t("auth.login")}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground mt-6">
        {t("auth.noAccount")}{" "}
        <Link to="/signup" className="text-primary font-semibold hover:underline">
          {t("auth.signup")}
        </Link>
      </p>
    </AuthShell>
  );
}

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-[#050c14]">
      <QuizBackground />
      <header className="relative z-10 flex items-center justify-between px-6 py-5">
        <Logo />
        <LanguageSwitcher />
      </header>
      <div className="relative z-10 flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-card/60 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl" style={{ boxShadow: "0 0 60px rgba(34,197,94,0.08), 0 25px 50px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.07)" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── Animated quiz background ────────────────────────────────────────────────

function QuizBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf: number;
    let t = 0;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // ── Stars (deep galaxy layer) ──────────────────────────────────────────
    type Star = { x: number; y: number; r: number; twinkle: number; speed: number };
    const stars: Star[] = Array.from({ length: 200 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 1.5 + 0.2,
      twinkle: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.03 + 0.01,
    }));

    // ── Shooting stars ─────────────────────────────────────────────────────
    type Shoot = { x: number; y: number; vx: number; vy: number; len: number; alpha: number; life: number };
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

    // ── Orbs (large glowing spheres) ───────────────────────────────────────
    type Orb = { cx: number; cy: number; r: number; phase: number; speed: number; hue: number };
    const orbs: Orb[] = [
      { cx: 0.15, cy: 0.25, r: 220, phase: 0,    speed: 0.3,  hue: 140 },
      { cx: 0.85, cy: 0.65, r: 180, phase: 2.1,  speed: 0.25, hue: 160 },
      { cx: 0.5,  cy: 0.85, r: 150, phase: 4.2,  speed: 0.35, hue: 120 },
      { cx: 0.75, cy: 0.1,  r: 120, phase: 1.0,  speed: 0.2,  hue: 180 },
    ];

    // ── Neural network nodes ───────────────────────────────────────────────
    type Node = { x: number; y: number; vx: number; vy: number; r: number; pulse: number; hue: number };
    const nodes: Node[] = Array.from({ length: 60 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      r: Math.random() * 3 + 1,
      pulse: Math.random() * Math.PI * 2,
      hue: 120 + Math.random() * 60,
    }));

    // ── Floating holographic cards ─────────────────────────────────────────
    const CARDS = [
      { emoji: "🎯", label: "QUIZ",      color: "#22c55e" },
      { emoji: "🧠", label: "THINK",     color: "#4ade80" },
      { emoji: "⚡", label: "FAST",      color: "#86efac" },
      { emoji: "🏆", label: "WIN",       color: "#fbbf24" },
      { emoji: "🎓", label: "LEARN",     color: "#60a5fa" },
      { emoji: "💡", label: "IDEA",      color: "#a78bfa" },
      { emoji: "🔥", label: "HOT",       color: "#f97316" },
      { emoji: "✨", label: "SMART",     color: "#22d3ee" },
      { emoji: "🎮", label: "PLAY",      color: "#ec4899" },
      { emoji: "📚", label: "STUDY",     color: "#34d399" },
    ];
    type HCard = {
      x: number; y: number; vx: number; vy: number;
      w: number; h: number; rot: number; rotV: number;
      pulse: number; pSpeed: number;
      emoji: string; label: string; color: string;
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

    // ── Aurora waves ───────────────────────────────────────────────────────
    const drawAurora = () => {
      const W = canvas.width, H = canvas.height;
      for (let layer = 0; layer < 3; layer++) {
        const points: [number, number][] = [];
        const segments = 12;
        const baseY = H * (0.55 + layer * 0.12);
        for (let i = 0; i <= segments; i++) {
          const x = (i / segments) * W;
          const y = baseY
            + Math.sin(t * (0.4 + layer * 0.1) + i * 0.8) * (50 + layer * 20)
            + Math.cos(t * (0.2 + layer * 0.05) + i * 0.5) * 30;
          points.push([x, y]);
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

    // ── Main draw loop ─────────────────────────────────────────────────────
    const draw = () => {
      t += 0.008;
      const W = canvas.width, H = canvas.height;

      // Deep space background
      const bg = ctx.createLinearGradient(0, 0, W * 0.3, H);
      bg.addColorStop(0, "#020812");
      bg.addColorStop(0.5, "#040d1a");
      bg.addColorStop(1, "#060e14");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Orb glows
      orbs.forEach(o => {
        const ox = W * o.cx + Math.sin(t * o.speed + o.phase) * 60;
        const oy = H * o.cy + Math.cos(t * o.speed * 0.7 + o.phase) * 40;
        const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, o.r);
        g.addColorStop(0, `hsla(${o.hue},90%,55%,0.12)`);
        g.addColorStop(0.4, `hsla(${o.hue},80%,45%,0.06)`);
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(ox, oy, o.r, 0, Math.PI * 2); ctx.fill();
      });

      // Stars
      stars.forEach(s => {
        s.twinkle += s.speed;
        const alpha = 0.3 + Math.sin(s.twinkle) * 0.5;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200,230,255,${alpha})`;
        ctx.fill();
      });

      // Aurora
      drawAurora();

      // Hex grid (perspective tilt)
      ctx.save();
      ctx.strokeStyle = "rgba(34,197,94,0.035)";
      ctx.lineWidth = 0.8;
      const hex = 55;
      const rows = Math.ceil(H / (hex * 0.866)) + 2;
      const cols = Math.ceil(W / hex) + 2;
      for (let row = -1; row < rows; row++) {
        for (let col = -1; col < cols; col++) {
          const cx = col * hex + (row % 2) * (hex / 2) + (t * 8) % hex;
          const cy = row * hex * 0.866;
          ctx.beginPath();
          for (let k = 0; k < 6; k++) {
            const angle = (k * 60 - 30) * (Math.PI / 180);
            const hx = cx + (hex * 0.48) * Math.cos(angle);
            const hy = cy + (hex * 0.48) * Math.sin(angle);
            k === 0 ? ctx.moveTo(hx, hy) : ctx.lineTo(hx, hy);
          }
          ctx.closePath();
          ctx.stroke();
        }
      }
      ctx.restore();

      // Neural network connections
      nodes.forEach(n => {
        n.x += n.vx; n.y += n.vy; n.pulse += 0.03;
        if (n.x < 0) n.x = W; if (n.x > W) n.x = 0;
        if (n.y < 0) n.y = H; if (n.y > H) n.y = 0;
      });
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 110) {
            const a = 0.15 * (1 - d / 110);
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = `hsla(${nodes[i].hue},80%,60%,${a})`;
            ctx.lineWidth = 0.7;
            ctx.stroke();
          }
        }
      }
      nodes.forEach(n => {
        const glow = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 4);
        const a = 0.6 + Math.sin(n.pulse) * 0.4;
        glow.addColorStop(0, `hsla(${n.hue},90%,70%,${a})`);
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r * 4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${n.hue},100%,90%,${a})`;
        ctx.fill();
      });

      // Shooting stars
      for (let i = shoots.length - 1; i >= 0; i--) {
        const s = shoots[i];
        s.x += s.vx; s.y += s.vy; s.life -= 0.015;
        if (s.life <= 0) { shoots.splice(i, 1); continue; }
        const a = s.life;
        ctx.save();
        const grad = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * (s.len / 10), s.y - s.vy * (s.len / 10));
        grad.addColorStop(0, `rgba(255,255,255,${a})`);
        grad.addColorStop(1, "transparent");
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x - s.vx * (s.len / 10), s.y - s.vy * (s.len / 10));
        ctx.stroke();
        // Head glow
        const hg = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 6);
        hg.addColorStop(0, `rgba(255,255,255,${a})`);
        hg.addColorStop(1, "transparent");
        ctx.fillStyle = hg;
        ctx.beginPath(); ctx.arc(s.x, s.y, 6, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }

      // Holographic floating cards
      hcards.forEach(c => {
        c.x += c.vx; c.y += c.vy; c.rot += c.rotV; c.pulse += c.pSpeed;
        if (c.x < -c.w) c.x = W + c.w; if (c.x > W + c.w) c.x = -c.w;
        if (c.y < -c.h) c.y = H + c.h; if (c.y > H + c.h) c.y = -c.h;

        const glow = 0.07 + Math.sin(c.pulse) * 0.04;
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.rot);
        ctx.globalAlpha = glow * 10; // Amplify alpha for visible effect

        // Outer glow ring
        const ringR = Math.max(c.w, c.h) * 0.7;
        const ringG = ctx.createRadialGradient(0, 0, 0, 0, 0, ringR);
        ringG.addColorStop(0, c.color + "22");
        ringG.addColorStop(1, "transparent");
        ctx.fillStyle = ringG;
        ctx.beginPath(); ctx.arc(0, 0, ringR, 0, Math.PI * 2); ctx.fill();

        ctx.globalAlpha = glow * 8;

        // Card glassmorphism body
        ctx.beginPath();
        ctx.roundRect(-c.w / 2, -c.h / 2, c.w, c.h, 14);
        const cardG = ctx.createLinearGradient(-c.w / 2, -c.h / 2, c.w / 2, c.h / 2);
        cardG.addColorStop(0, c.color + "18");
        cardG.addColorStop(1, c.color + "08");
        ctx.fillStyle = cardG;
        ctx.fill();

        // Neon border
        ctx.strokeStyle = c.color + "60";
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Shine strip
        ctx.beginPath();
        ctx.roundRect(-c.w / 2 + 4, -c.h / 2 + 4, c.w - 8, 10, 6);
        ctx.fillStyle = "rgba(255,255,255,0.06)";
        ctx.fill();

        // Text
        ctx.globalAlpha = glow * 12;
        ctx.font = "bold 11px 'Inter', sans-serif";
        ctx.fillStyle = c.color;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.letterSpacing = "2px";
        ctx.fillText(`${c.emoji}  ${c.label}`, 0, 0);
        ctx.restore();
      });

      // Vignette overlay
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
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden
    />
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.49h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.63z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.83.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.32A9 9 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3.01-2.32z"/>
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 9 0 9 9 0 0 0 .96 4.96L3.97 7.28C4.68 5.16 6.66 3.58 9 3.58z"/>
    </svg>
  );
}
