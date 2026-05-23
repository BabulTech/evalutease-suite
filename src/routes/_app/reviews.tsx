import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { BarChart3, MessageSquare, Send, Star, Users } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useReviewsData } from "./reviews/useReviewsData";
import { FeedbackTab } from "./reviews/FeedbackTab";
import { PerformanceTab } from "./reviews/PerformanceTab";
import { AppReviewTab } from "./reviews/AppReviewTab";

// react-doctor-disable-next-line react-doctor/only-export-components
export const Route = createFileRoute("/_app/reviews")({
  component: ReviewsPage,
});

// react-doctor-disable-next-line react-doctor/only-export-components
function ReviewsPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const { feedbacks, sessionStats, loading } = useReviewsData(user);
  const [activeTab, setActiveTab] = useState<"feedback" | "performance" | "appreview">("feedback");

  const totalReviews = feedbacks.length;
  const avgRating =
    totalReviews > 0
      ? (feedbacks.reduce((acc, f) => acc + f.rating, 0) / totalReviews).toFixed(1)
      : null;
  const quizzesWithFeedback = new Set(feedbacks.map((f) => f.session_id)).size;

  return (
    <div className="space-y-4">
      {/* Hero header */}
      <div className="rounded-2xl border border-border bg-card/60 p-5 flex flex-wrap items-center gap-4">
        <div className="size-12 rounded-2xl bg-warning/15 border border-warning/25 flex items-center justify-center text-warning shadow-glow shrink-0">
          <Star className="size-6" />
        </div>
        <div className="min-w-0">
          <h1 className="font-display text-xl sm:text-2xl font-semibold tracking-tight">
            {t("rev.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("rev.desc")}</p>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-border bg-card/50 p-4 text-center">
          <div className="font-display text-2xl font-bold text-foreground">{totalReviews}</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1 flex items-center justify-center gap-1">
            <MessageSquare className="size-3" /> {t("rev.totalReviews")}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card/50 p-4 text-center">
          <div className="font-display text-2xl font-bold text-warning">
            {avgRating ?? "-"}
            {avgRating && <span className="text-base font-normal text-muted-foreground">/5</span>}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1 flex items-center justify-center gap-1">
            <Star className="size-3 text-warning" /> {t("rev.avgRating")}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card/50 p-4 text-center">
          <div className="font-display text-2xl font-bold text-primary">{quizzesWithFeedback}</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1 flex items-center justify-center gap-1">
            <Users className="size-3" /> {t("rev.quizzesReviewed")}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted/40 w-fit flex-wrap">
        {(
          [
            { key: "feedback", labelKey: "rev.tabFeedback", icon: MessageSquare },
            { key: "performance", labelKey: "rev.tabPerformance", icon: BarChart3 },
            { key: "appreview", labelKey: "rev.tabAppReview", icon: Send },
          ] as const
        ).map(({ key, labelKey, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all min-h-[36px] ${
              activeTab === key
                ? "bg-card shadow text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="size-3.5" /> {t(labelKey)}
          </button>
        ))}
      </div>

      {loading && activeTab !== "appreview" ? (
        <div className="rounded-2xl border border-border bg-card/40 p-6 text-sm text-muted-foreground animate-pulse">
          {t("common.loading")}
        </div>
      ) : activeTab === "feedback" ? (
        <FeedbackTab feedbacks={feedbacks} />
      ) : activeTab === "performance" ? (
        <PerformanceTab stats={sessionStats} />
      ) : (
        user && <AppReviewTab userId={user.id} />
      )}
    </div>
  );
}
