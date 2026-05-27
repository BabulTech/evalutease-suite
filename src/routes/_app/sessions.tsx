import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { PlayCircle, QrCode, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SessionCard } from "@/components/sessions/SessionCard";
import { useI18n } from "@/lib/i18n";
import { useSessions } from "./sessions/useSessions";

// react-doctor-disable-next-line react-doctor/only-export-components
export const Route = createFileRoute("/_app/sessions")({
  component: SessionsPage,
});

// react-doctor-disable-next-line react-doctor/only-export-components
function SessionsPage() {
  const { t } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const onIndex = pathname === "/sessions" || pathname === "/sessions/";
  const { sessions, loading, hasMore, activeSessions, scheduledSessions, loadMore, remove } =
    useSessions(onIndex);

  if (!onIndex) return <Outlet />;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card/60 p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-12 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center text-primary shadow-glow shrink-0">
            <QrCode className="size-6" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-xl sm:text-2xl font-semibold tracking-tight">
              {t("nav.sessions")}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">{t("sess.description")}</p>
          </div>
        </div>
        <Button
          asChild
          className="h-10 gap-2 bg-gradient-primary text-primary-foreground shadow-glow shrink-0"
        >
          <Link to="/sessions/new">
            <Zap className="size-4" /> {t("sess.generateQR")}
          </Link>
        </Button>
      </div>

      {sessions.length > 0 && (
        <div className="grid grid-cols-1 min-[380px]:grid-cols-3 gap-2.5 sm:gap-3">
          {[
            { label: "Active", value: activeSessions.length, color: "text-success" },
            { label: "Scheduled", value: scheduledSessions.length, color: "text-primary" },
            { label: "Total", value: sessions.length, color: "text-foreground" },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="rounded-2xl border border-border bg-card/50 p-4 text-center"
            >
              <div className={`font-display text-2xl font-bold ${color}`}>{value}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
                {label}
              </div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-border bg-card/40 p-6 text-sm text-muted-foreground animate-pulse">
          {t("sess.loading")}
        </div>
      ) : sessions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/30 p-12 text-center space-y-3">
          <PlayCircle className="mx-auto size-10 text-muted-foreground/40" />
          <div>
            <p className="text-sm font-semibold">{t("sess.empty")}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("sess.emptyHint")}</p>
          </div>
          <Button
            asChild
            size="sm"
            className="gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow"
          >
            <Link to="/sessions/new">
              <Zap size={14} /> Generate first quiz
            </Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            {sessions.map((s) => (
              <SessionCard
                key={s.id}
                session={s}
                onDelete={(id) => remove(id, t("sess.deleteActive"), t("sess.deleted"))}
              />
            ))}
          </div>
          {hasMore && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={loadMore}>
                {t("sess.loadMore")}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
