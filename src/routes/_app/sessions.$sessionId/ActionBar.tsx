import { useNavigate } from "@tanstack/react-router";
import {
  Download,
  Mail,
  PauseCircle,
  Pencil,
  PenLine,
  PlayCircle,
  PlaySquare,
  Printer,
  StopCircle,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadQuizReportCsv, printQuizResults } from "@/lib/quiz-reports";
import type { QuizReportAttempt } from "@/lib/quiz-reports";
import type { SessionRow } from "./types";

export function ActionBar({
  session,
  sessionId,
  isActive,
  isCompleted,
  paused,
  busy,
  hasTypedQuestions,
  rosterEmails,
  categoryName,
  subcategoryName,
  questionCount,
  reportAttempts,
  teacherName,
  schoolName,
  subject,
  onStart,
  onPause,
  onResume,
  onForceEnd,
  onConfirmClose,
  onConfirmDelete,
  onEditOpen,
  onEmailParticipants,
}: {
  session: SessionRow;
  sessionId: string;
  isActive: boolean;
  isCompleted: boolean;
  paused: boolean;
  busy: boolean;
  hasTypedQuestions: boolean;
  rosterEmails: string[];
  categoryName: string;
  subcategoryName: string;
  questionCount: number;
  reportAttempts: QuizReportAttempt[];
  teacherName: string;
  schoolName: string;
  subject: string;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onForceEnd: () => void;
  onConfirmClose: () => void;
  onConfirmDelete: () => void;
  onEditOpen: () => void;
  onEmailParticipants: () => void;
}) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      {!isActive && !isCompleted && (
        <Button
          onClick={onStart}
          disabled={busy}
          className="bg-gradient-primary text-primary-foreground shadow-glow gap-1.5"
        >
          <PlayCircle className="size-4" /> Start Quiz
        </Button>
      )}
      {!isCompleted && rosterEmails.length > 0 && (
        <Button variant="outline" onClick={onEmailParticipants} className="gap-1.5">
          <Mail className="size-4" /> Email Participants
        </Button>
      )}
      {isActive && !paused && (
        <Button onClick={onPause} disabled={busy} variant="outline" className="gap-1.5">
          <PauseCircle className="size-4" /> Pause
        </Button>
      )}
      {isActive && paused && (
        <Button
          onClick={onResume}
          disabled={busy}
          className="bg-gradient-primary text-primary-foreground shadow-glow gap-1.5"
        >
          <PlaySquare className="size-4" /> Resume
        </Button>
      )}
      {!isActive && !isCompleted && (
        <Button variant="outline" onClick={onEditOpen} disabled={busy} className="gap-1.5">
          <Pencil className="size-4" /> Edit Quiz
        </Button>
      )}
      {isActive && (
        <Button
          onClick={onForceEnd}
          disabled={busy}
          variant="outline"
          className="gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
        >
          <StopCircle className="size-4" /> End Now
        </Button>
      )}
      {isActive && hasTypedQuestions && (
        <Button
          onClick={() => void navigate({ to: "/sessions/$sessionId/grade", params: { sessionId } })}
          disabled={busy}
          className="gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow"
        >
          <PenLine className="size-4" /> Grade Answers
        </Button>
      )}
      {isActive && !hasTypedQuestions && (
        <Button
          onClick={onConfirmClose}
          disabled={busy}
          variant="outline"
          className="gap-1.5 text-warning border-warning/40 hover:bg-warning/10 hover:text-warning"
        >
          <StopCircle className="size-4" /> Close Session
        </Button>
      )}
      {session.status === "grading" && (
        <>
          <Button
            onClick={() =>
              void navigate({ to: "/sessions/$sessionId/grade", params: { sessionId } })
            }
            disabled={busy}
            className="gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow"
          >
            <PenLine className="size-4" /> Continue Grading
          </Button>
          <Button
            onClick={onConfirmClose}
            disabled={busy}
            variant="outline"
            className="gap-1.5 text-warning border-warning/40 hover:bg-warning/10 hover:text-warning"
          >
            <StopCircle className="size-4" /> Close Session
          </Button>
        </>
      )}
      {!isActive && !isCompleted && (
        <Button
          variant="outline"
          onClick={onConfirmDelete}
          disabled={busy}
          className="gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="size-4" /> Delete
        </Button>
      )}
      {isCompleted && (
        <>
          <Button
            variant="outline"
            onClick={() =>
              printQuizResults({
                title: session.title,
                teacherName,
                schoolName,
                subjectLabel: subject,
                createdAt: session.created_at,
                questionCount,
                attempts: reportAttempts,
              })
            }
            className="gap-1.5"
          >
            <Printer className="size-4" /> Print Results
          </Button>
          <Button
            onClick={() =>
              downloadQuizReportCsv(
                {
                  title: session.title,
                  categoryLabel: [categoryName, subcategoryName].filter(Boolean).join(" -> "),
                  teacherName,
                  schoolName,
                  subjectLabel: subject,
                  topicLabel: session.topic ?? "",
                  createdAt: session.created_at,
                  questionCount,
                  attempts: reportAttempts,
                },
                { watermark: true },
              )
            }
            className="gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow"
          >
            <Download className="size-4" /> Download Excel
          </Button>
        </>
      )}
    </div>
  );
}
