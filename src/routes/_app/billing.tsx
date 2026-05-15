import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Clock,
  CreditCard,
  Upload,
  XCircle,
  Zap,
  Building2,
  Copy,
  Check,
  AlertCircle,
  Wand2,
  ScanLine,
  TrendingUp,
  TrendingDown,
  Coins,
  Wallet,
  Send,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { usePlan, type PlanInfo } from "@/contexts/PlanContext";
import { useHost } from "@/contexts/HostContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_app/billing")({
  validateSearch: (s: Record<string, unknown>) => ({ plan: (s.plan as string) ?? "" }),
  component: BillingPage,
});

type PaymentAccount = {
  id: string;
  method: string;
  title: string;
  account_name: string;
  account_number: string;
  instructions: string | null;
  is_active: boolean;
};

type PaymentHistory = {
  id: string;
  amount_pkr: number;
  payment_method: string;
  status: string;
  credits_to_add: number;
  created_at: string;
  reviewed_at: string | null;
};

type CreditTx = { id: string; type: string; amount: number; description: string | null; created_at: string };

const METHOD_ICONS: Record<string, string> = {
  easypaisa: "💚",
  jazzcash: "🔴",
  bank_transfer: "🏦",
  other: "💳",
};

const TX_LABELS: Record<string, string> = {
  plan_refill: "Monthly Refill",
  manual_topup: "Manual Top-up",
  payment_approved: "Payment Approved",
  ai_question_gen: "AI Questions",
  ai_image_scan: "AI Scan (OCR)",
  ai_interview: "AI Interview",
  ai_coding_test: "AI Coding Test",
  extra_quiz: "Extra Quiz",
  extra_participants: "Extra Participants",
  admin_adjustment: "Admin Adjustment",
  expiry: "Credits Expired",
};

/* ── Collapsible section ── */
function Collapse({ label, icon: Icon, children }: { label: string; icon: React.ElementType; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-border bg-card/50 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold hover:bg-muted/20 transition-colors min-h-[52px]"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary/70" />
          {label}
        </span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-5 pb-5 pt-1 border-t border-border/50">{children}</div>}
    </div>
  );
}

/* ── Step header with back ── */
function StepHeader({ title, sub, onBack }: { title: string; sub: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onBack}
        className="h-9 w-9 rounded-xl border border-border flex items-center justify-center hover:bg-muted/40 transition-colors shrink-0"
        aria-label="Go back"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>
      <div>
        <p className="font-display text-lg font-bold leading-tight">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
      </div>
    </div>
  );
}

