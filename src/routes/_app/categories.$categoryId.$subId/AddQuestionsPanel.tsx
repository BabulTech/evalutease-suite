import { lazy, Suspense } from "react";
import { FileEdit, ScanLine, Sparkles } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ManualTab } from "@/components/questions/ManualTab";
import { useI18n } from "@/lib/i18n";
import type { DraftQuestion, QuestionSource } from "@/components/questions/types";

const ScanTab = lazy(() =>
  import("@/components/questions/ScanTab").then((m) => ({ default: m.ScanTab })),
);
const AiTab = lazy(() =>
  import("@/components/questions/AiTab").then((m) => ({ default: m.AiTab })),
);

type Props = {
  tab: string;
  onTabChange: (t: string) => void;
  saving: boolean;
  onSave: (drafts: DraftQuestion[], source: QuestionSource) => void;
};

function TabLoading() {
  const { t } = useI18n();
  return (
    <div className="rounded-xl border border-border bg-card/30 p-6 text-sm text-muted-foreground">
      {t("common.loading")}
    </div>
  );
}

export function AddQuestionsPanel({ tab, onTabChange, saving, onSave }: Props) {
  const { t } = useI18n();
  return (
    <div className="rounded-2xl border border-primary/25 bg-primary/3 overflow-hidden">
      <div className="px-4 pt-4 pb-2">
        <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-3">
          Add New Questions
        </p>
      </div>
      <Tabs value={tab} onValueChange={onTabChange}>
        <div className="px-4">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto rounded-xl">
            <TabsTrigger value="manual" className="gap-1.5 py-2.5 text-xs sm:text-sm rounded-lg">
              <FileEdit className="size-4" /> {t("q.tabManual")}
            </TabsTrigger>
            <TabsTrigger value="ai" className="gap-1.5 py-2.5 text-xs sm:text-sm rounded-lg">
              <Sparkles className="size-4" /> {t("q.tabAI")}
            </TabsTrigger>
            <TabsTrigger value="scan" className="gap-1.5 py-2.5 text-xs sm:text-sm rounded-lg">
              <ScanLine className="size-4" /> {t("q.tabScan")}
            </TabsTrigger>
          </TabsList>
        </div>
        <div className="p-4">
          <TabsContent value="manual" className="mt-0">
            <ManualTab disabled={saving} onSave={async (d) => onSave(d, "manual")} />
          </TabsContent>
          <TabsContent value="ai" className="mt-0">
            <Suspense fallback={<TabLoading />}>
              <AiTab disabled={saving} saving={saving} onSave={async (d) => onSave(d, "ai")} />
            </Suspense>
          </TabsContent>
          <TabsContent value="scan" className="mt-0">
            <Suspense fallback={<TabLoading />}>
              <ScanTab disabled={saving} saving={saving} onSave={async (d) => onSave(d, "ocr")} />
            </Suspense>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
