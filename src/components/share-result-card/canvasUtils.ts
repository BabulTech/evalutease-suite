import type { ParticipantShareData, HostShareData } from "./types";

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
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

export function scoreColor(pct: number) {
  return pct >= 80 ? "#34d399" : pct >= 60 ? "#fbbf24" : "#f87171";
}

export function grade(pct: number) {
  if (pct >= 90) return "A+";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B";
  if (pct >= 60) return "C";
  if (pct >= 50) return "D";
  return "F";
}

export function drawParticipant(canvas: HTMLCanvasElement, d: ParticipantShareData) {
  const W = 1200,
    H = 630;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0f0f1a");
  bg.addColorStop(0.5, "#1a0a2e");
  bg.addColorStop(1, "#0d1b2a");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  [
    { x: 200, y: 200, r: 400, c: "rgba(139,92,246,0.22)" },
    { x: 980, y: 460, r: 340, c: "rgba(59,130,246,0.18)" },
  ].forEach(({ x, y, r, c }) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, c);
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  });

  ctx.strokeStyle = "rgba(139,92,246,0.55)";
  ctx.lineWidth = 3;
  roundRect(ctx, 18, 18, W - 36, H - 36, 32);
  ctx.stroke();

  const medal = d.pct >= 90 ? "🥇" : d.pct >= 70 ? "🥈" : d.pct >= 50 ? "🥉" : "🎯";
  ctx.font = "72px serif";
  ctx.fillText(medal, 76, 148);

  ctx.font = "bold 24px sans-serif";
  ctx.fillStyle = "rgba(167,139,250,0.9)";
  ctx.fillText("QUIZ COMPLETED  ·  EVALUTEASE", 76, 202);

  ctx.font = "bold 54px sans-serif";
  ctx.fillStyle = "#fff";
  ctx.fillText(d.quizTitle.length > 38 ? d.quizTitle.slice(0, 36) + "…" : d.quizTitle, 76, 276);

  if (d.participantName) {
    ctx.font = "26px sans-serif";
    ctx.fillStyle = "rgba(200,200,220,0.75)";
    ctx.fillText(`Scored by ${d.participantName}`, 76, 326);
  }

  ctx.fillStyle = "rgba(255,255,255,0.04)";
  roundRect(ctx, 680, 75, 452, 215, 24);
  ctx.fill();
  ctx.strokeStyle = "rgba(139,92,246,0.38)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.font = "bold 108px sans-serif";
  ctx.fillStyle = scoreColor(d.pct);
  ctx.textAlign = "center";
  ctx.fillText(String(d.score), 906, 195);
  ctx.font = "bold 30px sans-serif";
  ctx.fillStyle = "rgba(200,200,220,0.65)";
  ctx.fillText(`out of ${d.total}`, 906, 258);
  ctx.textAlign = "left";

  const stats = [
    { label: "ACCURACY", value: `${d.pct}%`, color: scoreColor(d.pct) },
    { label: "GRADE", value: grade(d.pct), color: scoreColor(d.pct) },
    { label: "CORRECT", value: `${d.score}/${d.total}`, color: "#60a5fa" },
    ...(d.speedBonus && d.speedBonus > 0
      ? [{ label: "SPEED BONUS", value: `+${d.speedBonus}`, color: "#fbbf24" }]
      : [{ label: "MISSED", value: String(d.total - d.score), color: "#f87171" }]),
  ];

  const bY = 388,
    bW = (W - 152) / stats.length;
  stats.forEach((s, i) => {
    const bX = 76 + i * (bW + 12);
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    roundRect(ctx, bX, bY, bW, 148, 18);
    ctx.fill();
    ctx.strokeStyle = `${s.color}33`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = "bold 44px sans-serif";
    ctx.fillStyle = s.color;
    ctx.textAlign = "center";
    ctx.fillText(s.value, bX + bW / 2, bY + 80);
    ctx.font = "15px sans-serif";
    ctx.fillStyle = "rgba(180,180,200,0.65)";
    ctx.fillText(s.label, bX + bW / 2, bY + 118);
    ctx.textAlign = "left";
  });

  ctx.font = "bold 20px sans-serif";
  ctx.fillStyle = "rgba(139,92,246,0.8)";
  ctx.textAlign = "right";
  ctx.fillText("Jancho", W - 54, H - 46);
  ctx.font = "15px sans-serif";
  ctx.fillStyle = "rgba(140,140,170,0.55)";
  ctx.fillText("Share your knowledge", W - 54, H - 26);
  ctx.textAlign = "left";
}

