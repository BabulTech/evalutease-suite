import { Twitter, Facebook, Linkedin, MessageCircle } from "lucide-react";
import type { ParticipantShareData, HostShareData } from "./types";
import { grade } from "./canvasUtils";

export function participantText(d: ParticipantShareData) {
  const medal = d.pct >= 90 ? "🥇" : d.pct >= 70 ? "🥈" : d.pct >= 50 ? "🥉" : "🎯";
  return [
    `${medal} Just completed a quiz on Jancho!`,
    ``,
    `📚 "${d.quizTitle}"`,
    `✅ Score: ${d.score}/${d.total} · ${d.pct}% accuracy`,
    `🎓 Grade: ${grade(d.pct)}`,
    ...(d.speedBonus && d.speedBonus > 0 ? [`⚡ Speed Bonus: +${d.speedBonus}`] : []),
    ``,
    `Think you can beat me? Try it on Jancho! 🚀`,
    `#Jancho #Quiz #Education`,
  ].join("\n");
}

export function hostText(d: HostShareData) {
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
    `Powered by Jancho 🚀 #Jancho #Quiz #Teaching`,
  ].join("\n");
}

export const PLATFORMS = [
  {
    id: "twitter",
    label: "X / Twitter",
    icon: Twitter,
    cls: "hover:bg-[#1DA1F2]/10 hover:border-[#1DA1F2]/50 hover:text-[#1DA1F2]",
    url: (t: string) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(t)}`,
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    icon: MessageCircle,
    cls: "hover:bg-[#25D366]/10 hover:border-[#25D366]/50 hover:text-[#25D366]",
    url: (t: string) => `https://wa.me/?text=${encodeURIComponent(t)}`,
  },
  {
    id: "facebook",
    label: "Facebook",
    icon: Facebook,
    cls: "hover:bg-[#1877F2]/10 hover:border-[#1877F2]/50 hover:text-[#1877F2]",
    url: (t: string) =>
      `https://www.facebook.com/sharer/sharer.php?quote=${encodeURIComponent(t)}&u=${encodeURIComponent(window.location.href)}`,
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    icon: Linkedin,
    cls: "hover:bg-[#0A66C2]/10 hover:border-[#0A66C2]/50 hover:text-[#0A66C2]",
    url: (t: string) =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}&summary=${encodeURIComponent(t)}`,
  },
];
