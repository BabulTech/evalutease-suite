import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  ChevronRight,
  Clock,
  Coins,
  CreditCard,
  Crown,
  LayoutDashboard,
  Mail,
  MapPin,
  Phone,
  SendHorizonal,
  Settings,
  UserPlus,
  Users,
  ArrowLeft,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import { validationError } from "@/components/ui/validation-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { usePlan } from "@/contexts/PlanContext";
import { Button } from "@/components/ui/button";
import type { CompanyProfile, MemberRow, TxRow, CreditRequestRow } from "./types";
import { OverviewTab } from "./OverviewTab";
import { TeamTab } from "./TeamTab";
import { CreditsTab } from "./CreditsTab";
import { RequestsTab } from "./RequestsTab";
import { CreditTransferDialog } from "./CreditTransferDialog";
import { EditProfileDialog } from "./EditProfileDialog";
import type { PlanInfo } from "@/contexts/PlanContext";

type DashTab = "overview" | "team" | "credits" | "requests";

type Props = {
  company: CompanyProfile;
  setCompany: (c: CompanyProfile) => void;
  members: MemberRow[];
  companyId: string;
  plan: PlanInfo | null;
  maxHosts: number;
  reload: () => Promise<void>;
  onEditProfile: () => void;
};

// react-doctor-disable-next-line react-doctor/prefer-useReducer
// react-doctor-disable-next-line react-doctor/no-giant-component
export function Dashboard({
  company,
  setCompany,
  members,
  companyId,
  plan,
  maxHosts,
  reload,
  onEditProfile: _onEditProfile,
}: Props) {
  const { user } = useAuth();
  const { credits } = usePlan();
  const [tab, setTab] = useState<DashTab>("overview");

  const [editingProfile, setEditingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState({ ...company });
  const [savingProfile, setSavingProfile] = useState(false);

  const [creditTarget, setCreditTarget] = useState<MemberRow | null>(null);
  const [creditAction, setCreditAction] = useState<"send" | "deduct">("send");
  const [creditAmt, setCreditAmt] = useState("");
  const [creditNote, setCreditNote] = useState("");
  const [transferring, setTransferring] = useState(false);

  const [showAddHost, setShowAddHost] = useState(false);
  const [hostDraft, setHostDraft] = useState({
    full_name: "",
    invited_email: "",
    department: "",
    designation: "",
    initial_credits: "10",
  });
  const [addingHost, setAddingHost] = useState(false);

  const [txList, setTxList] = useState<TxRow[]>([]);
  const [txLoading, setTxLoading] = useState(false);

  const [reqList, setReqList] = useState<CreditRequestRow[]>([]);
  const [reqLoading, setReqLoading] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const loadTx = useCallback(async () => {
    if (!user) return;
    setTxLoading(true);
    const { data } = await supabase
      .from("credit_transactions")
      .select("id,type,amount,description,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    if (data) setTxList(data as TxRow[]);
    setTxLoading(false);
  }, [user]);

  const loadRequests = useCallback(async () => {
    setReqLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("credit_requests")
      .select("id, member_id, requester_user_id, amount, note, status, resolved_at, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    const rows = (data ?? []) as CreditRequestRow[];
    if (rows.length) {
      const ids = [...new Set(rows.map((r) => r.requester_user_id))];
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", ids);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const map = new Map((profs ?? []).map((p: any) => [p.id, p]));
      rows.forEach((r) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p = map.get(r.requester_user_id) as any;
        r.requester_name = p?.full_name ?? null;
        r.requester_email = p?.email ?? null;
      });
    }
    setReqList(rows);
    setReqLoading(false);
  }, [companyId]);

  // react-doctor-disable-next-line react-doctor/no-event-handler
  useEffect(() => {
    if (tab === "credits") void loadTx();
  }, [tab, loadTx]);
  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const pendingCount = reqList.filter((r) => r.status === "pending").length;

  const approveReq = async (id: string) => {
    setResolvingId(id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("approve_credit_request", { p_request_id: id });
    setResolvingId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Request approved, credits transferred");
    void loadRequests();
    void reload();
  };

  const declineReq = async (id: string) => {
    setResolvingId(id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("decline_credit_request", { p_request_id: id });
    setResolvingId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Request declined");
    void loadRequests();
  };

  const saveProfile = async () => {
    if (!profileDraft.company_name.trim()) {
      validationError("Name required");
      return;
    }
    setSavingProfile(true);
    const { error } = await supabase
      .from("company_profiles")
      .update({
        company_name: profileDraft.company_name.trim(),
        company_type: profileDraft.company_type as
          | "school"
          | "university"
          | "college"
          | "training_center"
          | "corporate"
          | "government"
          | "ngo"
          | "other",
        registration_no: profileDraft.registration_no.trim() || null,
        website: profileDraft.website.trim() || null,
        address: profileDraft.address.trim() || null,
        city: profileDraft.city.trim() || null,
        province: profileDraft.province || null,
        phone: profileDraft.phone.trim() || null,
        email: profileDraft.email.trim() || null,
        total_students: profileDraft.total_students ? Number(profileDraft.total_students) : null,
        established_year: profileDraft.established_year
          ? Number(profileDraft.established_year)
          : null,
        description: profileDraft.description.trim() || null,
      })
      .eq("id", companyId);
    setSavingProfile(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setCompany({ ...profileDraft });
    setEditingProfile(false);
    toast.success("Profile updated!");
  };

  const addHost = async () => {
    if (!hostDraft.full_name.trim() || !hostDraft.invited_email.trim()) {
      validationError("Name and email required");
      return;
    }
    if (members.length >= maxHosts) {
      validationError(`Max ${maxHosts} hosts on ${plan?.name}`);
      return;
    }
    const initialCredits = plan?.can_buy_credits
      ? Math.max(0, parseInt(hostDraft.initial_credits) || 0)
      : 0;
    if (plan?.can_buy_credits && initialCredits > credits.balance) {
      validationError(`Initial credits (${initialCredits}) exceeds your pool (${credits.balance})`);
      return;
    }
    setAddingHost(true);
    const token = crypto.randomUUID();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from("company_members") as any)
      .insert({
        company_id: companyId,
        invited_email: hostDraft.invited_email.trim().toLowerCase(),
        full_name: hostDraft.full_name.trim(),
        role: "host",
        department: hostDraft.department || null,
        designation: hostDraft.designation || null,
        invite_token: token,
        status: "pending",
        credit_limit: initialCredits,
        credits_used: 0,
      })
      .select("id")
      .single();
    if (error) {
      setAddingHost(false);
      toast.error((error as Error).message);
      return;
    }
    const memberId = (data as { id: string }).id;
    const appOrigin = import.meta.env.VITE_APP_URL || window.location.origin;
    const inviteLink = `${appOrigin}/accept-invite?token=${token}&member_id=${memberId}&email=${encodeURIComponent(hostDraft.invited_email.trim().toLowerCase())}`;
    const { error: fnErr } = await supabase.functions.invoke("send-email", {
      body: {
        type: "host_invite",
        data: {
          to: hostDraft.invited_email.trim().toLowerCase(),
          fullName: hostDraft.full_name.trim(),
          companyName: company.company_name,
          inviteLink,
        },
      },
    });
    setAddingHost(false);
    if (fnErr) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body = await (fnErr as any).context?.json?.().catch?.(() => null);
      toast.warning(
        `${hostDraft.full_name} added, but email failed: ${body?.error ?? (fnErr as Error).message}`,
      );
    } else {
      toast.success(`Invite sent to ${hostDraft.invited_email}`);
    }
    void reload();
    setHostDraft({
      full_name: "",
      invited_email: "",
      department: "",
      designation: "",
      initial_credits: "10",
    });
    setShowAddHost(false);
  };

  const removeHost = async (id: string, name: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("company_members") as any).delete().eq("id", id);
    if (error) {
      toast.error((error as Error).message);
      return;
    }
    void reload();
    toast.success(`${name} removed`);
  };

  const doCredit = async () => {
    if (!creditTarget || !user) return;
    const amt = parseInt(creditAmt);
    if (isNaN(amt) || amt <= 0) {
      validationError("Enter a valid amount");
      return;
    }
    if (creditAction === "send" && amt > credits.balance) {
      validationError(`You only have ${credits.balance} credits`);
      return;
    }
    if (!creditTarget.user_id) {
      validationError("Host hasn't signed up yet, share their invite link first");
      return;
    }
    setTransferring(true);
    if (creditAction === "send") {
      const { error } = await supabase.rpc("transfer_credits_to_host", {
        p_admin_id: user.id,
        p_host_user_id: creditTarget.user_id,
        p_member_id: creditTarget.id,
        p_amount: amt,
        p_note: creditNote.trim() || undefined,
      });
      if (error) {
        const msg = error.message?.includes("insufficient_credits")
          ? "Insufficient credits in your pool"
          : error.message?.includes("unauthorized")
            ? "You are not authorized to perform this transfer"
            : error.message;
        toast.error(msg);
        setTransferring(false);
        return;
      }
      toast.success(`${amt} credits sent to ${creditTarget.full_name}`);
    } else {
      const { data: ok, error } = await supabase.rpc("deduct_credits", {
        p_user_id: creditTarget.user_id,
        p_amount: amt,
        p_type: "admin_adjustment",
        p_description: creditNote.trim() || `Admin deducted ${amt} credits`,
      });
      if (error || !ok) {
        toast.error(error?.message ?? "Insufficient balance");
        setTransferring(false);
        return;
      }
      toast.success(`${amt} credits deducted from ${creditTarget.full_name}`);
    }
    setTransferring(false);
    setCreditTarget(null);
    setCreditAmt("");
    setCreditNote("");
    void reload();
    if (tab === "credits") void loadTx();
  };

  const showCredits = !!plan?.can_buy_credits;
  const maxHostsDisplay = maxHosts === -1 ? "Unlimited" : maxHosts;
  const activeBalanceTotal = members
    .filter((m) => m.user_id)
    .reduce((s, m) => s + (m.balance ?? 0), 0);
  const pendingPreAllocated = members
    .filter((m) => !m.user_id)
    .reduce((s, m) => s + (m.credit_limit ?? 0), 0);

  const TABS: { id: DashTab; label: string; icon: React.ElementType; badge?: number }[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "team", label: "Team", icon: Users },
    ...(showCredits ? [{ id: "credits" as DashTab, label: "Credits", icon: Coins }] : []),
  ];

  return (
    <div className="max-w-5xl mx-auto pb-10 space-y-5">
      {/* Hero */}
      <div className="rounded-2xl border border-border bg-card/60 p-5 flex flex-wrap items-center gap-4">
        <div className="size-12 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center text-primary shadow-glow shrink-0">
          <Building2 className="size-6" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-display text-xl sm:text-2xl font-semibold tracking-tight truncate">
              {company.company_name}
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 text-warning px-2 py-0.5 text-[10px] font-semibold shrink-0">
              <Crown className="size-3" /> {plan?.name}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
            {company.city && (
              <span className="flex items-center gap-1">
                <MapPin className="size-3" />
                {company.city}
                {company.province ? `, ${company.province}` : ""}
              </span>
            )}
            {company.email && (
              <span className="flex items-center gap-1">
                <Mail className="size-3" />
                {company.email}
              </span>
            )}
            {company.phone && (
              <span className="flex items-center gap-1">
                <Phone className="size-3" />
                {company.phone}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors min-h-[36px]"
          >
            <ArrowLeft className="size-3.5" /> Dashboard
          </Link>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setProfileDraft({ ...company });
              setEditingProfile(true);
            }}
            className="gap-1.5 text-xs min-h-[36px]"
          >
            <Settings className="size-3.5" /> Edit
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-1 min-[380px]:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {[
          {
            label: "Credit Pool",
            value: credits.balance,
            color: "text-warning",
            icon: Coins,
            border: "border-warning/30 bg-warning/5",
          },
          {
            label: "With Active Hosts",
            value: activeBalanceTotal,
            color: "text-success",
            icon: SendHorizonal,
            border: "border-success/20 bg-success/5",
          },
          {
            label: "Pending (pre-allocated)",
            value: pendingPreAllocated,
            color: "text-primary",
            icon: Clock,
            border: "border-primary/20 bg-primary/5",
          },
          {
            label: "Team Size",
            value: `${members.length} / ${maxHostsDisplay}`,
            color: "text-foreground",
            icon: Users,
            border: "border-border bg-card/60",
          },
        ].map(({ label, value, color, icon: Icon, border }) => (
          <div
            key={label}
            className={`rounded-xl md:rounded-2xl border p-3 sm:p-4 min-h-[92px] ${border}`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {label}
              </span>
              <Icon className={`size-3.5 ${color} opacity-60`} />
            </div>
            <div className={`font-display text-2xl font-bold ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => {
            setTab("team");
            setShowAddHost(true);
          }}
          className="min-h-20 rounded-xl border border-border bg-card/40 hover:border-primary/40 hover:bg-primary/5 p-4 flex items-center gap-3 transition-all group text-left"
        >
          <div className="rounded-xl bg-primary/10 p-2.5 shrink-0">
            <UserPlus className="size-4 text-primary" />
          </div>
          <div>
            <div className="font-semibold text-sm group-hover:text-primary transition-colors">
              Add a Host
            </div>
            <div className="text-xs text-muted-foreground">Invite a teacher or trainer</div>
          </div>
          <ChevronRight className="size-4 text-muted-foreground ml-auto" />
        </button>
        <button
          type="button"
          onClick={() => setTab("credits")}
          className="min-h-20 rounded-xl border border-border bg-card/40 hover:border-primary/40 hover:bg-primary/5 p-4 flex items-center gap-3 transition-all group text-left"
        >
          <div className="rounded-xl bg-warning/10 p-2.5 shrink-0">
            <Coins className="size-4 text-warning" />
          </div>
          <div>
            <div className="font-semibold text-sm group-hover:text-primary transition-colors">
              Credit Overview
            </div>
            <div className="text-xs text-muted-foreground">View balances & transactions</div>
          </div>
          <ChevronRight className="size-4 text-muted-foreground ml-auto" />
        </button>
        <Link
          to="/billing"
          search={{ plan: "" }}
          className="min-h-20 rounded-xl border border-border bg-card/40 hover:border-primary/40 hover:bg-primary/5 p-4 flex items-center gap-3 transition-all group"
        >
          <div className="rounded-xl bg-primary/10 p-2.5 shrink-0">
            <CreditCard className="size-4 text-primary" />
          </div>
          <div>
            <div className="font-semibold text-sm group-hover:text-primary transition-colors">
              Buy More Credits
            </div>
            <div className="text-xs text-muted-foreground">Top up your credit pool</div>
          </div>
          <ChevronRight className="size-4 text-muted-foreground ml-auto" />
        </Link>
      </div>

      {/* Tab bar */}
      <div className="overflow-x-auto border-b border-border pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="inline-flex min-w-max gap-1">
          {TABS.map(({ id, label, icon: Icon, badge }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`min-h-11 rounded-t-xl flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${tab === id ? "border-primary bg-primary/10 text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              <Icon className="size-4" /> {label}
              {badge && badge > 0 ? (
                <span className="ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
                  {badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {tab === "overview" && (
        <OverviewTab
          company={company}
          plan={plan}
          maxHosts={maxHosts}
          maxHostsDisplay={maxHostsDisplay}
        />
      )}

      {tab === "team" && (
        <TeamTab
          members={members}
          maxHosts={maxHosts}
          maxHostsDisplay={maxHostsDisplay}
          plan={plan}
          credits={credits}
          showCredits={showCredits}
          showAddHost={showAddHost}
          hostDraft={hostDraft}
          addingHost={addingHost}
          onSetShowAddHost={setShowAddHost}
          onHostDraftChange={setHostDraft}
          onAddHost={() => void addHost()}
          onRemoveHost={(id, name) => void removeHost(id, name)}
          onSendCredit={(m) => {
            setCreditTarget(m);
            setCreditAction("send");
          }}
          onDeductCredit={(m) => {
            setCreditTarget(m);
            setCreditAction("deduct");
          }}
          onReload={() => void reload()}
        />
      )}

      {tab === "credits" && (
        <CreditsTab
          credits={credits}
          members={members}
          txList={txList}
          txLoading={txLoading}
          showCredits={showCredits}
          onRefreshTx={() => void loadTx()}
          onSendCredit={(m) => {
            setCreditTarget(m);
            setCreditAction("send");
            setTab("team");
          }}
        />
      )}

      {tab === "requests" && (
        <RequestsTab
          reqList={reqList}
          reqLoading={reqLoading}
          pendingCount={pendingCount}
          resolvingId={resolvingId}
          credits={credits}
          onRefresh={() => void loadRequests()}
          onApprove={(id) => void approveReq(id)}
          onDecline={(id) => void declineReq(id)}
        />
      )}

      <CreditTransferDialog
        creditTarget={creditTarget}
        creditAction={creditAction}
        creditAmt={creditAmt}
        creditNote={creditNote}
        transferring={transferring}
        creditsBalance={credits.balance}
        onClose={() => {
          setCreditTarget(null);
          setCreditAmt("");
          setCreditNote("");
        }}
        onAmtChange={setCreditAmt}
        onNoteChange={setCreditNote}
        onConfirm={() => void doCredit()}
      />

      <EditProfileDialog
        open={editingProfile}
        profileDraft={profileDraft}
        savingProfile={savingProfile}
        onClose={() => setEditingProfile(false)}
        onChange={setProfileDraft}
        onSave={() => void saveProfile()}
      />
    </div>
  );
}
