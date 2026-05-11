import { useEffect, useRef, useState } from "react";
import {
  Share2, Download, Link2, Check,
  Twitter, Facebook, Linkedin, MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ParticipantShareData = {
  mode: "participant";
  quizTitle: string;
  score: number;
  total: number;
  pct: number;
  speedBonus?: number;
  participantName?: string;
};

export type HostShareData = {
  mode: "host";
  quizTitle: string;
  totalParticipants: number;
  submitted: number;
  avgPct: number;
  bestPct: number;
  passRate: number;
  topScorer?: string;
};

type Props = ParticipantShareData | HostShareData;

// ─── Canvas helpers ───────────────────────────────────────────────────────────

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function scoreColor(pct: number) {
  return pct >= 80 ? "#34d399" : pct >= 60 ? "#fbbf24" : "#f87171";
}

function grade(pct: number) {
  if (pct >= 90) return "A+";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B";
  if (pct >= 60) return "C";
  if (pct >= 50) return "D";
  return "F";
}

// ─── Participant card ─────────────────────────────────────────────────────────

function drawParticipant(canvas: HTMLCanvasElement, d: ParticipantShareData) {
  const W = 1200, H = 630;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // BG
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0f0f1a");
  bg.addColorStop(0.5, "#1a0a2e");
  bg.addColorStop(1, "#0d1b2a");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  // Glow orbs
  [{ x: 200, y: 200, r: 400, c: "rgba(139,92,246,0.22)" },
   { x: 980, y: 460, r: 340, c: "rgba(59,130,246,0.18)" }].forEach(({ x, y, r, c }) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, c); g.addColorStop(1, "transparent");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  });

  // Border
  ctx.strokeStyle = "rgba(139,92,246,0.55)";
  ctx.lineWidth = 3;
  roundRect(ctx, 18, 18, W - 36, H - 36, 32); ctx.stroke();

  // Medal + label
  const medal = d.pct >= 90 ? "🥇" : d.pct >= 70 ? "🥈" : d.pct >= 50 ? "🥉" : "🎯";
  ctx.font = "72px serif"; ctx.fillText(medal, 76, 148);

  ctx.font = "bold 24px sans-serif";
  ctx.fillStyle = "rgba(167,139,250,0.9)";
  ctx.fillText("QUIZ COMPLETED  ·  EVALUTEASE", 76, 202);

  // Title
  ctx.font = "bold 54px sans-serif"; ctx.fillStyle = "#fff";
  ctx.fillText(d.quizTitle.length > 38 ? d.quizTitle.slice(0, 36) + "…" : d.quizTitle, 76, 276);

  // Name
  if (d.participantName) {
    ctx.font = "26px sans-serif"; ctx.fillStyle = "rgba(200,200,220,0.75)";
    ctx.fillText(`Scored by ${d.participantName}`, 76, 326);
  }

  // Big score panel
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  roundRect(ctx, 680, 75, 452, 215, 24); ctx.fill();
  ctx.strokeStyle = "rgba(139,92,246,0.38)"; ctx.lineWidth = 1.5; ctx.stroke();

  ctx.font = "bold 108px sans-serif"; ctx.fillStyle = scoreColor(d.pct);
  ctx.textAlign = "center";
  ctx.fillText(String(d.score), 906, 195);
  ctx.font = "bold 30px sans-serif"; ctx.fillStyle = "rgba(200,200,220,0.65)";
  ctx.fillText(`out of ${d.total}`, 906, 258);
  ctx.textAlign = "left";

  // Stat boxes
  const stats = [
    { label: "ACCURACY", value: `${d.pct}%`, color: scoreColor(d.pct) },
    { label: "GRADE", value: grade(d.pct), color: scoreColor(d.pct) },
    { label: "CORRECT", value: `${d.score}/${d.total}`, color: "#60a5fa" },
    ...(d.speedBonus && d.speedBonus > 0
      ? [{ label: "SPEED BONUS", value: `+${d.speedBonus}`, color: "#fbbf24" }]
      : [{ label: "MISSED", value: String(d.total - d.score), color: "#f87171" }]),
  ];

  const bY = 388, bW = (W - 152) / stats.length;
  stats.forEach((s, i) => {
    const bX = 76 + i * (bW + 12);
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    roundRect(ctx, bX, bY, bW, 148, 18); ctx.fill();
    ctx.strokeStyle = `${s.color}33`; ctx.lineWidth = 1.5; ctx.stroke();

    ctx.font = "bold 44px sans-serif"; ctx.fillStyle = s.color;
    ctx.textAlign = "center";
    ctx.fillText(s.value, bX + bW / 2, bY + 80);
    ctx.font = "15px sans-serif"; ctx.fillStyle = "rgba(180,180,200,0.65)";
    ctx.fillText(s.label, bX + bW / 2, bY + 118);
    ctx.textAlign = "left";
  });

  // Branding
  ctx.font = "bold 20px sans-serif"; ctx.fillStyle = "rgba(139,92,246,0.8)";
  ctx.textAlign = "right";
  ctx.fillText("EvaluTease", W - 54, H - 46);
  ctx.font = "15px sans-serif"; ctx.fillStyle = "rgba(140,140,170,0.55)";
  ctx.fillText("Share your knowledge", W - 54, H - 26);
  ctx.textAlign = "left";
}

