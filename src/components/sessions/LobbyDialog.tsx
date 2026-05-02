import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { ArrowLeft, Copy, PlayCircle, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatTimePerQuestion, type Session } from "./types";

type Props = {
  session: Session;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStart: (id: string) => Promise<void>;
};

type LobbyAttendee = {
  id: string;
  name: string;
  email: string | null;
  completed: boolean;
};

export function LobbyDialog({ session, open, onOpenChange, onStart }: Props) {
  const [attendees, setAttendees] = useState<LobbyAttendee[]>([]);
  const [starting, setStarting] = useState(false);

  const joinUrl = useMemo(() => {
    if (!session.access_code) return "";
    if (typeof window === "undefined") return `/q/${session.access_code}`;
    return `${window.location.origin}/q/${session.access_code}`;
  }, [session.access_code]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const refresh = async () => {
      const { data, error } = await supabase
        .from("quiz_attempts")
        .select("id, participant_name, participant_email, completed")
        .eq("session_id", session.id)
        .order("started_at", { ascending: true });
      if (cancelled || error) return;
      setAttendees(
        (data ?? []).map((a) => ({
          id: a.id,
          name: a.participant_name ?? "Anonymous",
          email: a.participant_email,
          completed: a.completed,
        })),
      );
    };
    void refresh();
    const channel = supabase
      .channel(`lobby-${session.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "quiz_attempts",
          filter: `session_id=eq.${session.id}`,
        },
        () => {
          void refresh();
        },
      )
      .subscribe();
    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [open, session.id]);

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error(`Could not copy ${label}`);
    }
  };

  const start = async () => {
    setStarting(true);
    try {
      await onStart(session.id);
      onOpenChange(false);
    } finally {
      setStarting(false);
    }
  };

  const joined = attendees.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader className="sr-only">
          <DialogTitle>{session.title} lobby</DialogTitle>
          <DialogDescription>
            QR code, access code, and live joiner list for this quiz session.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <div>
              <h2 className="font-display text-2xl font-bold">{session.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Students will get {formatTimePerQuestion(session.default_time_per_question)} and
                move automatically to the next question.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card/60 p-5">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Quiz PIN
                </div>
                <div className="mt-2 font-display text-5xl font-bold text-primary tracking-wider">
                  {session.access_code ?? "—"}
                </div>
                {session.access_code && (
                  <button
                    type="button"
                    onClick={() => copy(session.access_code!, "PIN")}
                    className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Copy className="h-3 w-3" /> Copy PIN
                  </button>
                )}
              </div>

              <div className="rounded-2xl border border-border bg-white p-4 flex flex-col items-center">
                <div className="text-[11px] uppercase tracking-wider text-slate-500">
                  Scan to join
                </div>
                <div className="mt-2">
                  {joinUrl ? (
                    <QRCodeSVG value={joinUrl} size={168} bgColor="#ffffff" fgColor="#000000" />
                  ) : (
                    <div className="h-[168px] w-[168px] rounded-md bg-slate-100" />
                  )}
                </div>
                {joinUrl && (
                  <button
                    type="button"
                    onClick={() => copy(joinUrl, "Join link")}
                    className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Copy className="h-3 w-3" /> Copy link
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <StatTile label="Joined" value={joined} tone="primary" />
              <StatTile
                label="Completed"
                value={attendees.filter((a) => a.completed).length}
                tone="success"
              />
              <StatTile
                label="Ranked"
                value={attendees.filter((a) => a.completed).length}
                tone="primary"
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={start}
                disabled={starting || session.status === "active" || joined === 0}
                className="bg-gradient-primary text-primary-foreground shadow-glow"
              >
                <PlayCircle className="h-4 w-4 mr-1" />
                {session.status === "active"
                  ? "Quiz running"
                  : starting
                    ? "Starting…"
                    : "Start Quiz"}
              </Button>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
            </div>
            {joined === 0 && session.status !== "active" && (
              <p className="text-xs text-muted-foreground">
                Waiting for at least one participant to join before you can start.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card/40 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Players joining
                </div>
                <div className="mt-1 text-sm font-semibold">
                  {joined} student{joined === 1 ? "" : "s"} in game
                </div>
              </div>
              <span className="rounded-full bg-success/15 text-success px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                {joined} visible
              </span>
            </div>
            <div className="mt-3 max-h-[420px] overflow-y-auto">
              {attendees.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-card/30 p-6 text-center text-xs text-muted-foreground">
                  Ranking will appear as students answer their questions.
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {attendees.map((a, i) => (
                    <li
                      key={a.id}
                      className="flex items-center gap-2 rounded-lg bg-secondary/40 px-3 py-2"
                    >
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{a.name}</div>
                        {a.email && (
                          <div className="text-[10px] text-muted-foreground truncate">
                            {a.email}
                          </div>
                        )}
                      </div>
                      {a.completed ? (
                        <span className="text-[10px] uppercase tracking-wider text-success font-bold">
                          done
                        </span>
                      ) : (
                        <Users className="h-3 w-3 text-muted-foreground" />
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "primary" | "success";
}) {
  const color = tone === "primary" ? "text-primary" : "text-success";
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-4 text-center">
      <div className={`font-display text-3xl font-bold ${color}`}>{value}</div>
      <div className="text-[10px] mt-1 uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
