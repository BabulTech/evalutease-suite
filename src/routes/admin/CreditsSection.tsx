import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { validationError } from "@/components/ui/validation-toast";
import {
  Search,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Wallet,
  Coins,
  PlusCircle,
  MinusCircle,
  Zap,
  Edit2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

// react-doctor-disable-next-line react-doctor/prefer-useReducer
// react-doctor-disable-next-line react-doctor/no-giant-component
export function CreditsSection() {
  const { user: adminUser } = useAuth();
  type UserRow = {
    user_id: string;
    email: string;
    name: string;
    balance: number;
    total_earned: number;
    total_spent: number;
    plan_name: string;
  };
  type TxRow = {
    id: string;
    user_id: string;
    type: string;
    amount: number;
    description: string | null;
    created_at: string;
    user_name: string;
  };
  type CostRow = {
    id: string;
    name: string;
    slug: string;
    credit_cost_ai_10q: number;
    credit_cost_ai_scan: number;
    credit_cost_ai_tf_10q: number;
    credit_cost_ai_short_10q: number;
    credit_cost_ai_long_10q: number;
    credit_cost_ai_mix_10q: number;
    credit_cost_ai_grade_short: number;
    credit_cost_ai_grade_long: number;
    credit_cost_session_launch: number;
    credit_cost_export: number;
    credit_cost_extra_quiz: number;
    credit_cost_extra_participants: number;
  };

  const [users, setUsers] = useState<UserRow[]>([]);
  const [txHistory, setTxHistory] = useState<TxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [adjustType, setAdjustType] = useState<"add" | "deduct">("add");
  const [saving, setSaving] = useState(false);
  const [showTx, setShowTx] = useState(false);
  const [costPlans, setCostPlans] = useState<CostRow[]>([]);
  const [editingCosts, setEditingCosts] = useState<CostRow | null>(null);
  const [savingCosts, setSavingCosts] = useState(false);

  const loadCosts = useCallback(async () => {
    const { data } = await supabase
      .from("plans")
      .select(
        "id, name, slug, credit_cost_ai_10q, credit_cost_ai_scan, credit_cost_ai_tf_10q, credit_cost_ai_short_10q, credit_cost_ai_long_10q, credit_cost_ai_mix_10q, credit_cost_ai_grade_short, credit_cost_ai_grade_long, credit_cost_session_launch, credit_cost_export, credit_cost_extra_quiz, credit_cost_extra_participants",
      )
      .order("sort_order");
    if (data) setCostPlans(data as CostRow[]);
  }, []);

  const saveCosts = async () => {
    if (!editingCosts) return;
    setSavingCosts(true);
    const { error } = await supabase
      .from("plans")
      .update({
        credit_cost_ai_10q: editingCosts.credit_cost_ai_10q,
        credit_cost_ai_scan: editingCosts.credit_cost_ai_scan,
        credit_cost_ai_tf_10q: editingCosts.credit_cost_ai_tf_10q,
        credit_cost_ai_short_10q: editingCosts.credit_cost_ai_short_10q,
        credit_cost_ai_long_10q: editingCosts.credit_cost_ai_long_10q,
        credit_cost_ai_mix_10q: editingCosts.credit_cost_ai_mix_10q,
        credit_cost_ai_grade_short: editingCosts.credit_cost_ai_grade_short,
        credit_cost_ai_grade_long: editingCosts.credit_cost_ai_grade_long,
        credit_cost_session_launch: editingCosts.credit_cost_session_launch,
        credit_cost_export: editingCosts.credit_cost_export,
        credit_cost_extra_quiz: editingCosts.credit_cost_extra_quiz,
        credit_cost_extra_participants: editingCosts.credit_cost_extra_participants,
      })
      .eq("id", editingCosts.id);
    setSavingCosts(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Credit costs updated for ${editingCosts.name}`);
    setEditingCosts(null);
    void loadCosts();
  };

  const load = useCallback(async () => {
    setLoading(true);
    const { data: credits } = await supabase
      .from("user_credits")
      .select("user_id, balance, total_earned, total_spent")
      .order("balance", { ascending: false });
    if (!credits) {
      setLoading(false);
      return;
    }

    const userIds = credits.map((c) => c.user_id);
    const [profilesRes, subsRes] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email").in("id", userIds),
      supabase
        .from("user_subscriptions")
        .select("user_id, plans(name)")
        .in("user_id", userIds)
        .eq("status", "active"),
    ]);
    const profileMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p]));
    const subMap = new Map(
      (subsRes.data ?? []).map((s) => [
        s.user_id,
        (s.plans as { name: string } | null)?.name ?? "Starter",
      ]),
    );

    setUsers(
      credits.map((c) => ({
        user_id: c.user_id,
        email: profileMap.get(c.user_id)?.email ?? c.user_id,
        name: profileMap.get(c.user_id)?.full_name ?? "Unknown",
        balance: c.balance,
        total_earned: c.total_earned,
        total_spent: c.total_spent,
        plan_name: subMap.get(c.user_id) ?? "Starter",
      })),
    );
    setLoading(false);
  }, []);

  const loadTx = useCallback(async () => {
    const { data } = await supabase
      .from("credit_transactions")
      .select("id, user_id, type, amount, description, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (!data) return;
    const ids = [...new Set(data.map((t) => t.user_id))];
    const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
    const pMap = new Map((profs ?? []).map((p) => [p.id, p.full_name ?? "Unknown"]));
    setTxHistory(data.map((t) => ({ ...t, user_name: pMap.get(t.user_id) ?? t.user_id })));
  }, []);

  useEffect(() => {
    void load();
    void loadTx();
    void loadCosts();
  }, [load, loadTx, loadCosts]);

  const handleAdjust = async () => {
    if (!selectedUser || !adjustAmount || !adminUser) return;
    const amt = parseInt(adjustAmount);
    if (isNaN(amt) || amt <= 0) {
      validationError("Enter a valid positive amount");
      return;
    }
    if (amt > 50000) {
      validationError("Single adjustment capped at 50,000 credits");
      return;
    }
    setSaving(true);
    try {
      const { data: ok, error } = await supabase.rpc("admin_adjust_credits", {
        p_user_id: selectedUser.user_id,
        p_amount: amt,
        p_direction: adjustType,
        p_description:
          adjustNote || `Admin ${adjustType === "add" ? "added" : "deducted"} ${amt} credits`,
      });
      if (error) throw error;
      if (!ok && adjustType === "deduct") {
        toast.error("Insufficient balance to deduct");
        setSaving(false);
        return;
      }
      toast.success(
        `${adjustType === "add" ? "+" : "-"}${amt} credits ${adjustType === "add" ? "added to" : "deducted from"} ${selectedUser.name}`,
      );
      setSelectedUser(null);
      setAdjustAmount("");
      setAdjustNote("");
      void load();
      void loadTx();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const TX_LABEL: Record<string, string> = {
    plan_refill: "Plan Refill",
    manual_topup: "Manual Top-up",
    payment_approved: "Payment Approved",
    ai_question_gen: "AI Question Gen",
    ai_image_scan: "AI Image Scan",
    admin_adjustment: "Admin Adjustment",
    extra_quiz: "Extra Quiz",
    extra_participants: "Extra Participants",
    expiry: "Expired",
  };

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold">Credits Management</h2>
          <p className="text-sm text-muted-foreground">
            View balances, manually add or deduct credits for any user
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTx(!showTx)}
            className="gap-1.5"
          >
            <TrendingUp className="size-4" /> {showTx ? "Hide" : "Show"} Transactions
          </Button>
          <Button variant="outline" size="sm" onClick={() => void load()} className="gap-1.5">
            <RefreshCw className="size-4" /> Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl border border-warning/30 bg-warning/5 p-4 flex items-center gap-3">
          <Wallet className="size-8 text-warning/60" />
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Total Credits in Circulation
            </div>
            <div className="font-display text-2xl font-bold text-warning">
              {users.reduce((s, u) => s + u.balance, 0).toLocaleString()}
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-success/30 bg-success/5 p-4 flex items-center gap-3">
          <TrendingUp className="size-8 text-success/60" />
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Total Ever Earned
            </div>
            <div className="font-display text-2xl font-bold text-success">
              {users.reduce((s, u) => s + u.total_earned, 0).toLocaleString()}
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card/60 p-4 flex items-center gap-3">
          <TrendingDown className="size-8 text-muted-foreground/60" />
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Total Ever Spent
            </div>
            <div className="font-display text-2xl font-bold">
              {users.reduce((s, u) => s + u.total_spent, 0).toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search user..."
          className="pl-9"
        />
      </div>

      <div className="rounded-2xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b border-border">
            <tr>
              {["User", "Plan", "Balance", "Earned", "Spent", "Actions"].map((h) => (
                <th
                  key={h}
                  className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground ${["Balance", "Earned", "Spent"].includes(h) ? "text-right" : "text-left"}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No users found
                </td>
              </tr>
            ) : (
              filtered.map((u) => (
                <tr key={u.user_id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium">{u.name}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                      {u.plan_name}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-bold text-warning">{u.balance}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-success text-xs">+{u.total_earned}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground text-xs">
                    -{u.total_spent}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        variant="default"
                        className="h-7 px-2 text-[11px] gap-1 bg-success hover:bg-success/90 text-white"
                        onClick={() => {
                          setSelectedUser(u);
                          setAdjustType("add");
                        }}
                      >
                        <PlusCircle className="size-3" /> Add
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-7 px-2 text-[11px] gap-1"
                        onClick={() => {
                          setSelectedUser(u);
                          setAdjustType("deduct");
                        }}
                      >
                        <MinusCircle className="size-3" /> Deduct
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog
        open={!!selectedUser}
        onOpenChange={(o) => {
          if (!o) setSelectedUser(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {adjustType === "add" ? (
                <>
                  <PlusCircle className="size-5 text-success" /> Add Credits
                </>
              ) : (
                <>
                  <MinusCircle className="size-5 text-destructive" /> Deduct Credits
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            {selectedUser && (
              <div className="rounded-xl border border-border bg-muted/20 px-4 py-3 text-sm">
                <div className="font-semibold">{selectedUser.name}</div>
                <div className="text-muted-foreground text-xs">{selectedUser.email}</div>
                <div className="mt-1 flex items-center gap-2">
                  <Coins className="size-3.5 text-warning" />
                  <span className="text-warning font-bold">{selectedUser.balance} credits</span>
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Amount (credits)
              </span>
              <Input
                type="number"
                min={1}
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
                placeholder="e.g. 100"
              />
            </div>
            <div className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Note (optional)
              </span>
              <Input
                value={adjustNote}
                onChange={(e) => setAdjustNote(e.target.value)}
                placeholder="Reason for adjustment..."
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => setSelectedUser(null)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                className={`flex-1 gap-1 ${adjustType === "add" ? "bg-success hover:bg-success/90 text-white" : ""}`}
                variant={adjustType === "deduct" ? "destructive" : "default"}
                onClick={() => void handleAdjust()}
                disabled={saving || !adjustAmount}
              >
                {saving
                  ? "Saving…"
                  : adjustType === "add"
                    ? `+${adjustAmount || 0} credits`
                    : `-${adjustAmount || 0} credits`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {showTx && (
        <div className="rounded-2xl border border-border overflow-hidden">
          <div className="px-4 py-3 bg-muted/40 border-b border-border flex items-center gap-2">
            <Coins className="size-4 text-primary" />
            <span className="font-semibold text-sm">Recent Transactions (last 50)</span>
          </div>
          <div className="divide-y divide-border max-h-96 overflow-y-auto">
            {txHistory.map((tx) => {
              const isAdd = tx.amount > 0;
              return (
                <div
                  key={tx.id}
                  className="px-4 py-3 flex items-center gap-3 hover:bg-muted/20 transition-colors"
                >
                  <div
                    className={`rounded-lg p-1.5 shrink-0 ${isAdd ? "bg-success/15" : "bg-warning/15"}`}
                  >
                    {isAdd ? (
                      <TrendingUp className="size-3.5 text-success" />
                    ) : (
                      <TrendingDown className="size-3.5 text-warning" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{tx.user_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {TX_LABEL[tx.type] ?? tx.type}
                      {tx.description ? `, ${tx.description}` : ""}
                    </div>
                  </div>
                  <div
                    className={`text-sm font-bold shrink-0 ${isAdd ? "text-success" : "text-warning"}`}
                  >
                    {isAdd ? "+" : ""}
                    {tx.amount}
                  </div>
                  <div className="text-[10px] text-muted-foreground shrink-0">
                    {new Date(tx.created_at).toLocaleDateString()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Credit cost configuration per plan */}
      <div className="rounded-2xl border border-border overflow-hidden">
        <div className="px-5 py-3 bg-muted/40 border-b border-border flex items-center gap-2">
          <Zap className="size-4 text-primary" />
          <span className="font-semibold text-sm">Credit Cost Settings per Plan</span>
        </div>

        {costPlans.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Loading plans…</div>
        ) : (
          <Tabs defaultValue={costPlans[0]?.id} className="w-full">
            <TabsList className="w-full justify-start rounded-none border-b border-border bg-muted/20 px-4 gap-1 h-10">
              {costPlans.map((plan) => (
                <TabsTrigger
                  key={plan.id}
                  value={plan.id}
                  onClick={() => setEditingCosts(null)}
                  className="text-xs h-8 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  {plan.name}
                </TabsTrigger>
              ))}
            </TabsList>

            {costPlans.map((plan) => {
              const isEditing = editingCosts?.id === plan.id;
              const row = isEditing ? editingCosts! : plan;

              const numInput = (field: keyof CostRow, label: string) => (
                <div key={field} className="flex flex-col gap-1.5">
                  <span className="text-[10px] text-muted-foreground leading-tight">{label}</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      aria-label={label}
                      value={row[field] as number}
                      readOnly={!isEditing}
                      onChange={(e) =>
                        isEditing &&
                        setEditingCosts({
                          ...editingCosts!,
                          [field]: parseInt(e.target.value) || 0,
                        })
                      }
                      className={`w-16 text-center rounded-lg border px-2 py-1.5 text-sm font-bold outline-none transition-colors
                        ${isEditing ? "border-primary bg-primary/5 focus:ring-2 focus:ring-primary/30" : "border-border/50 bg-muted/20 text-foreground cursor-default"}`}
                    />
                    <span className="text-[10px] text-muted-foreground">cr</span>
                  </div>
                </div>
              );

              return (
                <TabsContent key={plan.id} value={plan.id} className="mt-0 p-5 space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-sm">{plan.name}</span>
                      <span className="ml-2 text-[10px] font-mono text-muted-foreground">
                        {plan.slug}
                      </span>
                    </div>
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          className="h-8 px-4 text-xs bg-success hover:bg-success/90 text-white"
                          onClick={() => void saveCosts()}
                          disabled={savingCosts}
                        >
                          {savingCosts ? "Saving…" : "Save changes"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-3 text-xs"
                          onClick={() => setEditingCosts(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-4 text-xs gap-1.5"
                        onClick={() => setEditingCosts({ ...plan })}
                      >
                        <Edit2 className="size-3" /> Edit
                      </Button>
                    )}
                  </div>

                  <div className="rounded-xl border border-border bg-card/40 p-4 space-y-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                      AI Question Generation{" "}
                      <span className="ml-1.5 normal-case font-normal text-muted-foreground">
                        per 10 questions
                      </span>
                    </p>
                    <div className="flex flex-wrap gap-5">
                      {numInput("credit_cost_ai_10q", "MCQ")}
                      {numInput("credit_cost_ai_tf_10q", "True / False")}
                      {numInput("credit_cost_ai_short_10q", "Short Answer")}
                      {numInput("credit_cost_ai_long_10q", "Long Answer")}
                      {numInput("credit_cost_ai_mix_10q", "Mixed")}
                      {numInput("credit_cost_ai_scan", "OCR Scan")}
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-card/40 p-4 space-y-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-warning">
                      AI Answer Grading{" "}
                      <span className="ml-1.5 normal-case font-normal text-muted-foreground">
                        per answer checked
                      </span>
                    </p>
                    <div className="flex flex-wrap gap-5">
                      {numInput("credit_cost_ai_grade_short", "Short Answer")}
                      {numInput("credit_cost_ai_grade_long", "Long Answer")}
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-card/40 p-4 space-y-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Other Actions
                    </p>
                    <div className="flex flex-wrap gap-5">
                      {numInput("credit_cost_session_launch", "Session Launch")}
                      {numInput("credit_cost_export", "Export Report")}
                      {numInput("credit_cost_extra_quiz", "Extra Quiz Slot")}
                      {numInput("credit_cost_extra_participants", "Extra Participants")}
                    </div>
                  </div>

                  <p className="text-[10px] text-muted-foreground">
                    AI Gen cost is per 10 questions, prorated for smaller counts. Set 0 to make an
                    action free.
                  </p>
                </TabsContent>
              );
            })}
          </Tabs>
        )}
      </div>
    </div>
  );
}