// ─── Host card ────────────────────────────────────────────────────────────────

function drawHost(canvas: HTMLCanvasElement, d: HostShareData) {
  const W = 1200, H = 630;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // BG
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#051020"); bg.addColorStop(0.6, "#0f2040"); bg.addColorStop(1, "#051020");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  [{ x: 180, y: 320, r: 500, c: "rgba(59,130,246,0.18)" },
   { x: W - 180, y: 140, r: 380, c: "rgba(34,197,94,0.13)" }].forEach(({ x, y, r, c }) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, c); g.addColorStop(1, "transparent");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  });

  ctx.strokeStyle = "rgba(59,130,246,0.55)"; ctx.lineWidth = 3;
  roundRect(ctx, 18, 18, W - 36, H - 36, 32); ctx.stroke();

  // Badge
  ctx.font = "bold 22px sans-serif"; ctx.fillStyle = "rgba(96,165,250,0.9)";
  ctx.fillText("📊  SESSION RESULTS  ·  EVALUTEASE", 76, 96);

  // Title
  ctx.font = "bold 56px sans-serif"; ctx.fillStyle = "#fff";
  ctx.fillText(d.quizTitle.length > 36 ? d.quizTitle.slice(0, 34) + "…" : d.quizTitle, 76, 174);

  // Divider line
  const dg = ctx.createLinearGradient(76, 0, 900, 0);
  dg.addColorStop(0, "rgba(59,130,246,0.8)"); dg.addColorStop(1, "transparent");
  ctx.strokeStyle = dg; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(76, 200); ctx.lineTo(900, 200); ctx.stroke();

  // Top scorer
  if (d.topScorer) {
    ctx.font = "24px sans-serif"; ctx.fillStyle = "rgba(251,191,36,0.92)";
    ctx.fillText(`🏆  Top Scorer: ${d.topScorer}`, 76, 244);
  }

  // 4 stat boxes
  const boxes = [
    { label: "PARTICIPANTS", value: String(d.totalParticipants), icon: "👥", color: "#60a5fa" },
    { label: "SUBMISSIONS", value: String(d.submitted), icon: "✅", color: "#34d399" },
    { label: "AVG SCORE", value: `${d.avgPct}%`, icon: "📈", color: scoreColor(d.avgPct) },
    { label: "PASS RATE", value: `${d.passRate}%`, icon: "🎯", color: d.passRate >= 70 ? "#34d399" : d.passRate >= 40 ? "#fbbf24" : "#f87171" },
  ];

  const bY = d.topScorer ? 272 : 240;
  const bW = (W - 152 - 36) / 4;
  boxes.forEach((b, i) => {
    const bX = 76 + i * (bW + 12);
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    roundRect(ctx, bX, bY, bW, 190, 20); ctx.fill();
    ctx.strokeStyle = `${b.color}40`; ctx.lineWidth = 1.5; ctx.stroke();

    ctx.font = "34px serif"; ctx.textAlign = "center";
    ctx.fillText(b.icon, bX + bW / 2, bY + 48);
    ctx.font = "bold 48px sans-serif"; ctx.fillStyle = b.color;
    ctx.fillText(b.value, bX + bW / 2, bY + 118);
    ctx.font = "15px sans-serif"; ctx.fillStyle = "rgba(180,180,200,0.65)";
    ctx.fillText(b.label, bX + bW / 2, bY + 152);
    ctx.textAlign = "left";
  });

  // Best score progress bar
  const barY = bY + 208;
  ctx.font = "20px sans-serif"; ctx.fillStyle = "rgba(180,180,200,0.7)";
  ctx.fillText(`Best score: ${d.bestPct}%`, 76, barY);

  ctx.fillStyle = "rgba(255,255,255,0.06)";
  roundRect(ctx, 76, barY + 10, W - 152, 16, 8); ctx.fill();

  const barFill = ctx.createLinearGradient(76, 0, 76 + (W - 152) * (d.bestPct / 100), 0);
  barFill.addColorStop(0, "#3b82f6"); barFill.addColorStop(1, "#8b5cf6");
  ctx.fillStyle = barFill;
  roundRect(ctx, 76, barY + 10, Math.max(20, (W - 152) * (d.bestPct / 100)), 16, 8); ctx.fill();

  // Branding
  ctx.font = "bold 20px sans-serif"; ctx.fillStyle = "rgba(59,130,246,0.8)";
  ctx.textAlign = "right";
  ctx.fillText("EvaluTease", W - 54, H - 46);
  ctx.font = "15px sans-serif"; ctx.fillStyle = "rgba(140,140,170,0.55)";
  ctx.fillText("Smarter quizzing for everyone", W - 54, H - 26);
  ctx.textAlign = "left";
}

