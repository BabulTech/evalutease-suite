import { Check, Layers, Lock, Route as RouteIcon, WandSparkles } from "lucide-react";

type Tab = 1 | 2 | 3;

type Props = {
  activeTab: Tab;
  selectedCatName: string;
  selectedSubName: string;
  selectedCat: string;
  selectedSub: string;
  questionTotal: number;
  onTabChange: (n: Tab) => void;
};

export function StepTabBar({
  activeTab,
  selectedCatName,
  selectedSubName,
  selectedCat,
  selectedSub,
  questionTotal,
  onTabChange,
}: Props) {
  const tabDefs = [
    {
      n: 1 as Tab,
      label: "Category",
      value: selectedCatName,
      icon: Layers,
      locked: false,
      done: !!selectedCat,
    },
    {
      n: 2 as Tab,
      label: "Topic",
      value: selectedSubName,
      icon: RouteIcon,
      locked: !selectedCat,
      done: !!selectedSub,
    },
    {
      n: 3 as Tab,
      label: "Questions",
      value: questionTotal > 0 ? `${questionTotal}` : "",
      icon: WandSparkles,
      locked: !selectedSub,
      done: questionTotal > 0,
    },
  ];

  return (
    <div className="rounded-2xl border border-border bg-card/50 p-1.5 flex gap-1.5">
      {tabDefs.map((tab) => {
        const isActive = activeTab === tab.n;
        return (
          <button
            key={tab.n}
            type="button"
            onClick={() => {
              if (!tab.locked) onTabChange(tab.n);
            }}
            disabled={tab.locked}
            className={`flex-1 flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-all min-h-[56px] ${
              isActive
                ? "bg-gradient-primary text-primary-foreground shadow-glow"
                : tab.locked
                  ? "opacity-40 cursor-not-allowed"
                  : "hover:bg-muted/40 cursor-pointer"
            }`}
          >
            <span
              className={`h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${
                isActive
                  ? "bg-primary-foreground/20"
                  : tab.done
                    ? "bg-success/20 text-success"
                    : "bg-muted/60 text-muted-foreground"
              }`}
            >
              {tab.locked ? (
                <Lock className="size-3" />
              ) : tab.done && !isActive ? (
                <Check className="size-3.5" />
              ) : (
                tab.n
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div
                className={`text-sm font-semibold leading-tight ${isActive ? "" : "text-foreground"}`}
              >
                {tab.label}
              </div>
              <div
                className={`text-[11px] truncate leading-tight mt-0.5 ${isActive ? "opacity-80" : "text-muted-foreground"}`}
              >
                {tab.value || (tab.locked ? "Locked" : "Tap to choose")}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
