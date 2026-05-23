import { lazy, Suspense } from "react";
import { FileEdit, ScanLine, Sparkles } from "lucide-react";
import { ManualTab } from "@/components/questions/ManualTab";
import { useI18n } from "@/lib/i18n";
import type { DraftQuestion, QuestionSource } from "@/components/questions/types";

const ScanTab = lazy(() =>
  import("@/components/questions/ScanTab").then((m) => ({ default: m.ScanTab })),
);
const AiTab = lazy(() =>
  import("@/components/questions/AiTab").then((m) => ({ default: m.AiTab })),
);

type Method = "manual" | "ai" | "scan";

const METHODS: {
  id: Method;
  label: string;
  desc: string;
  icon: typeof FileEdit;
  accent: string;
}[] = [
  {
    id: "manual",
    label: "Manual",
    desc: "Type questions yourself",
    icon: FileEdit,
    accent: "border-primary/40 bg-primary/5 text-primary",
  },
  {
    id: "ai",
    label: "AI",
    desc: "Generate with Claude AI",
    icon: Sparkles,
    accent: "border-purple-500/40 bg-purple-500/5 text-purple-400",
  },
  {
    id: "scan",
    label: "Scan",
    desc: "Extract from image or PDF",
    icon: ScanLine,
    accent: "border-blue-500/40 bg-blue-500/5 text-blue-400",
  },
];

export type { Method };

function TabLoading() {
  const { t } = useI18n();
  return (
    <div className="rounded-xl border border-border bg-card/30 p-6 text-sm text-muted-foreground">
      {t("common.loading")}
    </div>
  );
}

type Props = {
  ready: boolean;
  method: Method;
  saving: boolean;
  onMethodChange: (m: Method) => void;
  onSave: (drafts: DraftQuestion[], source: QuestionSource) => void;
};

export function MethodStep({ ready, method, saving, onMethodChange, onSave }: Props) {
  return (
    <div className="rounded-2xl border border-border bg-card/50 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <div
          className={`size-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
            ready ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}
        >
          2
        </div>
        <span className={`text-sm font-semibold ${ready ? "" : "text-muted-foreground"}`}>
          How do you want to add questions?
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {METHODS.map((m) => {
          const Icon = m.icon;
          const active = method === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onMethodChange(m.id)}
              className={`rounded-2xl border p-3 text-left transition-all min-h-[80px] flex flex-col justify-between ${
                active
                  ? m.accent + " ring-2 ring-inset ring-current/20"
                  : "border-border bg-card/40 hover:border-primary/30"
              } ${!ready ? "opacity-50 pointer-events-none" : ""}`}
            >
              <Icon size={18} className={active ? "" : "text-muted-foreground"} />
              <div>
                <div className={`text-sm font-semibold mt-2 ${active ? "" : "text-foreground"}`}>
                  {m.label}
                </div>
                <div className="text-[11px] text-muted-foreground leading-tight">{m.desc}</div>
              </div>
            </button>
          );
        })}
      </div>

      {!ready && (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
          <span>↑ Pick a category and topic first to unlock this step</span>
        </div>
      )}

      {ready && (
        <div className="pt-2 border-t border-border/50">
          {method === "manual" && (
            <ManualTab disabled={saving} onSave={async (d) => onSave(d, "manual")} />
          )}
          {method === "ai" && (
            <Suspense fallback={<TabLoading />}>
              <AiTab disabled={saving} saving={saving} onSave={async (d) => onSave(d, "ai")} />
            </Suspense>
          )}
          {method === "scan" && (
            <Suspense fallback={<TabLoading />}>
              <ScanTab disabled={saving} saving={saving} onSave={async (d) => onSave(d, "ocr")} />
            </Suspense>
          )}
        </div>
      )}
    </div>
  );
}