// ─── Share text ───────────────────────────────────────────────────────────────

function participantText(d: ParticipantShareData) {
  const medal = d.pct >= 90 ? "🥇" : d.pct >= 70 ? "🥈" : d.pct >= 50 ? "🥉" : "🎯";
  return [
    `${medal} Just completed a quiz on EvaluTease!`,
    ``,
    `📚 "${d.quizTitle}"`,
    `✅ Score: ${d.score}/${d.total} · ${d.pct}% accuracy`,
    `🎓 Grade: ${grade(d.pct)}`,
    ...(d.speedBonus && d.speedBonus > 0 ? [`⚡ Speed Bonus: +${d.speedBonus}`] : []),
    ``,
    `Think you can beat me? Try it on EvaluTease! 🚀`,
    `#EvaluTease #Quiz #Education`,
  ].join("\n");
}

function hostText(d: HostShareData) {
  return [
    `📊 Quiz results are in!`,
    ``,
    `📚 "${d.quizTitle}"`,
    `👥 Participants: ${d.totalParticipants}  ·  ✅ Submitted: ${d.submitted}`,
    `📈 Average Score: ${d.avgPct}%`,
    `🏅 Best Score: ${d.bestPct}%`,
    `🎯 Pass Rate: ${d.passRate}%`,
    ...(d.topScorer ? [`🏆 Top Scorer: ${d.topScorer}`] : []),
    ``,
    `Powered by EvaluTease 🚀 #EvaluTease #Quiz #Teaching`,
  ].join("\n");
}

// ─── Platforms ────────────────────────────────────────────────────────────────

