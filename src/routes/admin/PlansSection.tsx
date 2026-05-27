import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  X, CheckCircle, Edit2, Trash2, Plus, ChevronDown, ChevronUp,
  Users, Zap, Cpu, Palette, Shield, CreditCard, BarChart3, ListChecks,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SectionHead } from "./-shared";
import { planBadge } from "./helpers";

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
  watermark_enabled: boolean;
  can_buy_credits: boolean;
  email_template_allowed: boolean;
  trial_ai_calls: number;
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

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer select-none group">
      <div
        role="switch"
        aria-checked={checked ? "true" : "false"}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5.5 rounded-full transition-colors duration-200 cursor-pointer ${checked ? "bg-primary" : "bg-muted-foreground/30"}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${checked ? "translate-x-4.5" : "translate-x-0"}`} />
      </div>
      <span className={`text-sm ${checked ? "text-foreground font-medium" : "text-muted-foreground"}`}>{label}</span>
    </label>
  );
}

function NumField({ label, value, onChange, hint }: { label: string; value: number; onChange: (v: number) => void; hint?: string }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</label>
      <Input
        type="number"
        min={-1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-8 text-sm"
      />
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SectionDivider({ icon: Icon, label, color }: { icon: React.ElementType; label: string; color: string }) {
  return (
    <div className={`flex items-center gap-2 py-1 border-b border-border/60 mb-3`}>
      <div className={`p-1 rounded-md ${color}`}>
        <Icon className="size-3.5 text-white" />
      </div>
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
    </div>
  );
}

const TIER_GRADIENTS: Record<string, string> = {
  free:       "from-slate-500/10 to-slate-400/5 border-slate-400/30",
  starter:    "from-blue-500/10 to-blue-400/5 border-blue-400/30",
  pro:        "from-primary/10 to-primary/5 border-primary/30",
  enterprise: "from-purple-500/10 to-purple-400/5 border-purple-400/30",
};

const TIER_ACCENT: Record<string, string> = {
  free:       "bg-slate-500",
  starter:    "bg-blue-500",
  pro:        "bg-primary",
  enterprise: "bg-purple-600",
};

function lim(v: number) { return v === -1 ? "∞" : v.toLocaleString(); }

// react-doctor-disable-next-line react-doctor/prefer-useReducer
export function PlansSection() {
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<PlanRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("plans").select("*").order("sort_order");
    if (!data) { setLoading(false); return; }
    const { data: subs } = await supabase.from("user_subscriptions").select("plan_id").eq("status", "active");
    const subCnt: Record<string, number> = {};
    (subs ?? []).forEach((s: { plan_id: string }) => { subCnt[s.plan_id] = (subCnt[s.plan_id] ?? 0) + 1; });
    setPlans(data.map((p) => ({
      ...p,
      features_list: (p.features_list as string[]) ?? [],
      subscriber_count: subCnt[p.id] ?? 0,
      trial_ai_calls: (p as { trial_ai_calls?: number }).trial_ai_calls ?? 0,
      watermark_enabled: (p as { watermark_enabled?: boolean }).watermark_enabled ?? false,
      can_buy_credits: (p as { can_buy_credits?: boolean }).can_buy_credits ?? false,
      email_template_allowed: (p as { email_template_allowed?: boolean }).email_template_allowed ?? false,
      credit_cost_ai_grade_short: (p as { credit_cost_ai_grade_short?: number }).credit_cost_ai_grade_short ?? 1,
      credit_cost_ai_grade_long: (p as { credit_cost_ai_grade_long?: number }).credit_cost_ai_grade_long ?? 3,
      credit_cost_session_launch: (p as { credit_cost_session_launch?: number }).credit_cost_session_launch ?? 0,
      credit_cost_export: (p as { credit_cost_export?: number }).credit_cost_export ?? 0,
    })) as PlanRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const toggleActive = async (plan: PlanRow) => {
    await supabase.from("plans").update({ is_active: !plan.is_active }).eq("id", plan.id);
    void load();
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    const { error } = await supabase.from("plans").update({
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
      watermark_enabled: editing.watermark_enabled,
      can_buy_credits: editing.can_buy_credits,
      email_template_allowed: editing.email_template_allowed,
      trial_ai_calls: editing.trial_ai_calls,
      credit_cost_ai_10q: editing.credit_cost_ai_10q,
      credit_cost_ai_scan: editing.credit_cost_ai_scan,
      credit_cost_ai_tf_10q: editing.credit_cost_ai_tf_10q,
      credit_cost_ai_short_10q: editing.credit_cost_ai_short_10q,
      credit_cost_ai_long_10q: editing.credit_cost_ai_long_10q,
      credit_cost_ai_mix_10q: editing.credit_cost_ai_mix_10q,
      credit_cost_ai_grade_short: editing.credit_cost_ai_grade_short,
      credit_cost_ai_grade_long: editing.credit_cost_ai_grade_long,
      credit_cost_extra_quiz: editing.credit_cost_extra_quiz,
      credit_cost_extra_participants: editing.credit_cost_extra_participants,
      credit_cost_session_launch: editing.credit_cost_session_launch,
      credit_cost_export: editing.credit_cost_export,
      features_list: editing.features_list,
    }).eq("id", editing.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Plan saved");
    setEditing(null);
    void load();
  };

  const toggleExpand = (id: string) =>
    setExpanded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  if (loading) return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-64 rounded-2xl bg-muted/30 animate-pulse" />
      ))}
    </div>
  );

  // ── EDIT VIEW ─────────────────────────────────────────────────────────────
  if (editing) return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button type="button" title="Cancel editing" onClick={() => setEditing(null)} className="p-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted/40">
          <X className="size-4" />
        </button>
        <div className="flex items-center gap-2">
          {planBadge(editing.slug)}
          <span className="font-semibold text-lg">Editing: {editing.name}</span>
        </div>
        <Badge className="bg-muted text-muted-foreground border-0 text-[10px] capitalize ml-1">{editing.tier}</Badge>
        <div className="ml-auto">
          <Toggle
            checked={editing.is_active}
            onChange={(v) => setEditing((p) => ({ ...p!, is_active: v }))}
            label={editing.is_active ? "Active" : "Inactive"}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card/60 overflow-hidden divide-y divide-border/50">

        {/* Pricing */}
        <div className="p-5 space-y-3">
          <SectionDivider icon={CreditCard} label="Pricing & Credits" color="bg-primary" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <NumField label="Price PKR/mo" value={editing.price_pkr} onChange={(v) => setEditing((p) => ({ ...p!, price_pkr: v }))} />
            <NumField label="Credits/month" value={editing.credits_per_month} onChange={(v) => setEditing((p) => ({ ...p!, credits_per_month: v }))} />
            <NumField label="Free AI Calls" value={editing.trial_ai_calls} onChange={(v) => setEditing((p) => ({ ...p!, trial_ai_calls: v }))} hint="Lifetime, enterprise free only" />
            <div className="space-y-1 sm:col-span-1 col-span-2">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Description</label>
              <Input value={editing.description ?? ""} onChange={(e) => setEditing((p) => ({ ...p!, description: e.target.value }))} className="h-8 text-sm" />
            </div>
          </div>
        </div>

        {/* Usage limits */}
        <div className="p-5 space-y-3">
          <SectionDivider icon={BarChart3} label="Usage Limits" color="bg-success" />
          <p className="text-[11px] text-muted-foreground -mt-1">Set -1 for unlimited (∞)</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <NumField label="Quizzes/day" value={editing.quizzes_per_day} onChange={(v) => setEditing((p) => ({ ...p!, quizzes_per_day: v }))} />
            <NumField label="Participants/session" value={editing.participants_per_session} onChange={(v) => setEditing((p) => ({ ...p!, participants_per_session: v }))} />
            <NumField label="Total participants" value={editing.participants_total} onChange={(v) => setEditing((p) => ({ ...p!, participants_total: v }))} />
            <NumField label="Question bank" value={editing.question_bank} onChange={(v) => setEditing((p) => ({ ...p!, question_bank: v }))} />
            <NumField label="Max hosts" value={editing.max_hosts} onChange={(v) => setEditing((p) => ({ ...p!, max_hosts: v }))} hint="Enterprise only" />
          </div>
        </div>

        {/* Credit costs */}
        <div className="p-5 space-y-3">
          <SectionDivider icon={Zap} label="Credit Costs per Action" color="bg-warning" />
          <p className="text-[11px] text-muted-foreground -mt-1">Credits consumed per action. Set 0 to make free.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <NumField label="AI MCQ 10 Qs" value={editing.credit_cost_ai_10q} onChange={(v) => setEditing((p) => ({ ...p!, credit_cost_ai_10q: v }))} />
            <NumField label="AI True/False 10 Qs" value={editing.credit_cost_ai_tf_10q} onChange={(v) => setEditing((p) => ({ ...p!, credit_cost_ai_tf_10q: v }))} />
            <NumField label="AI Short 10 Qs" value={editing.credit_cost_ai_short_10q} onChange={(v) => setEditing((p) => ({ ...p!, credit_cost_ai_short_10q: v }))} />
            <NumField label="AI Long 10 Qs" value={editing.credit_cost_ai_long_10q} onChange={(v) => setEditing((p) => ({ ...p!, credit_cost_ai_long_10q: v }))} />
            <NumField label="AI Mix 10 Qs" value={editing.credit_cost_ai_mix_10q} onChange={(v) => setEditing((p) => ({ ...p!, credit_cost_ai_mix_10q: v }))} />
            <NumField label="AI OCR Scan" value={editing.credit_cost_ai_scan} onChange={(v) => setEditing((p) => ({ ...p!, credit_cost_ai_scan: v }))} />
            <NumField label="Grade Short Ans" value={editing.credit_cost_ai_grade_short} onChange={(v) => setEditing((p) => ({ ...p!, credit_cost_ai_grade_short: v }))} />
            <NumField label="Grade Long Ans" value={editing.credit_cost_ai_grade_long} onChange={(v) => setEditing((p) => ({ ...p!, credit_cost_ai_grade_long: v }))} />
            <NumField label="Session Launch" value={editing.credit_cost_session_launch} onChange={(v) => setEditing((p) => ({ ...p!, credit_cost_session_launch: v }))} />
            <NumField label="Export PDF/Excel" value={editing.credit_cost_export} onChange={(v) => setEditing((p) => ({ ...p!, credit_cost_export: v }))} />
            <NumField label="Extra Quiz Slot" value={editing.credit_cost_extra_quiz} onChange={(v) => setEditing((p) => ({ ...p!, credit_cost_extra_quiz: v }))} />
            <NumField label="Extra 10 Participants" value={editing.credit_cost_extra_participants} onChange={(v) => setEditing((p) => ({ ...p!, credit_cost_extra_participants: v }))} />
          </div>
        </div>

        {/* Feature flags */}
        <div className="p-5 space-y-3">
          <SectionDivider icon={Shield} label="Feature Flags" color="bg-purple-600" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {([
              { key: "ai_enabled", label: "AI Enabled" },
              { key: "custom_branding", label: "Custom Branding" },
              { key: "white_label", label: "White Label" },
              { key: "watermark_enabled", label: "Watermark on Exports" },
              { key: "can_buy_credits", label: "Can Buy Add-on Credits" },
              { key: "email_template_allowed", label: "Custom Email Templates" },
            ] as { key: keyof PlanRow; label: string }[]).map(({ key, label }) => (
              <div key={String(key)} className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/10 px-4 py-3">
                <span className="text-sm text-muted-foreground">{label}</span>
                <Toggle
                  checked={editing[key] as boolean}
                  onChange={(v) => setEditing((p) => ({ ...p!, [key]: v }))}
                  label=""
                />
              </div>
            ))}
          </div>
        </div>

        {/* Features list */}
        <div className="p-5 space-y-3">
          <SectionDivider icon={ListChecks} label="Features List" color="bg-blue-500" />
          <p className="text-[11px] text-muted-foreground -mt-1">Displayed on the public pricing page.</p>
          <div className="space-y-2">
            {editing.features_list.map((feat, i) => (
              <div key={`${i}-${feat}`} className="flex items-center gap-2">
                <CheckCircle className="size-3.5 text-success shrink-0" />
                <Input
                  value={feat}
                  onChange={(e) => {
                    const arr = [...editing.features_list];
                    arr[i] = e.target.value;
                    setEditing((p) => ({ ...p!, features_list: arr }));
                  }}
                  className="h-8 text-sm flex-1"
                />
                <button
                  type="button"
                  title="Remove feature"
                  onClick={() => setEditing((p) => ({ ...p!, features_list: editing.features_list.filter((_, j) => j !== i) }))}
                  className="p-1.5 rounded-lg text-destructive/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setEditing((p) => ({ ...p!, features_list: [...editing.features_list, ""] }))}
              className="w-full flex items-center justify-center gap-1.5 h-8 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            >
              <Plus className="size-3.5" /> Add feature
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
        <Button onClick={() => void save()} disabled={saving} className="bg-gradient-primary text-primary-foreground shadow-glow px-8">
          {saving ? "Saving…" : "Save Changes"}
        </Button>
      </div>
    </div>
  );

  // ── CARD VIEW ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <SectionHead
        title="Plan Management"
        sub={`${plans.length} plans · ${plans.filter((p) => p.is_active).length} active`}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {plans.map((plan) => {
          const isOpen = expanded.has(plan.id);
          const gradient = TIER_GRADIENTS[plan.tier] ?? TIER_GRADIENTS.free;
          const accent = TIER_ACCENT[plan.tier] ?? "bg-slate-500";

          return (
            <div
              key={plan.id}
              className={`rounded-2xl border bg-gradient-to-br ${gradient} overflow-hidden transition-all duration-200 ${!plan.is_active ? "opacity-50" : ""}`}
            >
              {/* Card header */}
              <div className="px-5 pt-5 pb-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    {planBadge(plan.slug)}
                    <div className="font-display font-bold text-2xl leading-tight mt-1.5">
                      {plan.price_pkr === 0
                        ? <span className="text-success">Free</span>
                        : <>PKR {plan.price_pkr.toLocaleString()}<span className="text-sm font-normal text-muted-foreground">/mo</span></>
                      }
                    </div>
                    {plan.description && (
                      <p className="text-xs text-muted-foreground leading-snug">{plan.description}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {/* Active toggle */}
                    <button
                      type="button"
                      title={plan.is_active ? "Deactivate plan" : "Activate plan"}
                      onClick={() => void toggleActive(plan)}
                      className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${plan.is_active ? "bg-primary" : "bg-muted-foreground/30"}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${plan.is_active ? "translate-x-5" : "translate-x-0"}`} />
                    </button>
                    <span className={`text-[10px] font-semibold ${plan.is_active ? "text-success" : "text-muted-foreground"}`}>
                      {plan.is_active ? "ACTIVE" : "INACTIVE"}
                    </span>
                  </div>
                </div>

                {/* Subscriber count */}
                <div className="mt-4 flex items-center gap-3">
                  <div className={`flex items-center gap-2 flex-1 rounded-xl px-3 py-2.5 ${accent}/10 border border-current/10`}>
                    <Users className={`size-4 ${accent.replace("bg-", "text-")}`} />
                    <div>
                      <div className="text-lg font-bold leading-none">{plan.subscriber_count}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">active subscribers</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-1 rounded-xl px-3 py-2.5 bg-warning/10 border border-warning/20">
                    <CreditCard className="size-4 text-warning" />
                    <div>
                      <div className="text-lg font-bold leading-none">{plan.credits_per_month === -1 ? "∞" : plan.credits_per_month.toLocaleString()}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">credits/month</div>
                    </div>
                  </div>
                </div>

                {/* Feature badges */}
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {plan.ai_enabled && <Badge className="bg-success/10 text-success border-success/20 text-[10px] font-semibold">AI</Badge>}
                  {plan.custom_branding && <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] font-semibold">Branding</Badge>}
                  {plan.white_label && <Badge className="bg-purple-500/10 text-purple-500 border-purple-500/20 text-[10px] font-semibold">White Label</Badge>}
                  {plan.can_buy_credits && <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20 text-[10px] font-semibold">Buy Credits</Badge>}
                  {plan.email_template_allowed && <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 text-[10px] font-semibold">Email Templates</Badge>}
                  {plan.trial_ai_calls > 0 && <Badge className="bg-cyan-500/10 text-cyan-500 border-cyan-500/20 text-[10px] font-semibold">{plan.trial_ai_calls} free AI</Badge>}
                </div>
              </div>

              {/* Expandable details */}
              <button
                type="button"
                onClick={() => toggleExpand(plan.id)}
                className="w-full flex items-center justify-between px-5 py-2.5 border-t border-border/40 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/10 transition-colors"
              >
                <span>{isOpen ? "Hide details" : "Show details"}</span>
                {isOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
              </button>

              {isOpen && (
                <div className="px-5 pb-5 pt-3 border-t border-border/40 space-y-4 bg-background/30">

                  {/* Usage limits */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <BarChart3 className="size-3.5 text-success" />
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Usage Limits</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                      {([
                        ["Quizzes/day", lim(plan.quizzes_per_day)],
                        ["Part./session", lim(plan.participants_per_session)],
                        ["Total participants", lim(plan.participants_total)],
                        ["Question bank", lim(plan.question_bank)],
                        ["Max hosts", lim(plan.max_hosts)],
                      ] as [string, string][]).map(([k, v]) => (
                        <div key={k} className="flex justify-between items-center py-0.5 border-b border-border/30">
                          <span className="text-muted-foreground">{k}</span>
                          <span className="font-semibold">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Credit costs */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Zap className="size-3.5 text-warning" />
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Credit Costs</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                      {([
                        ["AI MCQ 10q", plan.credit_cost_ai_10q],
                        ["AI TF 10q", plan.credit_cost_ai_tf_10q],
                        ["AI Short 10q", plan.credit_cost_ai_short_10q],
                        ["AI Long 10q", plan.credit_cost_ai_long_10q],
                        ["AI Mix 10q", plan.credit_cost_ai_mix_10q],
                        ["AI OCR Scan", plan.credit_cost_ai_scan],
                        ["Grade Short", plan.credit_cost_ai_grade_short],
                        ["Grade Long", plan.credit_cost_ai_grade_long],
                        ["Session Launch", plan.credit_cost_session_launch],
                        ["Export", plan.credit_cost_export],
                        ["Extra Quiz", plan.credit_cost_extra_quiz],
                        ["Extra 10 Part.", plan.credit_cost_extra_participants],
                      ] as [string, number][]).map(([k, v]) => (
                        <div key={k} className="flex justify-between items-center py-0.5 border-b border-border/30">
                          <span className="text-muted-foreground">{k}</span>
                          <span className={`font-semibold ${v === 0 ? "text-success" : "text-warning"}`}>{v === 0 ? "Free" : `${v} cr`}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Feature flags */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Shield className="size-3.5 text-purple-500" />
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Feature Flags</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      {([
                        ["AI Enabled", plan.ai_enabled],
                        ["Custom Branding", plan.custom_branding],
                        ["White Label", plan.white_label],
                        ["Watermark", plan.watermark_enabled],
                        ["Buy Credits", plan.can_buy_credits],
                        ["Email Templates", plan.email_template_allowed],
                      ] as [string, boolean][]).map(([k, v]) => (
                        <div key={k} className="flex items-center justify-between py-0.5 border-b border-border/30">
                          <span className="text-muted-foreground">{k}</span>
                          <span className={`font-semibold ${v ? "text-success" : "text-muted-foreground/50"}`}>{v ? "Yes" : "No"}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Features list */}
                  {plan.features_list.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <ListChecks className="size-3.5 text-blue-500" />
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Marketing Features</span>
                      </div>
                      <ul className="space-y-1">
                        {plan.features_list.map((f, i) => (
                          <li key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                            <CheckCircle className="size-3 text-success shrink-0" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Card footer actions */}
              <div className="flex gap-2 px-5 py-3 border-t border-border/40 bg-background/20">
                <button
                  type="button"
                  onClick={() => setEditing(plan)}
                  className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
                >
                  <Edit2 className="size-3.5" /> Edit Plan
                </button>
                <button
                  type="button"
                  onClick={() => toggleExpand(plan.id)}
                  className="flex items-center justify-center gap-1.5 px-3 h-8 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:bg-muted/40 transition-colors"
                >
                  {isOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                  {isOpen ? "Less" : "More"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