export function drawHost(canvas: HTMLCanvasElement, d: HostShareData) {
  const W = 1200,
    H = 630;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#051020");
  bg.addColorStop(0.6, "#0f2040");
  bg.addColorStop(1, "#051020");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  [
    { x: 180, y: 320, r: 500, c: "rgba(59,130,246,0.18)" },
    { x: W - 180, y: 140, r: 380, c: "rgba(34,197,94,0.13)" },
  ].forEach(({ x, y, r, c }) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, c);
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  });

  ctx.strokeStyle = "rgba(59,130,246,0.55)";
  ctx.lineWidth = 3;
  roundRect(ctx, 18, 18, W - 36, H - 36, 32);
  ctx.stroke();

  ctx.font = "bold 22px sans-serif";
  ctx.fillStyle = "rgba(96,165,250,0.9)";
  ctx.fillText("📊  SESSION RESULTS  ·  EVALUTEASE", 76, 96);

  ctx.font = "bold 56px sans-serif";
  ctx.fillStyle = "#fff";
  ctx.fillText(d.quizTitle.length > 36 ? d.quizTitle.slice(0, 34) + "…" : d.quizTitle, 76, 174);

  const dg = ctx.createLinearGradient(76, 0, 900, 0);
  dg.addColorStop(0, "rgba(59,130,246,0.8)");
  dg.addColorStop(1, "transparent");
  ctx.strokeStyle = dg;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(76, 200);
  ctx.lineTo(900, 200);
  ctx.stroke();

  if (d.topScorer) {
    ctx.font = "24px sans-serif";
    ctx.fillStyle = "rgba(251,191,36,0.92)";
    ctx.fillText(`🏆  Top Scorer: ${d.topScorer}`, 76, 244);
  }

  const boxes = [
    { label: "PARTICIPANTS", value: String(d.totalParticipants), icon: "👥", color: "#60a5fa" },
    { label: "SUBMISSIONS", value: String(d.submitted), icon: "✅", color: "#34d399" },
    { label: "AVG SCORE", value: `${d.avgPct}%`, icon: "📈", color: scoreColor(d.avgPct) },
    {
      label: "PASS RATE",
      value: `${d.passRate}%`,
      icon: "🎯",
      color: d.passRate >= 70 ? "#34d399" : d.passRate >= 40 ? "#fbbf24" : "#f87171",
    },
  ];

  const bY = d.topScorer ? 272 : 240;
  const bW = (W - 152 - 36) / 4;
  boxes.forEach((b, i) => {
    const bX = 76 + i * (bW + 12);
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    roundRect(ctx, bX, bY, bW, 190, 20);
    ctx.fill();
    ctx.strokeStyle = `${b.color}40`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = "34px serif";
    ctx.textAlign = "center";
    ctx.fillText(b.icon, bX + bW / 2, bY + 48);
    ctx.font = "bold 48px sans-serif";
    ctx.fillStyle = b.color;
    ctx.fillText(b.value, bX + bW / 2, bY + 118);
    ctx.font = "15px sans-serif";
    ctx.fillStyle = "rgba(180,180,200,0.65)";
    ctx.fillText(b.label, bX + bW / 2, bY + 152);
    ctx.textAlign = "left";
  });

  const barY = bY + 208;
  ctx.font = "20px sans-serif";
  ctx.fillStyle = "rgba(180,180,200,0.7)";
  ctx.fillText(`Best score: ${d.bestPct}%`, 76, barY);

  ctx.fillStyle = "rgba(255,255,255,0.06)";
  roundRect(ctx, 76, barY + 10, W - 152, 16, 8);
  ctx.fill();

  const barFill = ctx.createLinearGradient(76, 0, 76 + (W - 152) * (d.bestPct / 100), 0);
  barFill.addColorStop(0, "#3b82f6");
  barFill.addColorStop(1, "#8b5cf6");
  ctx.fillStyle = barFill;
  roundRect(ctx, 76, barY + 10, Math.max(20, (W - 152) * (d.bestPct / 100)), 16, 8);
  ctx.fill();

  ctx.font = "bold 20px sans-serif";
  ctx.fillStyle = "rgba(59,130,246,0.8)";
  ctx.textAlign = "right";
  ctx.fillText("Jancho", W - 54, H - 46);
  ctx.font = "15px sans-serif";
  ctx.fillStyle = "rgba(140,140,170,0.55)";
  ctx.fillText("Smarter quizzing for everyone", W - 54, H - 26);
  ctx.textAlign = "left";
}
