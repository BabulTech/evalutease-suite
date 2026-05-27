import React, { useEffect, useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import {
  Search,
  RefreshCw,
  Filter,
  Building2,
  Users,
  ChevronDown,
  ChevronRight,
  PlayCircle,
  BookOpen,
  UsersRound,
  Pencil,
  Trash2,
  ShieldOff,
  ShieldCheck,
  X,
  Save,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PaginationControls } from "@/components/PaginationControls";
import { TableShell, THead, SkeletonRows, SectionHead } from "./-shared";
import { planBadge, statusBadge, fmtDate, fmtDateShort } from "./helpers";

export type UserRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  organization: string | null;
  country: string | null;
  mobile: string | null;
  created_at: string;
  plan_slug: string;
  sub_status: string;
  session_count: number;
  question_count: number;
  participant_count: number;
};

type CompanyGroup = {
  company_id: string;
  company_name: string;
  admin_user_id: string;
  member_user_ids: string[];
};

function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4">
        <p className="text-sm font-medium">{message}</p>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted/40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl bg-destructive text-destructive-foreground text-sm font-semibold hover:bg-destructive/90"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

function UserDetailPanel({
  user,
  onChangePlan,
  onSuspend,
  onUnsuspend,
  onDelete,
  onBack,
}: {
  user: UserRow;
  onChangePlan: (userId: string, slug: string) => void;
  onSuspend: (userId: string) => Promise<void>;
  onUnsuspend: (userId: string) => Promise<void>;
  onDelete: (userId: string) => Promise<void>;
  onBack: () => void;
}) {
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({
    full_name: user.full_name ?? "",
    organization: user.organization ?? "",
    mobile: user.mobile ?? "",
    country: user.country ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<null | "delete" | "suspend" | "unsuspend">(null);
  const isSuspended = user.sub_status === "suspended";
  const [subDetails, setSubDetails] = useState<{
    plan_name: string;
    status: string;
    started_at: string | null;
    expires_at: string | null;
    plan_limits: Record<string, number>;
    plan_features: string[];
  } | null>(null);
  const [payments, setPayments] = useState<
    { amount_pkr: number; status: string; created_at: string; payment_method: string }[]
  >([]);
  const [recentSessions, setRecentSessions] = useState<
    { id: string; title: string; status: string; created_at: string }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const [subRes, payRes, sessRes] = await Promise.all([
        // react-doctor-disable-next-line react-doctor/no-event-handler
        supabase
          .from("user_subscriptions")
          .select(
            "*, plans(name, credits_per_month, quizzes_per_day, participants_per_session, sessions_total, features_list)",
          )
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("manual_payments")
          .select("amount_pkr, status, created_at, payment_method")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("quiz_sessions")
          .select("id, title, status, created_at")
          .eq("owner_id", user.id)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);
      if (subRes.data) {
        const raw = subRes.data as unknown as Record<string, unknown>;
        const plan = (raw.plans ?? null) as Record<string, unknown> | null;
        setSubDetails({
          plan_name: (plan?.name as string) ?? user.plan_slug,
          status: (raw.status as string) ?? "-",
          started_at: (raw.started_at as string | null) ?? null,
          expires_at: (raw.expires_at as string | null) ?? null,
          plan_limits: {
            quizzes_per_day: (plan?.quizzes_per_day as number) ?? 0,
            participants_per_session: (plan?.participants_per_session as number) ?? 0,
            sessions_total: (plan?.sessions_total as number) ?? 0,
            credits_per_month: (plan?.credits_per_month as number) ?? 0,
          },
          plan_features: (plan?.features_list as string[]) ?? [],
        });
      }
      setPayments(
        (payRes.data ?? []) as unknown as {
          amount_pkr: number;
          status: string;
          created_at: string;
          payment_method: string;
        }[],
      );
      setRecentSessions(sessRes.data ?? []);
      setLoading(false);
    })();
  }, [user.id, user.plan_slug]);

  const saveEdit = async () => {
    setSaving(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("profiles") as any)
      .update({ ...editData, updated_at: new Date().toISOString() })
      .eq("id", user.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Profile updated");
    setEditMode(false);
    Object.assign(user, editData);
  };

  const limitLabels: Record<string, string> = {
    quizzes_per_day: "Quizzes / day",
    participants_per_session: "Participants / session",
    sessions_total: "Total sessions",
    credits_per_month: "Credits / month",
  };

  return (
    <div className="space-y-5">
      {confirm && (
        <ConfirmDialog
          message={
            confirm === "delete"
              ? `Permanently delete ${user.full_name ?? user.email}? This cannot be undone.`
              : confirm === "suspend"
                ? `Suspend ${user.full_name ?? user.email}? They will lose access immediately.`
                : `Unsuspend ${user.full_name ?? user.email}? They will regain access.`
          }
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            setConfirm(null);
            if (confirm === "delete") { await onDelete(user.id); onBack(); }
            else if (confirm === "suspend") await onSuspend(user.id);
            else await onUnsuspend(user.id);
          }}
        />
      )}

      <div className="flex items-center gap-4">
        <div className="size-16 rounded-2xl bg-primary/15 flex items-center justify-center text-primary font-bold text-2xl shrink-0">
          {(user.full_name ?? user.email ?? "?").charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display font-bold text-lg">{user.full_name ?? "-"}</div>
          <div className="text-sm text-muted-foreground">{user.email ?? "-"}</div>
          <div className="flex items-center gap-2 mt-1">
            {planBadge(user.plan_slug)}
            {statusBadge(user.sub_status)}
          </div>
        </div>
        {/* Action buttons */}
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            title="Edit profile"
            onClick={() => setEditMode((v) => !v)}
            className="p-2 rounded-xl border border-border hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors"
          >
            {editMode ? <X className="size-4" /> : <Pencil className="size-4" />}
          </button>
          <button
            type="button"
            title={isSuspended ? "Unsuspend" : "Suspend"}
            onClick={() => setConfirm(isSuspended ? "unsuspend" : "suspend")}
            className={`p-2 rounded-xl border transition-colors ${isSuspended ? "border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10" : "border-warning/40 text-warning hover:bg-warning/10"}`}
          >
            {isSuspended ? <ShieldCheck className="size-4" /> : <ShieldOff className="size-4" />}
          </button>
          <button
            type="button"
            title="Delete user"
            onClick={() => setConfirm("delete")}
            className="p-2 rounded-xl border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      {/* Edit form */}
      {editMode && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
          <p className="text-xs font-semibold text-primary uppercase tracking-wider">Edit Profile</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {([
              ["Full Name", "full_name", "text"],
              ["Organisation", "organization", "text"],
              ["Mobile", "mobile", "tel"],
              ["Country", "country", "text"],
            ] as [string, keyof typeof editData, string][]).map(([label, key, type]) => (
              <div key={key}>
                <label htmlFor={`edit-${key}`} className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">{label}</label>
                <input
                  id={`edit-${key}`}
                  type={type}
                  title={label}
                  placeholder={label}
                  value={editData[key]}
                  onChange={(e) => setEditData((d) => ({ ...d, [key]: e.target.value }))}
                  className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            ))}
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={saveEdit}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-60"
          >
            <Save className="size-3.5" /> {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card/40 p-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Profile Details
        </div>
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              ["Organization", user.organization],
              ["Country", user.country],
              ["Mobile", user.mobile],
              ["Joined", fmtDate(user.created_at)],
            ] as [string, string | null][]
          ).map(([l, v]) => (
            <div key={l} className="space-y-0.5">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{l}</div>
              <div className="text-xs font-medium">{v ?? "-"}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {(
          [
            ["Sessions", user.session_count, PlayCircle],
            ["Questions", user.question_count, BookOpen],
            ["Participants", user.participant_count, UsersRound],
          ] as [string, number, React.ElementType][]
        ).map(([l, v, Icon]) => (
          <div key={l} className="rounded-xl border border-border bg-card/40 p-3 text-center">
            <Icon className="size-4 text-primary mx-auto mb-1" />
            <div className="font-display text-xl font-bold text-primary">{v}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{l}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {subDetails && (
            <div className="rounded-xl border border-primary/30 bg-card/40 p-4 space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Subscription
              </div>
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    ["Plan", subDetails.plan_name],
                    ["Status", subDetails.status],
                    ["Started", subDetails.started_at ? fmtDate(subDetails.started_at) : "-"],
                    ["Expires", subDetails.expires_at ? fmtDate(subDetails.expires_at) : "-"],
                  ] as [string, string][]
                ).map(([l, v]) => (
                  <div key={l} className="space-y-0.5">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      {l}
                    </div>
                    <div className="text-xs font-medium capitalize">{v ?? "-"}</div>
                  </div>
                ))}
              </div>
              {Object.keys(subDetails.plan_limits).length > 0 && (
                <div className="pt-1 border-t border-border/40 space-y-2">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Plan Limits
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(subDetails.plan_limits).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">{limitLabels[k] ?? k}</span>
                        <span className="font-semibold">{v === -1 ? "∞" : v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {payments.length > 0 && (
            <div className="rounded-xl border border-border bg-card/40 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Payment History
              </div>
              <div className="divide-y divide-border/40">
                {payments.map((p) => (
                  <div
                    key={p.created_at}
                    className="px-4 py-2.5 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-medium capitalize">
                        {p.payment_method.replace("_", " ")}
                      </div>
                      <div className="text-muted-foreground">{fmtDate(p.created_at)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">PKR {p.amount_pkr.toLocaleString()}</span>
                      {statusBadge(p.status)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {recentSessions.length > 0 && (
            <div className="rounded-xl border border-border bg-card/40 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Recent Quiz Sessions
              </div>
              <div className="divide-y divide-border/40">
                {recentSessions.map((s) => (
                  <div key={s.id} className="px-4 py-2.5 flex items-center justify-between text-xs">
                    <div className="font-medium truncate max-w-48">{s.title}</div>
                    <div className="flex items-center gap-2 shrink-0">
                      {statusBadge(s.status)}
                      <span className="text-muted-foreground">{fmtDateShort(s.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div className="rounded-xl border border-border bg-card/40 p-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Change Plan
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { s: "individual_starter", label: "Ind. Free" },
            { s: "individual_pro", label: "Ind. Pro" },
            { s: "enterprise_free", label: "Org Free" },
            { s: "enterprise_pro", label: "Org Pro" },
          ].map(({ s, label }) => (
            <button
              key={s}
              type="button"
              onClick={() => onChangePlan(user.id, s)}
              className={`flex-1 text-xs py-2 rounded-xl border font-medium transition-colors ${user.plan_slug === s ? "bg-primary/20 border-primary/40 text-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:text-primary"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// react-doctor-disable-next-line react-doctor/prefer-useReducer
// react-doctor-disable-next-line react-doctor/no-giant-component
export function UsersSection() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [companies, setCompanies] = useState<CompanyGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [detail, setDetail] = useState<UserRow | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [indPage, setIndPage] = useState(0);
  const IND_PAGE_SIZE = 20;

  const load = useCallback(async () => {
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profiles, error: profilesError } = await (supabase as any)
      .from("profiles")
      .select("id,full_name,email,organization,country,mobile,created_at")
      .order("created_at", { ascending: false });
    if (profilesError) {
      toast.error("Failed to load users: " + profilesError.message);
      setLoading(false);
      return;
    }
    if (!profiles?.length) {
      setUsers([]);
      setLoading(false);
      return;
    }
    const ids = profiles.map((p) => p.id);

    const [
      { data: subs },
      { data: sess },
      { data: qs },
      { data: parts },
      { data: cps },
      { data: cms },
    ] = await Promise.all([
      supabase.from("user_subscriptions").select("user_id,status,plans(slug)").in("user_id", ids),
      supabase.from("quiz_sessions").select("owner_id").in("owner_id", ids),
      supabase.from("questions").select("owner_id").in("owner_id", ids),
      supabase.from("participants").select("owner_id").in("owner_id", ids),
      supabase.from("company_profiles").select("id, admin_user_id, company_name"),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from("company_members") as any)
        .select("user_id, company_id, status")
        .eq("status", "active"),
    ]);

    const subMap: Record<string, { slug: string; status: string }> = {};
    (subs ?? []).forEach((s) => {
      subMap[s.user_id] = {
        slug: (s.plans as { slug: string } | null)?.slug ?? "free",
        status: s.status,
      };
    });
    const cnt = (arr: { owner_id?: string }[] | null, id: string) =>
      (arr ?? []).filter((x) => x.owner_id === id).length;

    setRows(
      profiles.map((p) => ({
        ...p,
        plan_slug: subMap[p.id]?.slug ?? "free",
        sub_status: subMap[p.id]?.status ?? "active",
        session_count: cnt(sess, p.id),
        question_count: cnt(qs, p.id),
        participant_count: cnt(parts, p.id),
      })),
    );

    const memberByCompany: Record<string, string[]> = {};
    ((cms ?? []) as { user_id: string | null; company_id: string }[]).forEach((m) => {
      if (m.user_id && m.company_id) (memberByCompany[m.company_id] ||= []).push(m.user_id);
    });
    setCompanies(
      ((cps ?? []) as { id: string; admin_user_id: string; company_name: string }[]).map((c) => ({
        company_id: c.id,
        company_name: c.company_name,
        admin_user_id: c.admin_user_id,
        member_user_ids: memberByCompany[c.id] ?? [],
      })),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const suspendUser = async (userId: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("admin_suspend_user", { p_user_id: userId });
    if (error) { toast.error("Failed to suspend: " + error.message); return; }
    toast.success("User suspended");
    void load();
  };

  const unsuspendUser = async (userId: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("admin_unsuspend_user", { p_user_id: userId });
    if (error) { toast.error("Failed to unsuspend: " + error.message); return; }
    toast.success("User unsuspended");
    void load();
  };

  const deleteUser = async (userId: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("admin_delete_user", { p_user_id: userId });
    if (error) { toast.error("Failed to delete: " + error.message); return; }
    toast.success("User deleted");
    void load();
  };

  const changePlan = async (userId: string, slug: string) => {
    const { data: plan } = await supabase
      .from("plans")
      .select("id")
      .eq(
        "slug",
        slug as
          | "individual_starter"
          | "individual_pro"
          | "enterprise_free"
          | "enterprise_pro",
      )
      .maybeSingle();
    if (!plan) return;
    // admin_assign_plan is SECURITY DEFINER — it updates both user_subscriptions
    // AND profiles.selected_plan in one atomic call, bypassing RLS.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("admin_assign_plan", {
      p_user_id: userId,
      p_plan_slug: slug,
    });
    if (error) { toast.error("Failed to update plan: " + error.message); return; }
    toast.success("Plan updated");
    // Immediately update the open detail panel so the badge/buttons reflect the change
    setDetail((prev) => prev?.id === userId ? { ...prev, plan_slug: slug } : prev);
    void load();
  };

  const filtered = useMemo(() => {
    let r = rows;
    if (search) {
      const q = search.toLowerCase();
      r = r.filter((u) =>
        [u.full_name, u.email, u.organization].some((v) => v?.toLowerCase().includes(q)),
      );
    }
    if (planFilter !== "all") r = r.filter((u) => u.plan_slug === planFilter);
    return r;
  }, [rows, search, planFilter]);

  const grouped = useMemo(() => {
    const byId = new Map(filtered.map((r) => [r.id, r] as const));
    const used = new Set<string>();
    const groups: Array<{
      company_id: string;
      company_name: string;
      admin: UserRow | null;
      members: UserRow[];
    }> = [];
    const sortedCompanies = companies.toSorted((a, b) =>
      a.company_name.localeCompare(b.company_name),
    );
    for (const c of sortedCompanies) {
      const admin = byId.get(c.admin_user_id) ?? null;
      if (admin) used.add(admin.id);
      const members = c.member_user_ids.flatMap((id) => {
        const m = byId.get(id);
        return m ? [m] : [];
      });
      members.forEach((m) => used.add(m.id));
      if (admin || members.length > 0)
        groups.push({ company_id: c.company_id, company_name: c.company_name, admin, members });
    }
    const independent = filtered.filter((u) => !used.has(u.id));
    return { groups, independent };
  }, [filtered, companies]);

  const toggleGroup = (companyId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(companyId)) next.delete(companyId);
      else next.add(companyId);
      return next;
    });
  };

  const renderUserRow = (u: UserRow, indent: "none" | "host" = "none") => (
    <tr
      key={u.id}
      className="hover:bg-muted/10 transition-colors cursor-pointer"
      onClick={() => setDetail(u)}
    >
      <td className="px-4 py-3">
        <div className={`flex items-center gap-2.5 ${indent === "host" ? "pl-8" : ""}`}>
          <div className="size-8 rounded-full bg-primary/15 flex items-center justify-center text-primary text-xs font-bold shrink-0">
            {(u.full_name ?? u.email ?? "?").charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="text-xs font-medium flex items-center gap-1.5">
              {u.full_name ?? "-"}
              {indent === "host" && (
                <Badge className="bg-blue-500/10 text-blue-600 border-0 text-[9px] px-1.5 py-0">
                  Host
                </Badge>
              )}
            </div>
            <div className="text-[11px] text-muted-foreground">{u.email ?? "-"}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">
        {[u.organization, u.country].filter(Boolean).join(" · ") || "-"}
      </td>
      <td className="px-4 py-3">
        {indent === "host" ? (
          <span className="text-[10px] text-muted-foreground italic">via org</span>
        ) : (
          planBadge(u.plan_slug)
        )}
      </td>
      <td className="px-4 py-3 text-xs font-medium text-center">{u.session_count}</td>
      <td className="px-4 py-3 text-xs font-medium text-center">{u.question_count}</td>
      <td className="px-4 py-3 text-xs font-medium text-center">{u.participant_count}</td>
      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
        {fmtDate(u.created_at)}
      </td>
      <td className="px-4 py-3">
        {indent === "host" ? (
          <span className="text-[10px] text-muted-foreground italic">managed by org</span>
        ) : (
          <div
            role="presentation"
            className="flex gap-1"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {[
              { s: "individual_starter", label: "Free" },
              { s: "individual_pro", label: "Pro" },
              { s: "enterprise_pro", label: "Org" },
            ].map(({ s, label }) => (
              <button
                key={s}
                type="button"
                title={`Set ${s}`}
                onClick={() => void changePlan(u.id, s)}
                className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${u.plan_slug === s ? "bg-primary/20 border-primary/30 text-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:text-primary"}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </td>
    </tr>
  );

  if (detail) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setDetail(null)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-xl px-3 py-1.5 hover:bg-muted/40"
          >
            <ChevronRight className="size-4 rotate-180" /> Back to Users
          </button>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-sm font-medium truncate">
            {detail.full_name ?? detail.email ?? "User"}
          </span>
        </div>
        <UserDetailPanel
          user={detail}
          onChangePlan={changePlan}
          onSuspend={suspendUser}
          onUnsuspend={unsuspendUser}
          onDelete={deleteUser}
          onBack={() => setDetail(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SectionHead
        title="Hosts & Teachers"
        sub={`${rows.length} registered hosts on the platform.`}
      />
      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto_auto] gap-3">
        <div className="relative min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search name, email, org…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={planFilter} onValueChange={setPlanFilter}>
          <SelectTrigger className="w-full sm:w-44 h-11 sm:h-9">
            <Filter className="size-4 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All plans</SelectItem>
            <SelectItem value="individual_starter">Individual Free</SelectItem>
            <SelectItem value="individual_pro">Individual Pro</SelectItem>
            <SelectItem value="enterprise_free">Org Free</SelectItem>
            <SelectItem value="enterprise_pro">Org Pro</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          onClick={() => void load()}
          className="size-11 sm:h-8 sm:w-8 shrink-0"
          title="Refresh"
        >
          <RefreshCw className="size-4" />
        </Button>
      </div>

      <TableShell
        footer={`${filtered.length} of ${rows.length} users · ${grouped.groups.length} companies`}
      >
        <THead
          cols={[
            "User",
            "Org / Country",
            "Plan",
            "Sessions",
            "Questions",
            "Participants",
            "Joined",
            "",
          ]}
        />
        <tbody className="divide-y divide-border/40">
          {loading ? (
            <SkeletonRows cols={8} />
          ) : filtered.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">
                No users found.
              </td>
            </tr>
          ) : (
            <>
              {grouped.groups.map((g) => {
                const isCollapsed = collapsed.has(g.company_id);
                return (
                  <React.Fragment key={`co-${g.company_id}`}>
                    <tr
                      className="bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer"
                      onClick={() => toggleGroup(g.company_id)}
                    >
                      <td colSpan={8} className="px-4 py-2">
                        <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                          {isCollapsed ? (
                            <ChevronRight className="size-3.5" />
                          ) : (
                            <ChevronDown className="size-3.5" />
                          )}
                          <Building2 className="size-3.5" />
                          <span>{g.company_name}</span>
                          <span className="text-muted-foreground font-normal">·</span>
                          <span className="text-muted-foreground font-normal">
                            {g.members.length} host{g.members.length === 1 ? "" : "s"}
                          </span>
                        </div>
                      </td>
                    </tr>
                    {!isCollapsed && g.admin && renderUserRow(g.admin, "none")}
                    {!isCollapsed && g.members.map((m) => renderUserRow(m, "host"))}
                  </React.Fragment>
                );
              })}
              {grouped.independent.length > 0 && (
                <>
                  <tr className="bg-muted/30">
                    <td colSpan={8} className="px-4 py-2">
                      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                        <Users className="size-3.5" />
                        <span>Individual Users</span>
                        <span className="font-normal">·</span>
                        <span className="font-normal">{grouped.independent.length}</span>
                      </div>
                    </td>
                  </tr>
                  {grouped.independent
                    .slice(indPage * IND_PAGE_SIZE, indPage * IND_PAGE_SIZE + IND_PAGE_SIZE)
                    .map((u) => renderUserRow(u, "none"))}
                </>
              )}
            </>
          )}
        </tbody>
      </TableShell>
      <PaginationControls
        page={indPage}
        pageSize={IND_PAGE_SIZE}
        total={grouped.independent.length}
        label="individual users"
        onPageChange={setIndPage}
      />
    </div>
  );
}
