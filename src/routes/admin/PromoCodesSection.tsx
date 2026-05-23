import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { validationError } from "@/components/ui/validation-toast";
import {
  Plus,
  Tag,
  Percent,
  DollarSign,
  Zap,
  Check,
  Copy,
  Edit2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  CheckCircle,
  BarChart3,
  AlertTriangle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SectionHead } from "./-shared";

type PromoRow = {
  id: string;
  code: string;
  description: string | null;
  discount_type: "percent" | "fixed" | "free";
  discount_percent: number | null;
  discount_fixed_cents: number | null;
  applies_to_slugs: string[];
  max_uses: number | null;
  uses_count: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
};

type PromoDraft = {
  code: string;
  description: string;
  discount_type: "percent" | "fixed" | "free";
  discount_percent: string;
  discount_fixed_cents: string;
  applies_to_slugs: string[];
  max_uses: string;
  expires_at: string;
  is_active: boolean;
};

function emptyPromoDraft(): PromoDraft {
  return {
    code: "",
    description: "",
    discount_type: "percent",
    discount_percent: "20",
    discount_fixed_cents: "500",
    applies_to_slugs: [],
    max_uses: "",
    expires_at: "",
    is_active: true,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- promo_codes table not yet in generated Supabase types
const db = supabase as any;

// react-doctor-disable-next-line react-doctor/prefer-useReducer
// react-doctor-disable-next-line react-doctor/no-giant-component
export function PromoCodesSection() {
  const [rows, setRows] = useState<PromoRow[]>([]);
  const [plans, setPlans] = useState<{ slug: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PromoRow | null>(null);
  const [draft, setDraft] = useState<PromoDraft>(() => emptyPromoDraft());
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [pcRes, plRes] = await Promise.all([
      db.from("promo_codes").select("*").order("created_at", { ascending: false }),
      supabase.from("plans").select("slug, name").eq("is_active", true).order("sort_order"),
    ]);
    setLoading(false);
    if (pcRes.data) setRows(pcRes.data as unknown as PromoRow[]);
    if (plRes.data) setPlans(plRes.data);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setDraft(emptyPromoDraft());
    setDialogOpen(true);
  };
  const openEdit = (r: PromoRow) => {
    setEditing(r);
    setDraft({
      code: r.code,
      description: r.description ?? "",
      discount_type:
        r.discount_type ??
        (r.discount_percent ? "percent" : r.discount_fixed_cents ? "fixed" : "free"),
      discount_percent: String(r.discount_percent ?? 20),
      discount_fixed_cents: String(r.discount_fixed_cents ?? 500),
      applies_to_slugs: r.applies_to_slugs ?? [],
      max_uses: r.max_uses != null ? String(r.max_uses) : "",
      expires_at: r.expires_at ? r.expires_at.slice(0, 16) : "",
      is_active: r.is_active,
    });
    setDialogOpen(true);
  };

  const set = <K extends keyof PromoDraft>(k: K, v: PromoDraft[K]) =>
    setDraft((p) => ({ ...p, [k]: v }));
  const toggleSlug = (slug: string) =>
    set(
      "applies_to_slugs",
      draft.applies_to_slugs.includes(slug)
        ? draft.applies_to_slugs.filter((s) => s !== slug)
        : [...draft.applies_to_slugs, slug],
    );

  const save = async () => {
    const code = draft.code.trim().toUpperCase();
    if (!code) {
      validationError("Code is required");
      return;
    }
    if (!/^[A-Z0-9_-]{2,30}$/.test(code)) {
      validationError("Code must be 2–30 characters, letters/digits/dashes only");
      return;
    }
    setSaving(true);
    const row: Record<string, unknown> = {
      code,
      description: draft.description.trim() || null,
      discount_percent: draft.discount_type === "percent" ? Number(draft.discount_percent) : null,
      discount_fixed_cents:
        draft.discount_type === "fixed" ? Number(draft.discount_fixed_cents) : null,
      applies_to_slugs: draft.applies_to_slugs,
      max_uses: draft.max_uses ? Number(draft.max_uses) : null,
      expires_at: draft.expires_at ? new Date(draft.expires_at).toISOString() : null,
      is_active: draft.is_active,
    };
    if (editing) {
      const { error } = await db.from("promo_codes").update(row).eq("id", editing.id);
      if (error) {
        toast.error(error.message);
        setSaving(false);
        return;
      }
      toast.success("Promo code updated");
    } else {
      const { error } = await db.from("promo_codes").insert(row);
      if (error) {
        toast.error(error.message);
        setSaving(false);
        return;
      }
      toast.success(`Promo code "${code}" created`);
    }
    setSaving(false);
    setDialogOpen(false);
    void load();
  };

  const toggleActive = async (r: PromoRow) => {
    const { error } = await db
      .from("promo_codes")
      .update({ is_active: !r.is_active })
      .eq("id", r.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, is_active: !r.is_active } : x)));
    toast.success(r.is_active ? "Code deactivated" : "Code activated");
  };

  const deleteCode = async (id: string) => {
    const { error } = await db.from("promo_codes").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
    setDeleteId(null);
    toast.success("Promo code deleted");
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      /* ignore */
    }
    setCopied(code);
    setTimeout(() => setCopied(null), 1500);
    toast.success(`"${code}" copied`);
  };

  const discountLabel = (r: PromoRow) => {
    const dt =
      r.discount_type ??
      (r.discount_percent ? "percent" : r.discount_fixed_cents ? "fixed" : "free");
    if (dt === "free") return "🎁 FREE";
    if (dt === "percent" && r.discount_percent) return `${r.discount_percent}% off`;
    if (dt === "fixed" && r.discount_fixed_cents)
      return `-$${(r.discount_fixed_cents / 100).toFixed(2)}`;
    return "-";
  };

  const isExpired = (r: PromoRow) => (r.expires_at ? new Date(r.expires_at) < new Date() : false);
  const isExhausted = (r: PromoRow) => r.max_uses != null && r.uses_count >= r.max_uses;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <SectionHead
          title="Promo Codes"
          sub={`${rows.length} code${rows.length !== 1 ? "s" : ""} · ${rows.filter((r) => r.is_active && !isExpired(r) && !isExhausted(r)).length} active`}
        />
        <Button
          onClick={openCreate}
          className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow"
        >
          <Plus className="size-4" /> New Promo Code
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total codes", value: rows.length, icon: Tag },
          {
            label: "Active",
            value: rows.filter((r) => r.is_active && !isExpired(r) && !isExhausted(r)).length,
            icon: CheckCircle,
          },
          {
            label: "Total uses",
            value: rows.reduce((s, r) => s + r.uses_count, 0),
            icon: BarChart3,
          },
          {
            label: "Expired / exhausted",
            value: rows.filter((r) => isExpired(r) || isExhausted(r)).length,
            icon: AlertTriangle,
          },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-xl border border-border bg-card/50 p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Icon className="size-3.5" /> {label}
            </div>
            <div className="font-display text-2xl font-bold">{value}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 rounded-xl bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/30 p-12 text-center">
          <Tag className="mx-auto size-10 text-muted-foreground/50 mb-3" />
          <p className="font-semibold">No promo codes yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Click "New Promo Code" to create your first one.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card/60 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/20">
              <tr>
                {["Code", "Discount", "Plans", "Usage", "Expires", "Status", ""].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => {
                const expired = isExpired(r);
                const exhausted = isExhausted(r);
                const bad = expired || exhausted;
                return (
                  <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <code
                          className={`font-mono font-bold text-sm ${bad ? "text-muted-foreground line-through" : "text-foreground"}`}
                        >
                          {r.code}
                        </code>
                        <button
                          type="button"
                          onClick={() => copyCode(r.code)}
                          className="p-1 rounded hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {copied === r.code ? (
                            <Check className="size-3 text-success" />
                          ) : (
                            <Copy className="size-3" />
                          )}
                        </button>
                      </div>
                      {r.description && (
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {r.description}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${
                          r.discount_type === "free"
                            ? "bg-success/15 text-success"
                            : r.discount_type === "percent"
                              ? "bg-primary/15 text-primary"
                              : "bg-warning/15 text-warning"
                        }`}
                      >
                        {discountLabel(r)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {(r.applies_to_slugs ?? []).length === 0 ? (
                        <span className="text-xs text-muted-foreground">All plans</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {r.applies_to_slugs.map((s) => (
                            <span
                              key={s}
                              className="rounded-full bg-secondary/60 px-2 py-0.5 text-[10px] font-bold capitalize"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={exhausted ? "text-destructive font-semibold" : ""}>
                        {r.uses_count}
                        {r.max_uses != null ? `/${r.max_uses}` : ""}
                      </span>
                      {exhausted && (
                        <div className="text-[10px] text-destructive">Limit reached</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {r.expires_at ? (
                        <span className={expired ? "text-destructive" : "text-muted-foreground"}>
                          {new Date(r.expires_at).toLocaleDateString()}
                          {expired && <div className="text-[10px] text-destructive">Expired</div>}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Never</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => toggleActive(r)}
                        className={`flex items-center gap-1.5 text-xs font-semibold rounded-full px-2.5 py-1 transition-colors ${
                          r.is_active && !bad
                            ? "bg-success/15 text-success hover:bg-success/25"
                            : "bg-muted/50 text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {r.is_active && !bad ? (
                          <>
                            <ToggleRight className="size-3.5" /> Active
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="size-3.5" /> Inactive
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={() => openEdit(r)}
                        >
                          <Edit2 className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 hover:text-destructive"
                          onClick={() => setDeleteId(r.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(o) => {
          if (!o) setDialogOpen(false);
        }}
      >
        <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="size-4 text-primary" />
              {editing ? "Edit Promo Code" : "New Promo Code"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 mt-1">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                Code <span className="text-destructive">*</span>
              </span>
              <Input
                value={draft.code}
                onChange={(e) => set("code", e.target.value.toUpperCase())}
                placeholder="SUMMER25"
                className="font-mono uppercase"
                maxLength={30}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Letters, digits, dashes. Automatically uppercased.
              </p>
            </div>

            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                Description
              </span>
              <Input
                value={draft.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Summer 2025 promotion for teachers"
              />
            </div>

            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                Discount type
              </span>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { v: "percent", icon: Percent, label: "Percentage", sub: "e.g. 20% off" },
                    { v: "fixed", icon: DollarSign, label: "Fixed amount", sub: "e.g. $5.00 off" },
                    { v: "free", icon: Zap, label: "Free plan", sub: "Grant free access" },
                  ] as const
                ).map(({ v, icon: Icon, label, sub }) => (
                  <button
                    key={v}
                    type="button"
                    title={label}
                    onClick={() => set("discount_type", v)}
                    className={`rounded-xl border p-3 text-left transition-colors ${
                      draft.discount_type === v
                        ? "border-primary/60 bg-primary/10"
                        : "border-border bg-card/30 hover:border-primary/30"
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 mb-1.5 ${draft.discount_type === v ? "text-primary" : "text-muted-foreground"}`}
                    />
                    <div
                      className={`text-xs font-bold ${draft.discount_type === v ? "text-primary" : ""}`}
                    >
                      {label}
                    </div>
                    <div className="text-[10px] text-muted-foreground">{sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {draft.discount_type === "percent" && (
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                  Percentage off
                </span>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={draft.discount_percent}
                    onChange={(e) => set("discount_percent", e.target.value)}
                    className="w-28"
                  />
                  <span className="text-muted-foreground">%</span>
                </div>
              </div>
            )}
            {draft.discount_type === "fixed" && (
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                  Fixed discount (in cents)
                </span>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    value={draft.discount_fixed_cents}
                    onChange={(e) => set("discount_fixed_cents", e.target.value)}
                    className="w-28"
                  />
                  <span className="text-muted-foreground text-sm">
                    = ${(Number(draft.discount_fixed_cents || 0) / 100).toFixed(2)} off
                  </span>
                </div>
              </div>
            )}
            {draft.discount_type === "free" && (
              <div className="rounded-xl border border-success/30 bg-success/5 p-3 text-xs text-success">
                🎁 This code will grant the selected plan for free (100% off). Choose which plan(s)
                below.
              </div>
            )}

            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                Applies to plans{" "}
                <span className="ml-1.5 font-normal normal-case text-muted-foreground/70">
                  (leave empty = all plans)
                </span>
              </span>
              <div className="flex flex-wrap gap-2">
                {plans.flatMap((p) =>
                  p.slug === "free"
                    ? []
                    : [
                        <button
                          key={p.slug}
                          type="button"
                          onClick={() => toggleSlug(p.slug)}
                          className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize transition-colors ${
                            draft.applies_to_slugs.includes(p.slug)
                              ? "border-primary/60 bg-primary/15 text-primary"
                              : "border-border bg-card/30 text-muted-foreground hover:border-primary/30"
                          }`}
                        >
                          {draft.applies_to_slugs.includes(p.slug) && (
                            <Check className="inline size-3 mr-1" />
                          )}
                          {p.name}
                        </button>,
                      ],
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                  Max uses{" "}
                  <span className="ml-1 font-normal normal-case text-muted-foreground/70">
                    (blank = unlimited)
                  </span>
                </span>
                <Input
                  type="number"
                  min={1}
                  value={draft.max_uses}
                  onChange={(e) => set("max_uses", e.target.value)}
                  placeholder="∞"
                />
              </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                  Expires at{" "}
                  <span className="ml-1 font-normal normal-case text-muted-foreground/70">
                    (blank = never)
                  </span>
                </span>
                <Input
                  type="datetime-local"
                  value={draft.expires_at}
                  onChange={(e) => set("expires_at", e.target.value)}
                  // react-doctor-disable-next-line react-doctor/rendering-hydration-mismatch-time
                  min={new Date().toISOString().slice(0, 16)}
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border bg-card/40 px-4 py-3">
              <div>
                <div className="text-sm font-semibold">Active</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Inactive codes cannot be redeemed
                </div>
              </div>
              <button
                type="button"
                aria-label="Toggle active"
                onClick={() => set("is_active", !draft.is_active)}
                className={`relative h-6 w-11 rounded-full transition-colors ${draft.is_active ? "bg-primary" : "bg-muted"}`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${draft.is_active ? "left-5" : "left-0.5"}`}
                />
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-border">
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={save}
              disabled={saving}
              className="bg-gradient-primary text-primary-foreground shadow-glow gap-2"
            >
              <Tag className="size-4" />
              {saving ? "Saving…" : editing ? "Save changes" : "Create code"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            tabIndex={-1}
            aria-label="Close"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setDeleteId(null)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setDeleteId(null);
            }}
          />
          <div className="relative z-10 rounded-2xl border border-border bg-card p-6 max-w-sm w-full space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="size-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Delete promo code?</p>
                <p className="text-sm text-muted-foreground mt-1">
                  This cannot be undone. Hosts who already redeemed it won't be affected.
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setDeleteId(null)}>
                Cancel
              </Button>
              <Button
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => void deleteCode(deleteId)}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