const PLATFORMS = [
  {
    id: "twitter", label: "X / Twitter", icon: Twitter,
    cls: "hover:bg-[#1DA1F2]/10 hover:border-[#1DA1F2]/50 hover:text-[#1DA1F2]",
    url: (t: string) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(t)}`,
  },
  {
    id: "whatsapp", label: "WhatsApp", icon: MessageCircle,
    cls: "hover:bg-[#25D366]/10 hover:border-[#25D366]/50 hover:text-[#25D366]",
    url: (t: string) => `https://wa.me/?text=${encodeURIComponent(t)}`,
  },
  {
    id: "facebook", label: "Facebook", icon: Facebook,
    cls: "hover:bg-[#1877F2]/10 hover:border-[#1877F2]/50 hover:text-[#1877F2]",
    url: (t: string) => `https://www.facebook.com/sharer/sharer.php?quote=${encodeURIComponent(t)}&u=${encodeURIComponent(window.location.href)}`,
  },
  {
    id: "linkedin", label: "LinkedIn", icon: Linkedin,
    cls: "hover:bg-[#0A66C2]/10 hover:border-[#0A66C2]/50 hover:text-[#0A66C2]",
    url: (t: string) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}&summary=${encodeURIComponent(t)}`,
  },
];

// ─── Main component ───────────────────────────────────────────────────────────

export function ShareResultCard(props: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const text = props.mode === "participant" ? participantText(props) : hostText(props);

  // Draw canvas whenever panel opens
  useEffect(() => {
    if (!open || !canvasRef.current) return;
    if (props.mode === "participant") drawParticipant(canvasRef.current, props);
    else drawHost(canvasRef.current, props);
  }, [open, props]);

  const getDataUrl = () => {
    const c = canvasRef.current!;
    if (props.mode === "participant") drawParticipant(c, props);
    else drawHost(c, props);
    return c.toDataURL("image/png");
  };

  const download = () => {
    setBusy(true);
    setTimeout(() => {
      try {
        const a = document.createElement("a");
        a.href = getDataUrl();
        a.download = `result-${Date.now()}.png`;
        a.click();
        toast.success("Image saved! Attach it when you post.");
      } catch {
        toast.error("Could not generate image");
      }
      setBusy(false);
    }, 50);
  };

  const nativeShare = async () => {
    setBusy(true);
    try {
      const blob = await (await fetch(getDataUrl())).blob();
      const file = new File([blob], "result.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Quiz Result", text });
      } else {
        await navigator.share({ title: "Quiz Result", text, url: window.location.href });
      }
    } catch { /* cancelled */ }
    setBusy(false);
  };

  const copyText = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Post text copied!");
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="rounded-2xl border border-border bg-card/40 overflow-hidden">
      {/* Toggle header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full px-5 py-4 cursor-pointer hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="rounded-xl bg-primary/15 p-1.5">
            <Share2 className="h-4 w-4 text-primary" />
          </div>
          <span className="font-semibold text-sm">Share Result</span>
          <span className="text-xs text-muted-foreground hidden sm:inline">- let everyone know!</span>
        </div>
        <span className="text-muted-foreground text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4 border-t border-border pt-4">
          {/* Canvas preview */}
          <div>
            <p className="text-xs text-muted-foreground mb-2 font-medium">Share image preview</p>
            <div className="rounded-xl overflow-hidden border border-border">
              <canvas ref={canvasRef} className="w-full block" />
            </div>
          </div>

          {/* Post text */}
          <div className="rounded-xl border border-border bg-muted/10 px-4 py-3">
            <p className="text-xs text-muted-foreground mb-1.5 font-medium">Post caption</p>
            <pre className="text-xs text-foreground whitespace-pre-wrap font-sans leading-relaxed">{text}</pre>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 flex-wrap items-center">
            <Button size="sm" onClick={download} disabled={busy}
              className="gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow cursor-pointer">
              <Download className="h-3.5 w-3.5" />
              {busy ? "Generating…" : "Download Image"}
            </Button>
            {"share" in navigator && (
              <Button size="sm" variant="outline" onClick={() => void nativeShare()} disabled={busy} className="gap-1.5 cursor-pointer">
                <Share2 className="h-3.5 w-3.5" /> Share via…
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => void copyText()} className="gap-1.5 ml-auto cursor-pointer">
              {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Link2 className="h-3.5 w-3.5" />}
              {copied ? "Copied!" : "Copy caption"}
            </Button>
          </div>

          {/* Platform buttons */}
          <div>
            <p className="text-xs text-muted-foreground mb-2 font-medium">Post to platform</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PLATFORMS.map((p) => (
                <button key={p.id} type="button"
                  onClick={() => window.open(p.url(text), "_blank", "noopener,width=620,height=520")}
                  className={`flex items-center gap-2 rounded-xl border border-border bg-card/40 px-3 py-2.5 text-xs font-medium transition-all duration-200 cursor-pointer ${p.cls}`}
                >
                  <p.icon className="h-4 w-4 shrink-0" />{p.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              💡 Download the image first, then attach it to your post for the best visual result.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