/* ── Status chip ── */
function StatusChip({ status }: { status: string }) {
  const cls =
    status === "approved" ? "bg-success/15 text-success" :
    status === "rejected" ? "bg-destructive/15 text-destructive" :
    "bg-warning/15 text-warning";
  const icon =
    status === "approved" ? <CheckCircle2 className="h-3 w-3" /> :
    status === "rejected" ? <XCircle className="h-3 w-3" /> :
    <Clock className="h-3 w-3" />;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${cls}`}>
      {icon} {status}
    </span>
  );
}

/* ─────────────────────────────────────────
   HOST VIEW — simplified credit request
───────────────────────────────────────── */
function HostBillingView({ hostMember, userId, creditTx }: {
  hostMember: import("@/contexts/HostContext").HostInfo;
  userId: string;
  creditTx: CreditTx[];
}) {
  const [reqAmount, setReqAmount] = useState("");
  const [reqNote, setReqNote]     = useState("");
  const [requesting, setRequesting] = useState(false);

  const handleRequest = async () => {
    const amount = parseInt(reqAmount);
    if (!amount || amount <= 0) { toast.error("Enter a valid amount"); return; }
    setRequesting(true);
    const { error } = await (supabase as any).from("credit_requests").insert({
      member_id: hostMember.member_id,
      requester_user_id: userId,
      company_id: hostMember.company_id,
      amount,
      note: reqNote.trim() || null,
      status: "pending",
    });
    setRequesting(false);
    if (error) { toast.error(`Failed: ${error.message}`); return; }
    toast.success("Request sent to your admin!");
    setReqAmount("");
    setReqNote("");
  };

  return (
    <div className="max-w-lg mx-auto space-y-4">
      {/* Hero */}
      <div className="rounded-2xl border border-border bg-card/60 p-5 flex items-center gap-4">
        <div className="h-12 w-12 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center text-primary shadow-glow shrink-0">
          <Wallet className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <h1 className="font-display text-xl font-bold tracking-tight">Credits &amp; Billing</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{hostMember.company_name}</p>
        </div>
      </div>

      {/* Balance */}
      <div className="rounded-2xl border border-warning/30 bg-warning/5 p-6 text-center space-y-1">
        <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Available Credits</p>
        <p className="font-display text-6xl font-bold text-warning">{hostMember.balance}</p>
        <div className="flex justify-center gap-6 text-xs text-muted-foreground mt-2">
          <span>Earned <span className="font-semibold text-success">+{hostMember.total_earned}</span></span>
          <span>Spent <span className="font-semibold text-foreground">−{hostMember.total_spent}</span></span>
        </div>
      </div>

      {/* Request form */}
      <div className="rounded-2xl border border-border bg-card/60 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Send className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-sm">Request Credits from Admin</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Amount</label>
            <input
              type="number" min={1} value={reqAmount}
              onChange={(e) => setReqAmount(e.target.value)}
              placeholder="e.g. 50"
              className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Reason (optional)</label>
            <input
              type="text" value={reqNote}
              onChange={(e) => setReqNote(e.target.value)}
              placeholder="Why you need credits"
              className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>
        <Button
          onClick={handleRequest} disabled={requesting}
          className="w-full h-11 bg-gradient-primary text-primary-foreground shadow-glow gap-2"
        >
          <Send className="h-4 w-4" />
          {requesting ? "Sending…" : "Send Request"}
        </Button>
      </div>

      {/* History */}
      {creditTx.length > 0 && (
        <Collapse label="Credit History" icon={Clock}>
          <ul className="space-y-2 mt-1">
            {creditTx.map((tx) => (
              <li key={tx.id} className="flex items-center justify-between rounded-xl bg-secondary/30 px-4 py-2.5">
                <div>
                  <div className="text-sm font-medium">{TX_LABELS[tx.type] ?? tx.type.replace(/_/g, " ")}</div>
                  <div className="text-[10px] text-muted-foreground">{new Date(tx.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</div>
                </div>
                <span className={`text-sm font-bold ${tx.amount > 0 ? "text-success" : "text-destructive"}`}>
                  {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                </span>
              </li>
            ))}
          </ul>
        </Collapse>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────
   MAIN BILLING PAGE
───────────────────────────────────────── */
const CREDIT_PACKS = [
  { credits: 100,  price_pkr: 250,  label: "Starter",    badge: null,         perCredit: "2.5" },
  { credits: 300,  price_pkr: 650,  label: "Value",      badge: "Popular",    perCredit: "2.2" },
  { credits: 700,  price_pkr: 1300, label: "Power",      badge: "Best Value", perCredit: "1.9" },
  { credits: 1500, price_pkr: 2500, label: "Enterprise", badge: null,         perCredit: "1.7" },
] as const;

function BillingPage() {
  const { user } = useAuth();
  const { plan: currentPlan, credits, allPlans, reload } = usePlan();
  const { plan: planSearch } = Route.useSearch();
  const navigate = useNavigate();
  const { isHost, hostInfo, loading: hostLoading } = useHost();

  const [accounts,  setAccounts]  = useState<PaymentAccount[]>([]);
  const [history,   setHistory]   = useState<PaymentHistory[]>([]);
  const [creditTx,  setCreditTx]  = useState<CreditTx[]>([]);
  const [selectedPlan,   setSelectedPlan]   = useState<PlanInfo | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<string>("");
  const [step,    setStep]    = useState<"overview" | "pick" | "pay" | "upload" | "done">("overview");
  const [pickMode, setPickMode] = useState<"pack" | "plan">("pack");
  const [txRef,   setTxRef]   = useState("");
  const [notes,   setNotes]   = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [uploading,  setUploading]  = useState(false);
  const [copied,  setCopied]  = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const isFreeUser = !currentPlan || currentPlan.slug === "individual_starter";
  const individualPlans  = allPlans.filter((p) => p.tier === "individual"  && p.price_pkr > 0);
  const enterprisePlans  = allPlans.filter((p) => p.tier === "enterprise"  && p.price_pkr > 0);

  useEffect(() => {
    supabase.from("payment_accounts").select("*").eq("is_active", true)
      .then(({ data }) => { if (data) setAccounts(data as PaymentAccount[]); });
    if (user) {
      supabase.from("manual_payments")
        .select("id,amount_pkr,payment_method,status,credits_to_add,created_at,reviewed_at")
        .eq("user_id", user.id).order("created_at", { ascending: false }).limit(10)
        .then(({ data }) => { if (data) setHistory(data as PaymentHistory[]); });
      supabase.from("credit_transactions")
        .select("id,type,amount,description,created_at")
        .eq("user_id", user.id).order("created_at", { ascending: false }).limit(30)
        .then(({ data }) => { if (data) setCreditTx(data as CreditTx[]); });
    }
  }, [user]);

  useEffect(() => {
    if (planSearch && allPlans.length > 0) {
      const found = allPlans.find((p) => p.slug === planSearch);
      if (found) { setSelectedPlan(found); setStep("pay"); }
    }
  }, [planSearch, allPlans]);

  const copyToClipboard = (text: string, key: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleBuyCreditPack = (pack: typeof CREDIT_PACKS[number]) => {
    const fakePlan = {
      ...currentPlan!,
      id: "__credit_pack__",
      name: `${pack.credits} Credits — ${pack.label} Pack`,
      price_pkr: pack.price_pkr,
      credits_per_month: pack.credits,
      slug: currentPlan!.slug,
    } as PlanInfo;
    setSelectedPlan(fakePlan);
    setStep("pay");
  };

  const handleUpload = async () => {
    if (!user || !screenshot || !selectedPlan || !selectedMethod) return;
    setUploading(true);
    // Validate file type client-side (server bucket policy must also enforce this)
    const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
    if (!ALLOWED_TYPES.includes(screenshot.type)) {
      toast.error("Only JPG, PNG, or WebP screenshots are accepted.");
      setUploading(false);
      return;
    }
    const ext  = screenshot.name.split(".").pop()?.toLowerCase() ?? "jpg";
    // Store in private bucket path — no public URL generated
    const path = `payment-screenshots/${user.id}/${Date.now()}.${ext}`;
    const { error: storErr } = await supabase.storage
      .from("uploads")
      .upload(path, screenshot, { contentType: screenshot.type });
    if (storErr) { toast.error("Upload failed: " + storErr.message); setUploading(false); return; }
    // Store the storage path only — admin generates a signed URL when reviewing
    const { error } = await supabase.from("manual_payments").insert({
      user_id:         user.id,
      plan_id:         selectedPlan.id === "__credit_pack__" ? null : selectedPlan.id,
      amount_pkr:      selectedPlan.price_pkr,
      payment_method:  selectedMethod,
      transaction_ref: txRef.trim() || null,
      screenshot_url:  path,       // path only, not a public URL
      status:          "pending",
      credits_to_add:  0,          // server recomputes from plan at approval time
      notes:           notes.trim() || null,
    });
    setUploading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Payment submitted! Admin will verify within 24 hours.");
    setStep("done");
    void reload();
  };

  if (hostLoading) return null;
  if (isHost && hostInfo) return <HostBillingView hostMember={hostInfo} userId={user!.id} creditTx={creditTx} />;

  /* ── Shared hero ── */
  const hero = (
    <div className="rounded-2xl border border-border bg-card/60 p-5 flex flex-wrap items-center gap-4">
      <div className="h-12 w-12 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center text-primary shadow-glow shrink-0">
        <CreditCard className="h-6 w-6" />
      </div>
      <div className="flex-1 min-w-0">
        <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight">Billing &amp; Credits</h1>
        <p className="text-sm text-muted-foreground mt-0.5">PKR payments via EasyPaisa · JazzCash · Bank Transfer</p>
      </div>
      <Link to="/settings" search={{ tab: "plan" }}
        className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors shrink-0 min-h-[36px]">
        <ArrowLeft className="h-3.5 w-3.5" /> Settings
      </Link>
    </div>
  );

  /* ══════════════════════════════════════
     STEP: OVERVIEW
  ══════════════════════════════════════ */
  if (step === "overview") return (
    <div className="max-w-2xl mx-auto space-y-4">
      {hero}

      {/* Balance spotlight */}
      <div className="rounded-2xl border border-warning/30 bg-warning/5 p-6">
        <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold text-center">Your Credit Balance</p>
        <p className="font-display text-7xl font-bold text-warning text-center mt-2 tabular-nums">{credits.balance}</p>
        <div className="flex justify-center gap-8 mt-4 text-xs text-muted-foreground">
          <div className="text-center">
            <p className="font-bold text-success text-base">+{credits.total_earned}</p>
            <p>total earned</p>
          </div>
          <div className="h-8 w-px bg-border self-center" />
          <div className="text-center">
            <p className="font-bold text-foreground text-base">−{credits.total_spent}</p>
            <p>total spent</p>
          </div>
        </div>
        {currentPlan && (
          <p className="text-center text-[11px] text-muted-foreground mt-3">
            Current plan: <span className="font-semibold text-foreground">{currentPlan.name}</span>
          </p>
        )}
      </div>

      {/* Primary action — ONE decision */}
      {isFreeUser ? (
        <button
          type="button"
          onClick={() => { setPickMode("plan"); setStep("pick"); }}
          className="w-full h-14 rounded-2xl bg-gradient-primary text-primary-foreground font-bold text-base shadow-glow flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
        >
          <Zap className="h-5 w-5" /> Choose a Plan to Get Started
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => { setPickMode("pack"); setStep("pick"); }}
            className="h-14 rounded-2xl bg-gradient-primary text-primary-foreground font-bold shadow-glow flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
          >
            <Plus className="h-5 w-5" /> Buy Credits
          </button>
          <button
            type="button"
            onClick={() => { setPickMode("plan"); setStep("pick"); }}
            className="h-14 rounded-2xl border border-border bg-card/60 font-semibold text-sm flex items-center justify-center gap-2 hover:border-primary/40 hover:bg-muted/20 transition-all"
          >
            <Zap className="h-4 w-4 text-primary" /> Change Plan
          </button>
        </div>
      )}

      {/* Credit costs — hidden until needed */}
      {currentPlan && (
        <Collapse label="What do credits cost on your plan?" icon={Zap}>
          <div className="space-y-2 mt-2">
            {[
              { icon: Wand2,       label: "AI Generate (per question)", cost: Math.max(1, Math.ceil(currentPlan.credit_cost_ai_10q / 10)) },
              { icon: ScanLine,    label: "AI Image Scan / OCR",        cost: currentPlan.credit_cost_ai_scan },
              { icon: Zap,         label: "Launch Quiz Session",        cost: currentPlan.credit_cost_session_launch },
              { icon: CheckCircle2, label: "Export PDF / Excel",        cost: currentPlan.credit_cost_export },
            ].map(({ icon: Icon, label, cost }) => (
              <div key={label} className="flex items-center justify-between rounded-xl bg-muted/30 px-4 py-2.5">
                <div className="flex items-center gap-2 text-sm">
                  <Icon className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                  {label}
                </div>
                <span className="font-bold text-warning text-sm ml-4 shrink-0">{cost} cr</span>
              </div>
            ))}
          </div>
        </Collapse>
      )}

      {/* Payment history — hidden until needed */}
      {history.length > 0 && (
        <Collapse label={`Payment History (${history.length})`} icon={Clock}>
          <div className="space-y-2 mt-2">
            {history.map((pay) => (
              <div key={pay.id} className="flex items-center gap-3 rounded-xl bg-secondary/30 px-4 py-2.5">
                <div className="shrink-0">
                  {pay.status === "approved" ? <CheckCircle2 className="h-4 w-4 text-success" /> :
                   pay.status === "rejected" ? <XCircle className="h-4 w-4 text-destructive" /> :
                   <Clock className="h-4 w-4 text-warning" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold">PKR {pay.amount_pkr}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {METHOD_ICONS[pay.payment_method]} {pay.payment_method.replace("_", " ")} · {new Date(pay.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <StatusChip status={pay.status} />
                  {pay.status === "approved" && pay.credits_to_add > 0 && (
                    <div className="text-[10px] text-warning mt-0.5">+{pay.credits_to_add} cr</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Collapse>
      )}

      {/* Credit transaction history — hidden until needed */}
      {creditTx.length > 0 && (
        <Collapse label={`Credit Transactions (${creditTx.length})`} icon={Coins}>
          <div className="space-y-2 mt-2">
            {creditTx.map((tx) => {
              const isAdd = tx.amount > 0;
              return (
                <div key={tx.id} className="flex items-center justify-between rounded-xl bg-muted/30 px-4 py-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`rounded-lg p-1.5 shrink-0 ${isAdd ? "bg-success/15" : "bg-warning/15"}`}>
                      {isAdd ? <TrendingUp className="h-3.5 w-3.5 text-success" /> : <TrendingDown className="h-3.5 w-3.5 text-warning" />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{TX_LABELS[tx.type] ?? tx.type.replace(/_/g, " ")}</div>
                      {tx.description && <div className="text-[10px] text-muted-foreground truncate">{tx.description}</div>}
                      <div className="text-[10px] text-muted-foreground">{new Date(tx.created_at).toLocaleString()}</div>
                    </div>
                  </div>
                  <span className={`text-sm font-bold shrink-0 ml-3 ${isAdd ? "text-success" : "text-warning"}`}>
                    {isAdd ? "+" : ""}{tx.amount}
                  </span>
                </div>
              );
            })}
          </div>
        </Collapse>
      )}
    </div>
  );

  /* ══════════════════════════════════════
     STEP: PICK (packs or plans)
  ══════════════════════════════════════ */
  if (step === "pick") return (
    <div className="max-w-2xl mx-auto space-y-4">
      <StepHeader
        title={pickMode === "pack" ? "Buy Extra Credits" : "Choose a Plan"}
        sub={pickMode === "pack" ? "Credits never expire and stack with your monthly allocation" : "Billed monthly · cancel anytime"}
        onBack={() => setStep("overview")}
      />

      {pickMode === "pack" ? (
        <div className="grid grid-cols-2 gap-3">
          {CREDIT_PACKS.map((pack) => (
            <button
              key={pack.credits}
              type="button"
              onClick={() => handleBuyCreditPack(pack)}
              className="relative rounded-2xl border border-border bg-card/50 p-5 text-left hover:border-primary/50 hover:shadow-glow transition-all group flex flex-col gap-1"
            >
              {pack.badge && (
                <span className="absolute -top-2 left-4 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[9px] font-bold">
                  {pack.badge}
                </span>
              )}
              <span className="font-display text-3xl font-bold text-warning">{pack.credits}</span>
              <span className="text-xs text-muted-foreground">credits</span>
              <span className="mt-2 font-bold text-lg">PKR {pack.price_pkr}</span>
              <span className="text-[11px] text-muted-foreground">{pack.label} Pack · PKR {pack.perCredit}/cr</span>
              <span className="mt-3 w-full text-center text-xs font-semibold text-primary bg-primary/10 rounded-lg py-1.5 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                Buy →
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {individualPlans.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground mb-2">
                <Zap className="h-3.5 w-3.5" /> Individual
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {individualPlans.map((p) => (
                  <PlanCard key={p.id} plan={p} isCurrent={currentPlan?.slug === p.slug}
                    onSelect={() => { setSelectedPlan(p); setStep("pay"); }} />
                ))}
              </div>
            </div>
          )}
          {enterprisePlans.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground mb-2">
                <Building2 className="h-3.5 w-3.5" /> Enterprise / School
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {enterprisePlans.map((p) => (
                  <PlanCard key={p.id} plan={p} isCurrent={currentPlan?.slug === p.slug}
                    onSelect={() => { setSelectedPlan(p); setStep("pay"); }} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  /* ══════════════════════════════════════
     STEP: CHOOSE PAYMENT METHOD
  ══════════════════════════════════════ */
  if (step === "pay" && selectedPlan) return (
    <div className="max-w-lg mx-auto space-y-4">
      <StepHeader
        title="How would you like to pay?"
        sub={`${selectedPlan.name} — PKR ${selectedPlan.price_pkr}`}
        onBack={() => setStep(isFreeUser ? "pick" : "pick")}
      />

      {/* What you're buying */}
      <div className="rounded-2xl border border-primary/25 bg-primary/5 px-5 py-4 flex items-center justify-between">
        <div>
          <p className="font-semibold text-sm">{selectedPlan.name}</p>
          <p className="text-xs text-warning mt-0.5 flex items-center gap-1">
            <Zap className="h-3 w-3" /> {selectedPlan.credits_per_month} credits
          </p>
        </div>
        <p className="font-display text-2xl font-bold">PKR {selectedPlan.price_pkr}</p>
      </div>

      {/* Method cards — large tap targets */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Select a payment method</p>
        {accounts.map((acc) => (
          <button
            key={acc.id}
            type="button"
            onClick={() => { setSelectedMethod(acc.method); setStep("upload"); }}
            className="w-full rounded-2xl border border-border bg-card/50 p-4 flex items-center gap-4 hover:border-primary/50 hover:shadow-glow transition-all min-h-[72px] text-left"
          >
            <span className="text-3xl shrink-0">{METHOD_ICONS[acc.method] ?? "💳"}</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{acc.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5 font-mono">{acc.account_number}</p>
            </div>
            <ArrowLeft className="h-4 w-4 text-muted-foreground rotate-180 shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );

  /* ══════════════════════════════════════
     STEP: UPLOAD PROOF
  ══════════════════════════════════════ */
  if (step === "upload" && selectedPlan && selectedMethod) {
    const acc = accounts.find((a) => a.method === selectedMethod);
    return (
      <div className="max-w-lg mx-auto space-y-4">
        <StepHeader
          title="Send payment & upload proof"
          sub="Pay to the account below, then upload your screenshot"
          onBack={() => setStep("pay")}
        />

        {/* Account details to pay */}
        {acc && (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <span className="text-2xl">{METHOD_ICONS[acc.method]}</span>
                {acc.title}
              </div>
              <div className="font-display text-xl font-bold">PKR {selectedPlan.price_pkr}</div>
            </div>
            <div className="space-y-2">
              {[
                { key: "name",   label: "Account Name",   value: acc.account_name },
                { key: "number", label: "Account / IBAN",  value: acc.account_number },
              ].map(({ key, label, value }) => (
                <div key={key} className="flex items-center justify-between rounded-xl border border-border bg-card/60 px-4 py-2.5">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
                    <p className="font-semibold text-sm font-mono">{value}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(value, key)}
                    className="ml-3 p-2 rounded-lg hover:bg-muted/40 transition-colors"
                    aria-label={`Copy ${label}`}
                  >
                    {copied === key ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
                  </button>
                </div>
              ))}
            </div>
            {acc.instructions && (
              <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 rounded-xl p-3">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                {acc.instructions}
              </div>
            )}
          </div>
        )}

        {/* Upload form */}
        <div className="rounded-2xl border border-border bg-card/40 p-5 space-y-4">
          {/* Screenshot upload — biggest element, clearest action */}
          <div>
            <p className="text-sm font-semibold mb-2">Payment Screenshot <span className="text-destructive">*</span></p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              aria-label="Payment screenshot"
              className="hidden"
              onChange={(e) => setScreenshot(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className={`w-full rounded-2xl border-2 border-dashed p-8 text-center transition-colors hover:border-primary/50 ${
                screenshot ? "border-success/50 bg-success/5" : "border-border bg-muted/10"
              }`}
            >
              {screenshot ? (
                <div className="space-y-1">
                  <CheckCircle2 className="h-8 w-8 text-success mx-auto" />
                  <p className="text-sm font-semibold text-success">{screenshot.name}</p>
                  <p className="text-xs text-muted-foreground">Tap to change</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-8 w-8 text-muted-foreground/60 mx-auto" />
                  <p className="text-sm font-medium">Tap to upload screenshot</p>
                  <p className="text-xs text-muted-foreground">JPG · PNG · WebP up to 5 MB</p>
                </div>
              )}
            </button>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Transaction Reference <span className="text-muted-foreground font-normal">(optional but recommended)</span></Label>
            <Input value={txRef} onChange={(e) => setTxRef(e.target.value)} placeholder="e.g. TXN-123456789" className="h-10" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any info for admin…" className="h-10" />
          </div>

          <Button
            onClick={() => void handleUpload()}
            disabled={!screenshot || uploading}
            className="w-full h-12 bg-gradient-primary text-primary-foreground shadow-glow gap-2 text-base font-semibold"
          >
            {uploading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" />
                Submitting…
              </span>
            ) : (
              <><Upload className="h-5 w-5" /> Submit Payment Proof</>
            )}
          </Button>
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════
     STEP: DONE
  ══════════════════════════════════════ */
  if (step === "done") return (
    <div className="max-w-sm mx-auto">
      <div className="rounded-2xl border border-success/30 bg-success/5 p-10 text-center space-y-4">
        <CheckCircle2 className="h-14 w-14 text-success mx-auto" />
        <div>
          <h2 className="font-display text-2xl font-bold">Payment Submitted!</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Admin will verify within <span className="font-semibold text-foreground">24 hours</span>.<br />
            Credits will appear once approved.
          </p>
        </div>
        <div className="flex flex-col gap-2 pt-2">
          <Button
            onClick={() => void navigate({ to: "/dashboard" })}
            className="h-11 bg-gradient-primary text-primary-foreground shadow-glow"
          >
            Back to Dashboard
          </Button>
          <Button variant="outline" className="h-11" onClick={() => { setStep("overview"); setScreenshot(null); setTxRef(""); setNotes(""); }}>
            Buy More Credits
          </Button>
        </div>
      </div>
    </div>
  );

  return null;
}

/* ── Plan card ── */
function PlanCard({ plan, isCurrent, onSelect }: { plan: PlanInfo; isCurrent: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={isCurrent}
      className={`rounded-2xl border p-5 text-left transition-all hover:shadow-glow group ${
        isCurrent
          ? "border-primary/50 bg-primary/5 cursor-default"
          : "border-border bg-card/40 hover:border-primary/40"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="font-semibold text-sm">{plan.name}</div>
        {isCurrent && (
          <span className="inline-flex items-center rounded-full bg-primary/20 text-primary px-2 py-0.5 text-[9px] font-bold shrink-0">
            Current
          </span>
        )}
      </div>
      {plan.description && <p className="text-xs text-muted-foreground mb-3 leading-snug">{plan.description}</p>}
      <div className="flex items-baseline gap-1 mb-1">
        <span className="font-display text-2xl font-bold">PKR {plan.price_pkr}</span>
        <span className="text-xs text-muted-foreground">/month</span>
      </div>
      {plan.credits_per_month > 0 && (
        <div className="text-xs text-warning font-semibold flex items-center gap-1 mb-3">
          <Zap className="h-3 w-3" /> {plan.credits_per_month} credits/month
        </div>
      )}
      {!isCurrent && (
        <div className="w-full text-center text-xs font-semibold text-primary bg-primary/10 rounded-xl py-2 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
          Select →
        </div>
      )}
    </button>
  );
}
