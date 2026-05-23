import { AlertTriangle, Loader2 } from "lucide-react";
import { MODULE_FILTERS } from "./types";

type Props = {
  loading: boolean;
  error: string | null;
  moduleFilter: string;
};

export function ActivityFeedState({ loading, error, moduleFilter }: Props) {
  if (loading) {
    return (
      <div className="px-4 py-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading activity…
      </div>
    );
  }
  if (error) {
    return (
      <div className="px-4 py-6 flex items-center gap-2 text-sm text-destructive">
        <AlertTriangle className="size-4" /> {error}
      </div>
    );
  }
  return (
    <div className="px-4 py-6 text-sm text-muted-foreground text-center">
      {moduleFilter === "all"
        ? "No activity yet. Start a quiz, add participants, or run AI grading to see entries here."
        : `No "${MODULE_FILTERS.find((m) => m.value === moduleFilter)?.label}" activity in the recent feed.`}
    </div>
  );
}
