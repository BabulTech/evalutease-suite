import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { X, CheckCircle, Ban, Edit2, Trash2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionHead } from "./-shared";
import { planBadge } from "./helpers";
import { Badge } from "@/components/ui/badge";

export function PlansSection() {
  type PlanRow = {
    id: string;
    name: string;
    slug: string;
    tier: string;
    description: string | null;
    price_pkr: number;
    credits_per_month: number;
    is_active: boolean;
    quizzes_per_day: number;
    participants_per_session: number;
    participants_total: number;
    question_bank: number;
    sessions_total: number;
    max_hosts: number;
    ai_enabled: boolean;
    custom_branding: boolean;
    white_label: boolean;
    credit_cost_ai_10q: number;
    credit_cost_ai_scan: number;
    credit_cost_ai_tf_10q: number;
    credit_cost_ai_short_10q: number;
    credit_cost_ai_long_10q: number;
    credit_cost_ai_mix_10q: number;
    credit_cost_ai_grade_short: number;
    credit_cost_ai_grade_long: number;
    credit_cost_extra_quiz: number;
    credit_cost_extra_participants: number;
    credit_cost_session_launch: number;
    credit_cost_export: number;
    features_list: string[];
    subscriber_count: number;
  };
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<PlanRow | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("plans").select("*").order("sort_order");
    if (!data) {
      setLoading(false);
      return;
    }
    const { data: subs } = await supabase
      .from("user_subscriptions")
      .select("plan_id")
      .eq("status", "active");
    const subCnt: Record<string, number> = {};
    (subs ?? []).forEach((s: { plan_id: string }) => {
      subCnt[s.plan_id] = (subCnt[s.plan_id] ?? 0) + 1;
    });
    setPlans(
      data.map((p) => ({
        ...p,
        features_list: (p.features_list as string[]) ?? [],
        subscriber_count: subCnt[p.id] ?? 0,
        credit_cost_session_launch: (p.credit_cost_session_launch as number) ?? 0,
        credit_cost_export: (p.credit_cost_export as number) ?? 0,
      })) as PlanRow[],
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    const { error } = await supabase
      .from("plans")
      .update({
        name: editing.name,
        description: editing.description,
        price_pkr: editing.price_pkr,
        credits_per_month: editing.credits_per_month,
        is_active: editing.is_active,
        quizzes_per_day: editing.quizzes_per_day,
        participants_per_session: editing.participants_per_session,
        participants_total: editing.participants_total,
        question_bank: editing.question_bank,
        sessions_total: editing.sessions_total,
        max_hosts: editing.max_hosts,
        ai_enabled: editing.ai_enabled,
        custom_branding: editing.custom_branding,
        white_label: editing.white_label,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        watermark_enabled: (editing as any).watermark_enabled,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        can_buy_credits: (editing as any).can_buy_credits,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        email_template_allowed: (editing as any).email_template_allowed,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        trial_days: (editing as any).trial_days ?? 0,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        trial_ai_calls: (editing as any).trial_ai_calls ?? 0,
        credit_cost_ai_10q: editing.credit_cost_ai_10q,
        credit_cost_ai_scan: editing.credit_cost_ai_scan,
        credit_cost_ai_tf_10q: editing.credit_cost_ai_tf_10q,
        credit_cost_ai_short_10q: editing.credit_cost_ai_short_10q,
        credit_cost_ai_long_10q: editing.credit_cost_ai_long_10q,
        credit_cost_ai_mix_10q: editing.credit_cost_ai_mix_10q,
        credit_cost_extra_quiz: editing.credit_cost_extra_quiz,
        credit_cost_extra_participants: editing.credit_cost_extra_participants,
        credit_cost_session_launch: editing.credit_cost_session_launch,
        credit_cost_export: editing.credit_cost_export,
        features_list: editing.features_list,
      })
      .eq("id", editing.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Plan saved");
    setEditing(null);
    void load();
  };

  if (loading)
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-40 rounded-2xl bg-muted/30 animate-pulse" />
        ))}
      </div>
    );

  const numField = (label: string, val: number, key: keyof PlanRow) => (
    <div>
      <span className="text-xs text-muted-foreground mb-1 block">{label} (-1=∞)</span>
      <Input
        type="number"
        min={-1}
        value={val}
        onChange={(e) =>
          editing && setEditing((prev) => ({ ...prev!, [key]: Number(e.target.value) }))
        }
      />
    </div>
  );

  return (
    <div className="space-y-4">
      <SectionHead
        title="Plan Management"
        sub="Edit pricing, credits, limits, and features for each plan."
      />
      {editing ? (
        <div className="rounded-2xl border border-primary/30 bg-card/60 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/80">
            <div className="flex items-center gap-3">
              {planBadge(editing.slug)}
              <span className="font-display font-bold text-lg">Edit: {editing.name}</span>
              <Badge className="bg-muted text-muted-foreground border-0 text-[10px] capitalize">
                {editing.tier}
              </Badge>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
              <X className="size-4" />
            </Button>
          </div>

          <div className="p-6 space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-6 w-1 rounded-full bg-primary" />
                <span className="text-sm font-semibold">Pricing & Credits</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <span className="text-xs text-muted-foreground mb-1 block">
                    Price (PKR/month)
                  </span>
                  <Input
                    type="number"
                    min={0}
                    value={editing.price_pkr}
                    onChange={(e) =>
                      setEditing((prev) => ({ ...prev!, price_pkr: Number(e.target.value) }))
                    }
                  />
                </div>
                <div>
                  <span className="text-xs text-muted-foreground mb-1 block">Credits/month</span>
                  <Input
                    type="number"
                    min={0}
                    value={editing.credits_per_month}
                    onChange={(e) =>
                      setEditing((prev) => ({
                        ...prev!,
                        credits_per_month: Number(e.target.value),
                      }))
                    }
                  />
                </div>
                <div>
                  <span className="text-xs text-muted-foreground mb-1 block">
                    Trial Days (0=no trial)
                  </span>
                  {}
                  <Input
                    type="number"
                    min={0}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    value={(editing as any).trial_days ?? 0}
                    onChange={(e) =>
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      setEditing({ ...editing, trial_days: Number(e.target.value) } as any)
                    }
                  />
                </div>
                <div>
                  <span className="text-xs text-muted-foreground mb-1 block">
                    Trial Free AI Calls
                  </span>
                  {}
                  <Input
                    type="number"
                    min={0}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    value={(editing as any).trial_ai_calls ?? 0}
                    onChange={(e) =>
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      setEditing({ ...editing, trial_ai_calls: Number(e.target.value) } as any)
                    }
                  />
                </div>
                <div className="sm:col-span-2">
                  <span className="text-xs text-muted-foreground mb-1 block">Description</span>
                  <Input
                    value={editing.description ?? ""}
                    onChange={(e) =>
                      setEditing((prev) => ({ ...prev!, description: e.target.value }))
                    }
                  />
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-6 w-1 rounded-full bg-success" />
                <span className="text-sm font-semibold">Usage Limits</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {numField("Quizzes/day", editing.quizzes_per_day, "quizzes_per_day")}
                {numField(
                  "Participants/session",
                  editing.participants_per_session,
                  "participants_per_session",
                )}
                {numField("Total participants", editing.participants_total, "participants_total")}
                {numField("Question bank", editing.question_bank, "question_bank")}
                {numField("Max hosts (enterprise)", editing.max_hosts, "max_hosts")}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-6 w-1 rounded-full bg-warning" />
                <span className="text-sm font-semibold">Credit Costs per Action</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {numField("AI: MCQ 10 Qs", editing.credit_cost_ai_10q, "credit_cost_ai_10q")}
                {numField(
                  "AI: True/False 10 Qs",
                  editing.credit_cost_ai_tf_10q,
                  "credit_cost_ai_tf_10q",
                )}
                {numField(
                  "AI: Short Answer 10 Qs",
                  editing.credit_cost_ai_short_10q,
                  "credit_cost_ai_short_10q",
                )}
                {numField(
                  "AI: Long Answer 10 Qs",
                  editing.credit_cost_ai_long_10q,
                  "credit_cost_ai_long_10q",
                )}
                {numField(
                  "AI: Mix 10 Qs",
                  editing.credit_cost_ai_mix_10q,
                  "credit_cost_ai_mix_10q",
                )}
                {numField("AI: OCR Image Scan", editing.credit_cost_ai_scan, "credit_cost_ai_scan")}
                {}
                {numField(
                  "AI: Grade Short Answer",
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (editing as any).credit_cost_ai_grade_short ?? 1,
                  "credit_cost_ai_grade_short",
                )}
                {}
                {numField(
                  "AI: Grade Long Answer",
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (editing as any).credit_cost_ai_grade_long ?? 3,
                  "credit_cost_ai_grade_long",
                )}
                {numField(
                  "Launch Session",
                  editing.credit_cost_session_launch,
                  "credit_cost_session_launch",
                )}
                {numField("Export PDF/Excel", editing.credit_cost_export, "credit_cost_export")}
                {numField(
                  "Extra Quiz Slot",
                  editing.credit_cost_extra_quiz,
                  "credit_cost_extra_quiz",
                )}
                {numField(
                  "Extra 10 Participants",
                  editing.credit_cost_extra_participants,
                  "credit_cost_extra_participants",
                )}
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground">
                AI costs are per 10 questions. Set 0 to make an action free.
              </p>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-6 w-1 rounded-full bg-purple-400" />
                <span className="text-sm font-semibold">Feature Flags</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(
                  [
                    { key: "ai_enabled", label: "AI Enabled" },
                    { key: "custom_branding", label: "Custom Branding" },
                    { key: "white_label", label: "White Label" },
                    { key: "watermark_enabled", label: "Watermark on Exports" },
                    { key: "can_buy_credits", label: "Can Buy Add-on Credits" },
                    { key: "email_template_allowed", label: "Custom Email Templates" },
                  ] as { key: keyof PlanRow; label: string }[]
                ).map(({ key, label }) => (
                  <label
                    key={String(key)}
                    className="flex items-center gap-3 rounded-xl border border-border bg-muted/10 p-3 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      aria-label={label}
                      checked={editing[key] as boolean}
                      onChange={(e) =>
                        setEditing((prev) => ({ ...prev!, [key]: e.target.checked }))
                      }
                      className="size-4 accent-primary"
                    />
                    <span className="text-sm font-medium">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-6 w-1 rounded-full bg-blue-400" />
                <span className="text-sm font-semibold">Features List</span>
                <span className="text-xs text-muted-foreground ml-1">shown on pricing page</span>
              </div>
              <div className="space-y-2">
                {editing.features_list.map((feat, i) => (
                  <div key={`${i}-${feat}`} className="flex items-center gap-2">
                    <CheckCircle className="size-3.5 text-success shrink-0" />
                    <Input
                      value={feat}
                      onChange={(e) => {
                        const arr = [...editing.features_list];
                        arr[i] = e.target.value;
                        setEditing((prev) => ({ ...prev!, features_list: arr }));
                      }}
                      className="h-8 text-sm flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0 text-destructive/60 hover:text-destructive"
                      onClick={() =>
                        setEditing((prev) => ({
                          ...prev!,
                          features_list: editing.features_list.filter((_, j) => j !== i),
                        }))
                      }
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 w-full mt-1"
                  onClick={() =>
                    setEditing((prev) => ({
                      ...prev!,
                      features_list: [...editing.features_list, ""],
                    }))
                  }
                >
                  <Plus className="size-4" /> Add Feature
                </Button>
              </div>
            </div>
          </div>

          <div className="sticky bottom-0 border-t border-border bg-card/90 backdrop-blur px-6 py-3 flex items-center justify-between">
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => void save()}
              disabled={saving}
              className="bg-gradient-primary text-primary-foreground shadow-glow gap-2"
            >
              {saving ? "Saving…" : "Save Plan"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-2xl border p-5 space-y-3 hover:shadow-glow transition-all duration-300 ${plan.is_active ? "border-border bg-card/60" : "border-border/40 bg-card/20 opacity-60"}`}
            >
              <div className="flex items-start justify-between">
                <div>
                  {planBadge(plan.slug)}
                  <div className="font-display font-bold text-2xl mt-2">
                    PKR {plan.price_pkr}
                    <span className="text-xs text-muted-foreground font-normal">/mo</span>
                  </div>
                  <div className="text-[11px] text-warning font-semibold">
                    {plan.credits_per_month} credits/month
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => setEditing(plan)}
                  >
                    <Edit2 className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={async () => {
                      await supabase
                        .from("plans")
                        .update({ is_active: !plan.is_active })
                        .eq("id", plan.id);
                      void load();
                    }}
                  >
                    {plan.is_active ? (
                      <Ban className="size-3.5 text-destructive" />
                    ) : (
                      <CheckCircle className="size-3.5 text-success" />
                    )}
                  </Button>
                </div>
              </div>
              <div className="rounded-xl bg-muted/20 px-4 py-3 text-center border border-border">
                <div className="font-display text-3xl font-bold text-primary">
                  {plan.subscriber_count}
                </div>
                <div className="text-xs text-muted-foreground">Active subscribers</div>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {plan.ai_enabled && (
                  <Badge className="bg-success/10 text-success border-0 text-[10px]">AI</Badge>
                )}
                {plan.custom_branding && (
                  <Badge className="bg-primary/10 text-primary border-0 text-[10px]">
                    Branding
                  </Badge>
                )}
                {plan.white_label && (
                  <Badge className="bg-purple-500/10 text-purple-600 border-0 text-[10px]">
                    White Label
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
