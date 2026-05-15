import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import {
  ArrowLeft, ArrowRight, Building2, CheckCircle2, GraduationCap, Globe,
  Mail, MapPin, Phone, Plus, Save, Trash2, User, UserPlus, Users,
  Briefcase, BookOpen, Hash, Coins, TrendingUp, TrendingDown, Zap,
  RefreshCw, SendHorizonal, AlertCircle, Crown, Edit2, X, CreditCard,
  LayoutDashboard, ChevronRight, BadgeCheck, Clock, Settings,
  PlusCircle, MinusCircle, History,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { usePlan } from "@/contexts/PlanContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_app/company")({ component: CompanyPage });

// ─── Types ─────────────────────────────────────────────────────
type CompanyProfile = {
  id?: string;
  company_name: string; company_type: string; registration_no: string;
  website: string; address: string; city: string; province: string;
  country: string; phone: string; email: string;
  total_students: string; established_year: string; description: string;
  onboarding_completed?: boolean;
};

type MemberRow = {
  id: string; full_name: string; invited_email: string; role: string;
  department: string | null; designation: string | null;
  status: string; user_id: string | null;
  credit_limit: number; credits_used: number;
  // enriched
  balance?: number;
};

type TxRow = { id: string; type: string; amount: number; description: string | null; created_at: string };

type CreditRequestRow = {
  id: string;
  member_id: string;
  requester_user_id: string;
  amount: number;
  note: string | null;
  status: "pending" | "approved" | "declined";
  resolved_at: string | null;
  created_at: string;
  // enriched
  requester_name?: string;
  requester_email?: string;
};

// ─── Constants ─────────────────────────────────────────────────
const COMPANY_TYPES = [
  { value: "school", label: "School" }, { value: "university", label: "University" },
  { value: "college", label: "College" }, { value: "training_center", label: "Training Center" },
  { value: "corporate", label: "Corporate / Company" }, { value: "government", label: "Government / Public Sector" },
  { value: "ngo", label: "NGO / Non-profit" }, { value: "other", label: "Other" },
];
const PROVINCES = ["Punjab","Sindh","Khyber Pakhtunkhwa","Balochistan","Gilgit-Baltistan","Azad Kashmir","Islamabad Capital Territory"];
const DEPARTMENTS = ["Science","Mathematics","English","Urdu","Physics","Chemistry","Biology","Computer Science","Social Studies","Islamic Studies","Arts","Commerce","Administration","IT Department","Other"];
const DESIGNATIONS = ["Teacher","Senior Teacher","Head of Department","Vice Principal","Principal","Coordinator","Lecturer","Assistant Professor","Professor","Trainer","Manager","Other"];

const TYPE_CONFIG: Record<string, { staffLabel: string; staffPlaceholder: string; regLabel: string; regPlaceholder: string; showWebsite: boolean; showEstYear: boolean }> = {
  school:          { staffLabel: "Total Students",      staffPlaceholder: "e.g. 500",      regLabel: "School Reg. No.",        regPlaceholder: "Registration number",   showWebsite: true,  showEstYear: true  },
  university:      { staffLabel: "Total Students",      staffPlaceholder: "e.g. 5000",     regLabel: "HEC Reg. No.",           regPlaceholder: "HEC reg / charter no.", showWebsite: true,  showEstYear: true  },
  college:         { staffLabel: "Total Students",      staffPlaceholder: "e.g. 800",      regLabel: "College Reg. No.",       regPlaceholder: "Registration number",   showWebsite: true,  showEstYear: true  },
  training_center: { staffLabel: "Total Trainees",      staffPlaceholder: "e.g. 200",      regLabel: "License / Reg. No.",     regPlaceholder: "License number",        showWebsite: true,  showEstYear: true  },
  corporate:       { staffLabel: "Total Employees",     staffPlaceholder: "e.g. 150",      regLabel: "Company Reg. (SECP)",    regPlaceholder: "SECP / NTN number",     showWebsite: true,  showEstYear: true  },
  government:      { staffLabel: "Total Staff",         staffPlaceholder: "e.g. 300",      regLabel: "Dept. Code / Reference", regPlaceholder: "Dept. code or ID",      showWebsite: false, showEstYear: false },
  ngo:             { staffLabel: "Total Members/Staff", staffPlaceholder: "e.g. 50",       regLabel: "NGO Reg. No.",           regPlaceholder: "SECP / EAD reg no.",    showWebsite: true,  showEstYear: true  },
  other:           { staffLabel: "Total People",        staffPlaceholder: "Approx. count", regLabel: "Registration No.",       regPlaceholder: "Optional",              showWebsite: true,  showEstYear: true  },
};
const getCfg = (t: string) => TYPE_CONFIG[t] ?? TYPE_CONFIG.other;

const TX_LABEL: Record<string, string> = {
  plan_refill: "Monthly Refill", payment_approved: "Payment Approved",
  ai_question_gen: "AI Question Gen", ai_image_scan: "AI Image Scan",
  admin_adjustment: "Admin Adjustment", extra_quiz: "Extra Quiz",
  extra_participants: "Extra Participants", expiry: "Credits Expired",
};

// ─── Main page ─────────────────────────────────────────────────
function CompanyPage() {
  const { user } = useAuth();
  const { plan, reload: reloadPlan } = usePlan();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [company, setCompany] = useState<CompanyProfile>({
    company_name: "", company_type: "school", registration_no: "",
    website: "", address: "", city: "", province: "Punjab",
    country: "Pakistan", phone: "", email: "", total_students: "",
    established_year: "", description: "",
  });
  const [step, setStep] = useState<1 | 2>(1);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [saving, setSaving] = useState(false);

  const isEnterprise = plan?.tier === "enterprise";
  const maxHosts = plan?.max_hosts ?? 3;

  const loadMembers = useCallback(async (cId: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.from("company_members") as any).select("*").eq("company_id", cId);
    if (!data) return;
    const rows = data as MemberRow[];
    // Enrich with credit balances for active members
    const activeIds = rows.filter((m) => m.user_id).map((m) => m.user_id as string);
    if (activeIds.length > 0) {
      const { data: credits } = await supabase.from("user_credits").select("user_id, balance").in("user_id", activeIds);
      const balMap = new Map((credits ?? []).map((c) => [c.user_id, c.balance]));
      setMembers(rows.map((m) => ({ ...m, balance: m.user_id ? (balMap.get(m.user_id) ?? 0) : undefined })));
    } else {
      setMembers(rows);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase.from("company_profiles").select("*").eq("admin_user_id", user.id).maybeSingle()
      .then(({ data }) => {
        if (data) {
          const d = data as Record<string, unknown>;
          setCompanyId(d.id as string);
          setOnboardingDone(d.onboarding_completed as boolean);
          setCompany({
            company_name: (d.company_name as string) ?? "",
            company_type: (d.company_type as string) ?? "school",
            registration_no: (d.registration_no as string) ?? "",
            website: (d.website as string) ?? "",
            address: (d.address as string) ?? "",
            city: (d.city as string) ?? "",
            province: (d.province as string) ?? "Punjab",
            country: (d.country as string) ?? "Pakistan",
            phone: (d.phone as string) ?? "",
            email: (d.email as string) ?? "",
            total_students: (d.total_students as number)?.toString() ?? "",
            established_year: (d.established_year as number)?.toString() ?? "",
            description: (d.description as string) ?? "",
            onboarding_completed: d.onboarding_completed as boolean,
          });
          if (d.onboarding_completed) void loadMembers(d.id as string);
          else setStep(2);
        }
        setLoading(false);
      });
  }, [user, loadMembers]);

  if (!loading && !isEnterprise) {
    return (
      <div className="max-w-lg mx-auto mt-24 text-center space-y-4 px-4">
        <div className="mx-auto h-16 w-16 rounded-2xl bg-warning/10 flex items-center justify-center">
          <Building2 className="h-8 w-8 text-warning" />
        </div>
        <h2 className="font-display text-2xl font-bold">Organization Features</h2>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          Team management, host accounts, and org-wide analytics require an Enterprise plan.
        </p>
        <Link to="/billing" search={{ plan: "enterprise_starter" }}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-primary text-primary-foreground px-6 py-3 text-sm font-semibold shadow-glow hover:opacity-90 transition-opacity">
          <Zap className="h-4 w-4" /> View Enterprise Plans
        </Link>
      </div>
    );
  }

  if (loading) return (
    <div className="max-w-5xl mx-auto pb-10 space-y-5 animate-pulse">
      <div className="rounded-2xl border border-border bg-card/60 p-5 h-24" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <div key={i} className="rounded-2xl border border-border bg-card/40 h-24" />)}
      </div>
      <div className="h-12 rounded-xl bg-muted/30" />
      <div className="rounded-2xl border border-border bg-card/40 h-48" />
    </div>
  );

  if (onboardingDone && companyId) {
    return (
      <Dashboard
        company={company} setCompany={setCompany} members={members}
        companyId={companyId} plan={plan} maxHosts={maxHosts}
        reload={async () => { await loadMembers(companyId); reloadPlan(); }}
        onEditProfile={() => setOnboardingDone(false)}
      />
    );
  }

  // ── Onboarding Wizard ─────────────────────────────────────────
  const saveCompany = async (goNext: boolean) => {
    if (!user || !company.company_name.trim()) { toast.error("Organization name is required"); return; }
    setSaving(true);
    const payload = {
      admin_user_id: user.id,
      company_name: company.company_name.trim(),
      company_type: company.company_type,
      registration_no: company.registration_no.trim() || null,
      website: company.website.trim() || null,
      address: company.address.trim() || null,
      city: company.city.trim() || null,
      province: company.province || null,
      country: company.country || "Pakistan",
      phone: company.phone.trim() || null,
      email: company.email.trim() || null,
      total_students: company.total_students ? Number(company.total_students) : null,
      established_year: company.established_year ? Number(company.established_year) : null,
      description: company.description.trim() || null,
      onboarding_completed: false,
    };
    let id = companyId;
    if (id) {
      const { error } = await supabase.from("company_profiles").update(payload).eq("id", id);
      if (error) { toast.error(error.message); setSaving(false); return; }
    } else {
      const { data, error } = await supabase.from("company_profiles").insert(payload).select("id").single();
      if (error) { toast.error(error.message); setSaving(false); return; }
      id = (data as { id: string }).id; setCompanyId(id);
    }
    setSaving(false);
    toast.success(goNext ? "Saved! Now add your hosts." : "Draft saved.");
    if (goNext) setStep(2);
  };

  const finishOnboarding = async () => {
    if (!companyId) return;
    setSaving(true);
    const { error } = await supabase.from("company_profiles").update({ onboarding_completed: true }).eq("id", companyId);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Organization setup complete!");
    setOnboardingDone(true);
    void loadMembers(companyId);
  };

  const cfg = getCfg(company.company_type);

  return (
    <div className="max-w-2xl mx-auto space-y-5 md:space-y-6 pb-10">
      <div className="flex items-start gap-3 pt-2">
        <button type="button" title="Back" onClick={() => void navigate({ to: "/dashboard" })}
          className="rounded-xl p-2 hover:bg-muted/40 transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="font-display text-xl md:text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" /> Organization Setup
          </h1>
          <p className="text-sm text-muted-foreground">One-time setup — takes less than 2 minutes</p>
        </div>
      </div>

      {/* Progress steps */}
      <div className="flex items-center gap-0">
        {([{ n: 1, label: "Organization Info" }, { n: 2, label: "Add Hosts" }] as const).map(({ n, label }, idx) => (
          <div key={n} className="flex items-center flex-1">
            <div className={`flex items-center gap-2 ${step >= n ? "text-primary" : "text-muted-foreground"}`}>
              <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${step > n ? "bg-primary border-primary text-primary-foreground" : step === n ? "border-primary text-primary" : "border-muted-foreground/30"}`}>
                {step > n ? <CheckCircle2 className="h-4 w-4" /> : n}
              </div>
              <span className="text-xs font-semibold hidden sm:block">{label}</span>
            </div>
            {idx < 1 && <div className={`flex-1 h-px mx-3 ${step > n ? "bg-primary" : "bg-muted/40"}`} />}
          </div>
        ))}
      </div>

      {/* Step 1 */}
      {step === 1 && (
        <div className="rounded-xl md:rounded-2xl border border-border bg-card/40 p-4 md:p-6 space-y-5 [&_input]:min-h-11 sm:[&_input]:min-h-9">
          <p className="text-xs text-muted-foreground">Fields marked <span className="text-destructive">*</span> are required</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Organization Name <span className="text-destructive">*</span></Label>
              <Input value={company.company_name} onChange={(e) => setCompany({ ...company, company_name: e.target.value })}
                placeholder={company.company_type === "corporate" ? "e.g. ABC Pvt. Ltd." : company.company_type === "government" ? "e.g. Directorate of Education Punjab" : "e.g. Pakistan Model School"} />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label>Organization Type <span className="text-destructive">*</span></Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {COMPANY_TYPES.map((t) => (
                  <button key={t.value} type="button"
                    onClick={() => setCompany({ ...company, company_type: t.value })}
                    className={`rounded-xl border px-3 py-2.5 text-xs font-medium min-h-[40px] text-center transition-colors ${
                      company.company_type === t.value
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border bg-card/50 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    }`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><Hash className="h-3.5 w-3.5" /> {cfg.regLabel}</Label>
              <Input value={company.registration_no} onChange={(e) => setCompany({ ...company, registration_no: e.target.value })} placeholder={cfg.regPlaceholder} />
            </div>
            {cfg.showEstYear && (
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5"><GraduationCap className="h-3.5 w-3.5" /> Established Year</Label>
                <Input type="number" value={company.established_year} onChange={(e) => setCompany({ ...company, established_year: e.target.value })} placeholder="e.g. 2005" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> {cfg.staffLabel}</Label>
              <Input type="number" value={company.total_students} onChange={(e) => setCompany({ ...company, total_students: e.target.value })} placeholder={cfg.staffPlaceholder} />
            </div>
          </div>

          <div className="border-t border-border/40 pt-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contact Details</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Phone</Label>
                <Input value={company.phone} onChange={(e) => setCompany({ ...company, phone: e.target.value })} placeholder="+92 300 0000000" />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Official Email</Label>
                <Input type="email" value={company.email} onChange={(e) => setCompany({ ...company, email: e.target.value })} placeholder="info@org.pk" />
              </div>
              {cfg.showWebsite && (
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" /> Website</Label>
                  <Input value={company.website} onChange={(e) => setCompany({ ...company, website: e.target.value })} placeholder="https://org.pk" />
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-border/40 pt-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Location</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <Label>Address</Label>
                <Input value={company.address} onChange={(e) => setCompany({ ...company, address: e.target.value })} placeholder="Street, area" />
              </div>
              <div className="space-y-1.5">
                <Label>City</Label>
                <Input value={company.city} onChange={(e) => setCompany({ ...company, city: e.target.value })} placeholder="e.g. Lahore" />
              </div>
              <div className="space-y-1.5">
                <Label>Province</Label>
                <Select value={company.province} onValueChange={(v) => setCompany({ ...company, province: v })}>
                <SelectTrigger className="min-h-11 sm:min-h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{PROVINCES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>About <span className="text-muted-foreground text-xs font-normal">(optional)</span></Label>
            <textarea value={company.description} onChange={(e) => setCompany({ ...company, description: e.target.value })}
              placeholder="Brief description of your organization…" rows={2}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={() => void saveCompany(false)} disabled={saving} className="h-11 gap-1.5">
              <Save className="h-4 w-4" /> Save Draft
            </Button>
            <Button onClick={() => void saveCompany(true)} disabled={saving} className="h-11 flex-1 bg-gradient-primary text-primary-foreground shadow-glow gap-1.5">
              Continue to Add Hosts <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && companyId && (
        <HostsStep
          companyId={companyId} members={members} maxHosts={maxHosts} plan={plan}
          companyName={company.company_name}
          onMembersChange={setMembers} saving={saving} setSaving={setSaving}
          onBack={() => setStep(1)} onFinish={() => void finishOnboarding()}
        />
      )}
    </div>
  );
}

// ─── Hosts Step (onboarding step 2) ───────────────────────────
function HostsStep({ companyId, members, maxHosts, plan, companyName, onMembersChange, saving, setSaving, onBack, onFinish }: {
  companyId: string; members: MemberRow[]; maxHosts: number; companyName: string;
  plan: ReturnType<typeof usePlan>["plan"];
  onMembersChange: (m: MemberRow[]) => void;
  saving: boolean; setSaving: (v: boolean) => void;
  onBack: () => void; onFinish: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState({ full_name: "", invited_email: "", department: "", designation: "", initial_credits: "10" });

  const add = async () => {
    if (!draft.full_name.trim() || !draft.invited_email.trim()) { toast.error("Name and email required"); return; }
    if (members.length >= maxHosts) { toast.error(`Max ${maxHosts} hosts on ${plan?.name}`); return; }
    const initialCredits = Math.max(0, parseInt(draft.initial_credits) || 0);
    setSaving(true);
    const token = crypto.randomUUID();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from("company_members") as any).insert({
      company_id: companyId, invited_email: draft.invited_email.trim().toLowerCase(),
      full_name: draft.full_name.trim(), role: "host",
      department: draft.department || null, designation: draft.designation || null,
      invite_token: token, status: "pending", credit_limit: initialCredits, credits_used: 0,
    }).select("*").single();
    if (error) { setSaving(false); toast.error((error as Error).message); return; }

    // Send invite email via Edge Function (uses Supabase configured SMTP)
    const member = data as unknown as MemberRow;
    const { error: fnErr } = await supabase.functions.invoke("send-host-invite", {
      body: {
        invited_email: member.invited_email,
        full_name: member.full_name,
        company_name: companyName,
        invite_token: token,
        member_id: member.id,
      },
    });
    setSaving(false);
    if (fnErr) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body = await (fnErr as any).context?.json?.().catch?.(() => null);
      const detail = body?.error ?? (fnErr as Error).message;
      toast.warning(`${draft.full_name} added, but email failed: ${detail}`);
    } else {
      toast.success(`Invite sent to ${draft.invited_email}`);
    }
    onMembersChange([...members, member]);
    setDraft({ full_name: "", invited_email: "", department: "", designation: "", initial_credits: "10" });
    setShowForm(false);
  };

  const remove = async (id: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("company_members") as any).delete().eq("id", id);
    if (error) { toast.error((error as Error).message); return; }
    onMembersChange(members.filter((m) => m.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <Crown className="h-4 w-4 text-primary" />
          <span><strong>{plan?.name}</strong> — {maxHosts} hosts allowed</span>
        </div>
        <span className="font-bold text-primary">{members.length}/{maxHosts} added</span>
      </div>

      <div className="rounded-2xl border border-border bg-card/40 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="font-semibold text-sm flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Your Hosts</div>
          {members.length < maxHosts && (
            <Button size="sm" onClick={() => setShowForm(true)} className="bg-gradient-primary text-primary-foreground gap-1.5 text-xs">
              <UserPlus className="h-3.5 w-3.5" /> Add Host
            </Button>
          )}
        </div>

        {showForm && (
          <div className="border-b border-border bg-muted/10 px-4 py-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">Full Name *</Label>
                <Input value={draft.full_name} onChange={(e) => setDraft({ ...draft, full_name: e.target.value })} placeholder="e.g. Ayesha Khan" className="h-8 text-sm" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Email *</Label>
                <Input type="email" value={draft.invited_email} onChange={(e) => setDraft({ ...draft, invited_email: e.target.value })} placeholder="teacher@school.edu.pk" className="h-8 text-sm" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Department</Label>
                <Select value={draft.department} onValueChange={(v) => setDraft({ ...draft, department: v })}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select></div>
              <div className="space-y-1.5"><Label className="text-xs">Designation</Label>
                <Select value={draft.designation} onValueChange={(v) => setDraft({ ...draft, designation: v })}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{DESIGNATIONS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select></div>
              <div className="space-y-1.5 sm:col-span-2"><Label className="text-xs">Initial Credits</Label>
                <Input type="number" min={0} value={draft.initial_credits} onChange={(e) => setDraft({ ...draft, initial_credits: e.target.value })} placeholder="10" className="h-8 text-sm w-32" />
                <p className="text-[10px] text-muted-foreground mt-1">Deducted from your balance when host accepts invite</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}><X className="h-3.5 w-3.5 mr-1" /> Cancel</Button>
              <Button size="sm" onClick={() => void add()} disabled={saving} className="bg-gradient-primary text-primary-foreground gap-1">
                <Plus className="h-3.5 w-3.5" /> {saving ? "Adding…" : "Add Host"}
              </Button>
            </div>
          </div>
        )}

        {members.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground font-medium">No hosts yet</p>
            <p className="text-xs text-muted-foreground mt-1">Add teachers or trainers who will conduct quizzes</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                  {m.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{m.full_name}</div>
                  <div className="text-xs text-muted-foreground">{m.invited_email}</div>
                </div>
                <span className="inline-flex items-center rounded-full bg-warning/10 text-warning px-2 py-0.5 text-[10px] font-semibold">Pending</span>
                <button type="button" title="Remove" onClick={() => void remove(m.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors p-1">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
        <Button onClick={onFinish} disabled={saving} className="flex-1 bg-gradient-primary text-primary-foreground shadow-glow gap-1.5">
          <CheckCircle2 className="h-4 w-4" /> {saving ? "Setting up…" : "Complete Setup →"}
        </Button>
      </div>
    </div>
  );
}

// ─── Full Dashboard ────────────────────────────────────────────
type DashTab = "overview" | "team" | "credits" | "requests";

function Dashboard({ company, setCompany, members, companyId, plan, maxHosts, reload, onEditProfile }: {
  company: CompanyProfile; setCompany: (c: CompanyProfile) => void;
  members: MemberRow[]; companyId: string;
  plan: ReturnType<typeof usePlan>["plan"]; maxHosts: number;
  reload: () => Promise<void>; onEditProfile: () => void;
}) {
  const { user, credits } = { user: useAuth().user, credits: usePlan().credits };
  const [tab, setTab] = useState<DashTab>("overview");
  const [savingProfile, setSavingProfile] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState({ ...company });

  // Credit transfer
  const [creditTarget, setCreditTarget] = useState<MemberRow | null>(null);
  const [creditAction, setCreditAction] = useState<"send" | "deduct">("send");
  const [creditAmt, setCreditAmt] = useState("");
  const [creditNote, setCreditNote] = useState("");
  const [transferring, setTransferring] = useState(false);

  // Add host
  const [showAddHost, setShowAddHost] = useState(false);
  const [hostDraft, setHostDraft] = useState({ full_name: "", invited_email: "", department: "", designation: "", initial_credits: "10" });
  const [addingHost, setAddingHost] = useState(false);

  // Tx history
  const [txList, setTxList] = useState<TxRow[]>([]);
  const [txLoading, setTxLoading] = useState(false);

  // Credit requests
  const [reqList, setReqList] = useState<CreditRequestRow[]>([]);
  const [reqLoading, setReqLoading] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    setReqLoading(true);
    const { data } = await (supabase as any)
      .from("credit_requests")
      .select("id, member_id, requester_user_id, amount, note, status, resolved_at, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    const rows = (data ?? []) as CreditRequestRow[];
    // Enrich with requester profile (name + email)
    if (rows.length) {
      const ids = [...new Set(rows.map((r) => r.requester_user_id))];
      const { data: profs } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
      const map = new Map((profs ?? []).map((p: any) => [p.id, p]));
      rows.forEach((r) => {
        const p = map.get(r.requester_user_id) as any;
        r.requester_name = p?.full_name ?? null;
        r.requester_email = p?.email ?? null;
      });
    }
    setReqList(rows);
    setReqLoading(false);
  }, [companyId]);

  const pendingCount = reqList.filter((r) => r.status === "pending").length;

  const approveReq = async (id: string) => {
    setResolvingId(id);
    const { error } = await (supabase as any).rpc("approve_credit_request", { p_request_id: id });
    setResolvingId(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Request approved — credits transferred");
    void loadRequests();
    void reload(); // refresh member balances & admin pool
  };

  const declineReq = async (id: string) => {
    setResolvingId(id);
    const { error } = await (supabase as any).rpc("decline_credit_request", { p_request_id: id });
    setResolvingId(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Request declined");
    void loadRequests();
  };

  const loadTx = useCallback(async () => {
    if (!user) return;
    setTxLoading(true);
    const { data } = await supabase.from("credit_transactions").select("id,type,amount,description,created_at")
      .eq("user_id", user.id).order("created_at", { ascending: false }).limit(30);
    if (data) setTxList(data as TxRow[]);
    setTxLoading(false);
  }, [user]);

  useEffect(() => { if (tab === "credits") void loadTx(); }, [tab, loadTx]);

  // Always preload requests so the tab badge can show pending count
  useEffect(() => { void loadRequests(); }, [loadRequests]);

  // Active hosts: sum of their current balance (already in their account).
  // Pending hosts: pre-allocated credits waiting to transfer on signup.
  const activeBalanceTotal = members
    .filter((m) => m.user_id)
    .reduce((s, m) => s + (m.balance ?? 0), 0);
  const pendingPreAllocated = members
    .filter((m) => !m.user_id)
    .reduce((s, m) => s + (m.credit_limit ?? 0), 0);
  const cfg = getCfg(profileDraft.company_type);

  const saveProfile = async () => {
    if (!profileDraft.company_name.trim()) { toast.error("Name required"); return; }
    setSavingProfile(true);
    const { error } = await supabase.from("company_profiles").update({
      company_name: profileDraft.company_name.trim(),
      company_type: profileDraft.company_type,
      registration_no: profileDraft.registration_no.trim() || null,
      website: profileDraft.website.trim() || null,
      address: profileDraft.address.trim() || null,
      city: profileDraft.city.trim() || null,
      province: profileDraft.province || null,
      phone: profileDraft.phone.trim() || null,
      email: profileDraft.email.trim() || null,
      total_students: profileDraft.total_students ? Number(profileDraft.total_students) : null,
      established_year: profileDraft.established_year ? Number(profileDraft.established_year) : null,
      description: profileDraft.description.trim() || null,
    }).eq("id", companyId);
    setSavingProfile(false);
    if (error) { toast.error(error.message); return; }
    setCompany({ ...profileDraft });
    setEditingProfile(false);
    toast.success("Profile updated!");
  };

  const addHost = async () => {
    if (!hostDraft.full_name.trim() || !hostDraft.invited_email.trim()) { toast.error("Name and email required"); return; }
    if (members.length >= maxHosts) { toast.error(`Max ${maxHosts} hosts on ${plan?.name}`); return; }
    const initialCredits = Math.max(0, parseInt(hostDraft.initial_credits) || 0);
    if (initialCredits > credits.balance) {
      toast.error(`Initial credits (${initialCredits}) exceeds your pool (${credits.balance})`);
      return;
    }
    setAddingHost(true);
    const token = crypto.randomUUID();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from("company_members") as any).insert({
      company_id: companyId, invited_email: hostDraft.invited_email.trim().toLowerCase(),
      full_name: hostDraft.full_name.trim(), role: "host",
      department: hostDraft.department || null, designation: hostDraft.designation || null,
      invite_token: token, status: "pending", credit_limit: initialCredits, credits_used: 0,
    }).select("id").single();
    if (error) { setAddingHost(false); toast.error((error as Error).message); return; }

    // Send invite email via Edge Function
    const { error: fnErr } = await supabase.functions.invoke("send-host-invite", {
      body: {
        invited_email: hostDraft.invited_email.trim().toLowerCase(),
        full_name: hostDraft.full_name.trim(),
        company_name: company.company_name,
        invite_token: token,
        member_id: (data as { id: string }).id,
      },
    });
    setAddingHost(false);
    if (fnErr) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body = await (fnErr as any).context?.json?.().catch?.(() => null);
      const detail = body?.error ?? (fnErr as Error).message;
      toast.warning(`${hostDraft.full_name} added, but email failed: ${detail}`);
    } else {
      toast.success(`Invite sent to ${hostDraft.invited_email}`);
    }
    void reload();
    setHostDraft({ full_name: "", invited_email: "", department: "", designation: "", initial_credits: "10" });
    setShowAddHost(false);
  };

  const removeHost = async (id: string, name: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("company_members") as any).delete().eq("id", id);
    if (error) { toast.error((error as Error).message); return; }
    void reload();
    toast.success(`${name} removed`);
  };

  const doCredit = async () => {
    if (!creditTarget || !user) return;
    const amt = parseInt(creditAmt);
    if (isNaN(amt) || amt <= 0) { toast.error("Enter a valid amount"); return; }
    if (creditAction === "send" && amt > credits.balance) { toast.error(`You only have ${credits.balance} credits`); return; }
    if (!creditTarget.user_id) { toast.error("Host hasn't signed up yet — share their invite link first"); return; }
    setTransferring(true);
    if (creditAction === "send") {
      const { error } = await supabase.rpc("transfer_credits_to_host", {
        p_admin_id: user.id, p_host_user_id: creditTarget.user_id,
        p_member_id: creditTarget.id, p_amount: amt,
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
        p_user_id: creditTarget.user_id, p_amount: amt,
        p_type: "admin_adjustment",
        p_description: creditNote.trim() || `Admin deducted ${amt} credits`,
      });
      if (error || !ok) { toast.error(error?.message ?? "Insufficient balance"); setTransferring(false); return; }
      toast.success(`${amt} credits deducted from ${creditTarget.full_name}`);
    }
    setTransferring(false);
    setCreditTarget(null); setCreditAmt(""); setCreditNote("");
    void reload();
    if (tab === "credits") void loadTx();
  };

  const TABS: { id: DashTab; label: string; icon: React.ElementType; badge?: number }[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "team",     label: "Team",     icon: Users },
    { id: "credits",  label: "Credits",  icon: Coins },
    { id: "requests", label: "Requests", icon: SendHorizonal, badge: pendingCount },
  ];

  return (
    <div className="max-w-5xl mx-auto pb-10 space-y-5">
      {/* ── Hero Header ── */}
      <div className="rounded-2xl border border-border bg-card/60 p-5 flex flex-wrap items-center gap-4">
        <div className="h-12 w-12 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center text-primary shadow-glow shrink-0">
          <Building2 className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight truncate">{company.company_name}</h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 text-warning px-2 py-0.5 text-[10px] font-semibold shrink-0">
              <Crown className="h-3 w-3" /> {plan?.name}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
            {company.city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{company.city}{company.province ? `, ${company.province}` : ""}</span>}
            {company.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{company.email}</span>}
            {company.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{company.phone}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link to="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors min-h-[36px]">
            <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
          </Link>
          <Button size="sm" variant="outline" onClick={() => { setProfileDraft({ ...company }); setEditingProfile(true); }} className="gap-1.5 text-xs min-h-[36px]">
            <Settings className="h-3.5 w-3.5" /> Edit
          </Button>
        </div>
      </div>

      {/* ── Quick stats bar ── */}
      <div className="grid grid-cols-1 min-[380px]:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {[
          { label: "Credit Pool", value: credits.balance, color: "text-warning", icon: Coins, border: "border-warning/30 bg-warning/5" },
          { label: "With Active Hosts", value: activeBalanceTotal, color: "text-success", icon: SendHorizonal, border: "border-success/20 bg-success/5" },
          { label: "Pending (pre-allocated)", value: pendingPreAllocated, color: "text-primary", icon: Clock, border: "border-primary/20 bg-primary/5" },
          { label: "Team Size", value: `${members.length}/${maxHosts}`, color: "text-foreground", icon: Users, border: "border-border bg-card/60" },
        ].map(({ label, value, color, icon: Icon, border }) => (
          <div key={label} className={`rounded-xl md:rounded-2xl border p-3 sm:p-4 min-h-[92px] ${border}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
              <Icon className={`h-3.5 w-3.5 ${color} opacity-60`} />
            </div>
            <div className={`font-display text-2xl font-bold ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className="overflow-x-auto border-b border-border pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="inline-flex min-w-max gap-1">
        {TABS.map(({ id, label, icon: Icon, badge }) => (
          <button key={id} type="button" onClick={() => setTab(id)}
            className={`min-h-11 rounded-t-xl flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${tab === id ? "border-primary bg-primary/10 text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            <Icon className="h-4 w-4" /> {label}
            {badge && badge > 0 ? (
              <span className="ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
                {badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>
      </div>

      {/* ══ TAB: OVERVIEW ══ */}
      {tab === "overview" && (
        <div className="space-y-5">
          {/* Company profile card */}
          <div className="rounded-xl md:rounded-2xl border border-border bg-card/50 overflow-hidden">
            <div className="px-4 md:px-5 py-4 border-b border-border flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <Building2 className="h-4 w-4 text-primary" /> Organization Profile
              </div>
              <span className="inline-flex items-center rounded-full bg-muted/40 text-muted-foreground px-2 py-0.5 text-[10px] font-medium capitalize">
                {COMPANY_TYPES.find((t) => t.value === company.company_type)?.label ?? company.company_type}
              </span>
            </div>
            <div className="p-4 md:p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              {[
                { label: getCfg(company.company_type).regLabel, value: company.registration_no },
                { label: getCfg(company.company_type).staffLabel, value: company.total_students },
                { label: "Established", value: company.established_year },
                { label: "City", value: company.city && company.province ? `${company.city}, ${company.province}` : company.city },
                { label: "Phone", value: company.phone },
                { label: "Email", value: company.email },
                { label: "Website", value: company.website },
                { label: "Address", value: company.address },
              ].filter((f) => f.value).map(({ label, value }) => (
                <div key={label}>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{label}</div>
                  <div className="font-medium text-sm">{value}</div>
                </div>
              ))}
              {company.description && (
                <div className="sm:col-span-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">About</div>
                  <div className="text-sm text-muted-foreground">{company.description}</div>
                </div>
              )}
            </div>
          </div>

          {/* Plan info */}
          <div className="rounded-xl md:rounded-2xl border border-warning/20 bg-warning/5 p-4 md:p-5 flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="rounded-xl bg-warning/15 p-3 shrink-0">
              <Crown className="h-5 w-5 text-warning" />
            </div>
            <div className="flex-1">
              <div className="font-semibold">{plan?.name}</div>
              <div className="text-xs text-muted-foreground mt-1 space-y-1">
                <div>Up to <strong>{maxHosts} hosts</strong> · {plan?.participants_per_session === -1 ? "Unlimited" : plan?.participants_per_session} students/session</div>
                <div><strong>{plan?.credits_per_month}</strong> credits/month included</div>
              </div>
            </div>
            <Link to="/billing" search={{ plan: "" }} className="text-xs font-semibold text-primary hover:underline shrink-0">
              Manage Plan →
            </Link>
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <button type="button" onClick={() => { setTab("team"); setShowAddHost(true); }}
              className="min-h-20 rounded-xl border border-border bg-card/40 hover:border-primary/40 hover:bg-primary/5 p-4 flex items-center gap-3 transition-all group text-left">
              <div className="rounded-xl bg-primary/10 p-2.5 shrink-0"><UserPlus className="h-4 w-4 text-primary" /></div>
              <div><div className="font-semibold text-sm group-hover:text-primary transition-colors">Add a Host</div><div className="text-xs text-muted-foreground">Invite a teacher or trainer</div></div>
              <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
            </button>
            <button type="button" onClick={() => setTab("credits")}
              className="min-h-20 rounded-xl border border-border bg-card/40 hover:border-primary/40 hover:bg-primary/5 p-4 flex items-center gap-3 transition-all group text-left">
              <div className="rounded-xl bg-warning/10 p-2.5 shrink-0"><Coins className="h-4 w-4 text-warning" /></div>
              <div><div className="font-semibold text-sm group-hover:text-primary transition-colors">Credit Overview</div><div className="text-xs text-muted-foreground">View balances & transactions</div></div>
              <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
            </button>
            <Link to="/billing" search={{ plan: "" }}
              className="min-h-20 rounded-xl border border-border bg-card/40 hover:border-primary/40 hover:bg-primary/5 p-4 flex items-center gap-3 transition-all group">
              <div className="rounded-xl bg-primary/10 p-2.5 shrink-0"><CreditCard className="h-4 w-4 text-primary" /></div>
              <div><div className="font-semibold text-sm group-hover:text-primary transition-colors">Buy More Credits</div><div className="text-xs text-muted-foreground">Top up your credit pool</div></div>
              <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
            </Link>
          </div>
        </div>
      )}

      {/* ══ TAB: TEAM ══ */}
      {tab === "team" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="font-semibold">Your Hosts</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{members.length} of {maxHosts} seats used</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => void reload()} className="h-10 gap-1.5"><RefreshCw className="h-3.5 w-3.5" /></Button>
              {members.length < maxHosts && (
                <Button size="sm" onClick={() => setShowAddHost(true)} className="h-10 flex-1 sm:flex-none bg-gradient-primary text-primary-foreground gap-1.5 shadow-glow">
                  <UserPlus className="h-3.5 w-3.5" /> Add Host
                </Button>
              )}
            </div>
          </div>

          {/* Add host inline form */}
          {showAddHost && (
            <div className="rounded-xl md:rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-3 [&_input]:min-h-11 sm:[&_input]:min-h-9">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold flex items-center gap-2"><UserPlus className="h-4 w-4 text-primary" /> New Host</span>
                <button type="button" title="Close" onClick={() => setShowAddHost(false)}><X className="h-4 w-4 text-muted-foreground hover:text-foreground" /></button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label className="text-xs">Full Name *</Label>
                  <Input value={hostDraft.full_name} onChange={(e) => setHostDraft({ ...hostDraft, full_name: e.target.value })} placeholder="e.g. Ahmad Ali" className="h-8 text-sm" /></div>
                <div className="space-y-1.5"><Label className="text-xs">Email *</Label>
                  <Input type="email" value={hostDraft.invited_email} onChange={(e) => setHostDraft({ ...hostDraft, invited_email: e.target.value })} placeholder="teacher@school.pk" className="h-8 text-sm" /></div>
                <div className="space-y-1.5"><Label className="text-xs">Department</Label>
                  <Select value={hostDraft.department} onValueChange={(v) => setHostDraft({ ...hostDraft, department: v })}>
                    <SelectTrigger className="min-h-11 sm:min-h-8 text-sm"><SelectValue placeholder="Optional" /></SelectTrigger>
                    <SelectContent>{DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                  </Select></div>
                <div className="space-y-1.5"><Label className="text-xs">Designation</Label>
                  <Select value={hostDraft.designation} onValueChange={(v) => setHostDraft({ ...hostDraft, designation: v })}>
                    <SelectTrigger className="min-h-11 sm:min-h-8 text-sm"><SelectValue placeholder="Optional" /></SelectTrigger>
                    <SelectContent>{DESIGNATIONS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                  </Select></div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs flex items-center gap-1.5">
                    <Coins className="h-3 w-3 text-warning" /> Initial Credits
                  </Label>
                  <Input
                    type="number" min={0} max={credits.balance}
                    value={hostDraft.initial_credits}
                    onChange={(e) => setHostDraft({ ...hostDraft, initial_credits: e.target.value })}
                    placeholder="10"
                    className="h-8 text-sm w-32"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Credits deducted from your pool (<span className="font-semibold text-warning">{credits.balance}</span> available) and given to host on signup.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setShowAddHost(false)} className="h-10">Cancel</Button>
                <Button size="sm" onClick={() => void addHost()} disabled={addingHost} className="h-10 bg-gradient-primary text-primary-foreground gap-1">
                  <Plus className="h-3.5 w-3.5" /> {addingHost ? "Adding…" : "Add Host"}
                </Button>
              </div>
            </div>
          )}

          {/* Host cards */}
          {members.length === 0 ? (
            <div className="rounded-xl md:rounded-2xl border border-dashed border-border bg-muted/10 py-14 text-center">
              <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-medium text-sm text-muted-foreground">No hosts yet</p>
              <p className="text-xs text-muted-foreground mt-1">Click "Add Host" to invite your first teacher</p>
            </div>
          ) : (
            <div className="space-y-3">
              {members.map((m) => (
                <div key={m.id} className="rounded-xl md:rounded-2xl border border-border bg-card/50 p-4 flex flex-col min-[460px]:flex-row min-[460px]:items-start gap-4 hover:border-primary/30 transition-colors">
                  {/* Avatar */}
                  <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                    {m.full_name.charAt(0).toUpperCase()}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{m.full_name}</span>
                      {m.user_id
                        ? <span className="inline-flex items-center gap-1 rounded-full bg-success/10 text-success px-2 py-0.5 text-[10px] font-semibold"><BadgeCheck className="h-2.5 w-2.5" /> Active</span>
                        : <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 text-warning px-2 py-0.5 text-[10px] font-semibold"><Clock className="h-2.5 w-2.5" /> Pending</span>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{m.invited_email}</div>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {m.department && <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-medium"><BookOpen className="h-2.5 w-2.5" />{m.department}</span>}
                      {m.designation && <span className="inline-flex items-center gap-1 rounded-full bg-muted/50 text-muted-foreground px-2 py-0.5 text-[10px] font-medium"><Briefcase className="h-2.5 w-2.5" />{m.designation}</span>}
                    </div>
                  </div>
                  {/* Credits */}
                  <div className="text-center shrink-0 hidden sm:block">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      {m.user_id ? "Balance" : "Pre-allocated"}
                    </div>
                    <div className="font-bold text-warning text-lg">
                      {m.user_id ? (m.balance ?? 0) : (m.credit_limit ?? 0)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">credits</div>
                  </div>
                  {/* Actions */}
                  <div className="grid grid-cols-2 min-[460px]:flex min-[460px]:flex-col gap-1.5 shrink-0 w-full min-[460px]:w-auto">
                    <Button size="sm" variant="outline" className="h-9 min-[460px]:h-7 px-2.5 text-[11px] gap-1 text-success border-success/30 hover:bg-success/10"
                      onClick={() => { setCreditTarget(m); setCreditAction("send"); }}>
                      <PlusCircle className="h-3 w-3" /> Send
                    </Button>
                    <Button size="sm" variant="outline" className="h-9 min-[460px]:h-7 px-2.5 text-[11px] gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={() => { setCreditTarget(m); setCreditAction("deduct"); }}>
                      <MinusCircle className="h-3 w-3" /> Deduct
                    </Button>
                    <button type="button" title="Remove host" onClick={() => void removeHost(m.id, m.full_name)}
                      className="h-9 min-[460px]:h-7 col-span-2 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors px-1.5">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Max hosts reached note */}
          {members.length >= maxHosts && (
            <div className="rounded-xl border border-warning/20 bg-warning/5 px-4 py-3 text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-warning shrink-0" />
              <span>Max hosts reached for <strong>{plan?.name}</strong>. <Link to="/billing" search={{ plan: "" }} className="underline font-semibold text-warning">Upgrade plan →</Link></span>
            </div>
          )}
        </div>
      )}

      {/* ══ TAB: CREDITS ══ */}
      {tab === "credits" && (
        <div className="space-y-5">
          {/* Credit pool overview */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl md:rounded-2xl border border-warning/30 bg-warning/5 p-4 md:p-5 sm:col-span-1">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-1"><Coins className="h-3.5 w-3.5" /> Available Pool</div>
              <div className="font-display text-4xl font-bold text-warning">{credits.balance}</div>
              <div className="text-xs text-muted-foreground mt-1">credits remaining</div>
              <Link to="/billing" search={{ plan: "" }} className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
                <Plus className="h-3.5 w-3.5" /> Buy more credits
              </Link>
            </div>
            <div className="rounded-xl md:rounded-2xl border border-border bg-card/60 p-4 md:p-5">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-1"><TrendingUp className="h-3.5 w-3.5" /> Total Earned</div>
              <div className="font-display text-3xl font-bold text-success">{credits.total_earned}</div>
              <div className="text-xs text-muted-foreground mt-1">all-time credits received</div>
            </div>
            <div className="rounded-xl md:rounded-2xl border border-border bg-card/60 p-4 md:p-5">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-1"><TrendingDown className="h-3.5 w-3.5" /> Total Spent</div>
              <div className="font-display text-3xl font-bold">{credits.total_spent}</div>
              <div className="text-xs text-muted-foreground mt-1">credits used so far</div>
            </div>
          </div>

          {/* Per-host credit snapshot */}
          {members.length > 0 && (
            <div className="rounded-xl md:rounded-2xl border border-border overflow-hidden">
              <div className="px-4 py-3 bg-muted/40 border-b border-border text-sm font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" /> Host Credit Snapshot
              </div>
              <div className="divide-y divide-border">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 px-3 sm:px-4 py-3">
                    <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                      {m.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{m.full_name}</div>
                      <div className="text-xs text-muted-foreground">{m.invited_email}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold text-warning">{m.user_id ? (m.balance ?? 0) : "—"}</div>
                      <div className="text-[10px] text-muted-foreground">balance</div>
                    </div>
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="outline" className="h-9 sm:h-7 px-2 text-[11px] gap-1 text-success border-success/30 hover:bg-success/10"
                        onClick={() => { setCreditTarget(m); setCreditAction("send"); setTab("team"); }}>
                        <SendHorizonal className="h-3 w-3" /> Send
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Transaction history */}
          <div className="rounded-xl md:rounded-2xl border border-border overflow-hidden">
            <div className="px-4 py-3 bg-muted/40 border-b border-border flex items-center justify-between">
              <div className="text-sm font-semibold flex items-center gap-2"><History className="h-4 w-4 text-primary" /> Credit Transaction History</div>
              <Button size="sm" variant="ghost" onClick={() => void loadTx()} className="h-7 w-7 p-0"><RefreshCw className="h-3.5 w-3.5" /></Button>
            </div>
            {txLoading ? (
              <div className="divide-y divide-border animate-pulse">
                {[...Array(4)].map((_, i) => <div key={i} className="h-14 px-4 flex items-center gap-3"><div className="h-8 w-8 rounded-lg bg-muted/40 shrink-0" /><div className="flex-1 space-y-1.5"><div className="h-3 bg-muted/40 rounded w-1/3" /><div className="h-2.5 bg-muted/30 rounded w-1/2" /></div><div className="h-4 w-10 bg-muted/40 rounded" /></div>)}
              </div>
            ) : txList.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">No transactions yet.</div>
            ) : (
              <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
                {txList.map((tx) => {
                  const isAdd = tx.amount > 0;
                  return (
                    <div key={tx.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
                      <div className={`rounded-lg p-1.5 shrink-0 ${isAdd ? "bg-success/15" : "bg-warning/15"}`}>
                        {isAdd ? <TrendingUp className="h-3.5 w-3.5 text-success" /> : <TrendingDown className="h-3.5 w-3.5 text-warning" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{TX_LABEL[tx.type] ?? tx.type.replace(/_/g, " ")}</div>
                        {tx.description && <div className="text-xs text-muted-foreground truncate">{tx.description}</div>}
                        <div className="text-[10px] text-muted-foreground">{new Date(tx.created_at).toLocaleString()}</div>
                      </div>
                      <div className={`text-sm font-bold shrink-0 ${isAdd ? "text-success" : "text-warning"}`}>
                        {isAdd ? "+" : ""}{tx.amount}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ TAB: REQUESTS ══ */}
      {tab === "requests" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Credit Requests</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {pendingCount > 0
                  ? `${pendingCount} pending · ${reqList.length} total`
                  : reqList.length === 0 ? "No requests yet" : `${reqList.length} processed`}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => void loadRequests()} className="h-10 gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>

          {reqLoading ? (
            <div className="space-y-3 animate-pulse">
              {[...Array(3)].map((_, i) => <div key={i} className="rounded-2xl border border-border bg-card/40 h-24" />)}
            </div>
          ) : reqList.length === 0 ? (
            <div className="rounded-xl md:rounded-2xl border border-dashed border-border bg-muted/10 py-14 text-center">
              <SendHorizonal className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-medium text-sm text-muted-foreground">No credit requests yet</p>
              <p className="text-xs text-muted-foreground mt-1">When your hosts request more credits, they'll appear here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reqList.map((r) => {
                const isPending = r.status === "pending";
                const isApproved = r.status === "approved";
                const insufficient = isPending && r.amount > credits.balance;
                return (
                  <div
                    key={r.id}
                    className={`rounded-xl md:rounded-2xl border p-4 flex flex-col min-[460px]:flex-row min-[460px]:items-start gap-4 transition-colors ${
                      isPending
                        ? "border-warning/30 bg-warning/5"
                        : isApproved
                        ? "border-success/20 bg-success/5"
                        : "border-border bg-muted/10"
                    }`}
                  >
                    <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                      {(r.requester_name ?? r.requester_email ?? "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{r.requester_name ?? r.requester_email ?? "Host"}</span>
                        {isPending && <span className="inline-flex items-center rounded-full bg-warning/15 text-warning px-2 py-0.5 text-[10px] font-semibold">Pending</span>}
                        {isApproved && <span className="inline-flex items-center gap-1 rounded-full bg-success/15 text-success px-2 py-0.5 text-[10px] font-semibold"><BadgeCheck className="h-2.5 w-2.5" /> Approved</span>}
                        {r.status === "declined" && <span className="inline-flex items-center rounded-full bg-destructive/15 text-destructive px-2 py-0.5 text-[10px] font-semibold">Declined</span>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">{r.requester_email ?? ""}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                        <span className="font-bold text-warning text-base flex items-center gap-1">
                          <Coins className="h-3.5 w-3.5" /> {r.amount} credits
                        </span>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
                      </div>
                      {r.note && (
                        <div className="mt-2 text-xs text-muted-foreground bg-background/60 rounded-lg px-3 py-1.5 border border-border">
                          "{r.note}"
                        </div>
                      )}
                      {insufficient && (
                        <div className="mt-2 text-[11px] text-destructive flex items-center gap-1.5">
                          <AlertCircle className="h-3 w-3" />
                          Your pool ({credits.balance} cr) is less than requested
                        </div>
                      )}
                    </div>
                    {isPending && (
                      <div className="grid grid-cols-2 min-[460px]:flex min-[460px]:flex-col gap-1.5 shrink-0 w-full min-[460px]:w-auto">
                        <Button
                          size="sm"
                          onClick={() => void approveReq(r.id)}
                          disabled={resolvingId === r.id || insufficient}
                          className="h-10 min-[460px]:h-8 px-3 text-[11px] gap-1 bg-success hover:bg-success/90 text-white"
                        >
                          <BadgeCheck className="h-3 w-3" />
                          {resolvingId === r.id ? "…" : "Approve"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void declineReq(r.id)}
                          disabled={resolvingId === r.id}
                          className="h-10 min-[460px]:h-8 px-3 text-[11px] gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                        >
                          <X className="h-3 w-3" /> Decline
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Credit Transfer Dialog ── */}
      <Dialog open={!!creditTarget} onOpenChange={(o) => { if (!o) { setCreditTarget(null); setCreditAmt(""); setCreditNote(""); } }}>
        <DialogContent className="max-w-sm [&_input]:min-h-11 sm:[&_input]:min-h-9">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {creditAction === "send"
                ? <><PlusCircle className="h-5 w-5 text-success" /> Send Credits</>
                : <><MinusCircle className="h-5 w-5 text-destructive" /> Deduct Credits</>}
            </DialogTitle>
          </DialogHeader>
          {creditTarget && (
            <div className="space-y-4 pt-1">
              <div className="rounded-xl border border-border bg-muted/20 px-4 py-3">
                <div className="font-semibold text-sm">{creditTarget.full_name}</div>
                <div className="text-xs text-muted-foreground">{creditTarget.invited_email}</div>
                <div className="mt-1.5 flex items-center gap-2 text-xs">
                  <Coins className="h-3.5 w-3.5 text-warning" />
                  <span className="font-bold text-warning">{creditTarget.user_id ? (creditTarget.balance ?? 0) : "—"} cr</span>
                  <span className="text-muted-foreground">balance</span>
                </div>
                {!creditTarget.user_id && (
                  <div className="mt-2 rounded-lg bg-warning/10 border border-warning/20 px-3 py-2 text-xs text-warning flex items-start gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    Host hasn't signed up yet. Share their invite link so they can join first.
                  </div>
                )}
              </div>
              {creditAction === "send" && (
                <div className="rounded-xl border border-warning/20 bg-warning/5 px-3 py-2 flex items-center gap-2 text-xs">
                  <Coins className="h-3.5 w-3.5 text-warning shrink-0" />
                  Your pool: <span className="font-bold text-warning ml-1">{credits.balance} credits</span>
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Amount (credits)</Label>
                <Input type="number" min={1} value={creditAmt} onChange={(e) => setCreditAmt(e.target.value)} placeholder="e.g. 100" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Note (optional)</Label>
                <Input value={creditNote} onChange={(e) => setCreditNote(e.target.value)} placeholder="Reason…" />
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="ghost" className="h-11 flex-1" onClick={() => setCreditTarget(null)} disabled={transferring}>Cancel</Button>
                <Button
                  className={`h-11 flex-1 gap-1.5 ${creditAction === "send" ? "bg-success hover:bg-success/90 text-white" : ""}`}
                  variant={creditAction === "deduct" ? "destructive" : "default"}
                  onClick={() => void doCredit()}
                  disabled={transferring || !creditTarget.user_id || !creditAmt}>
                  {creditAction === "send" ? <SendHorizonal className="h-4 w-4" /> : <MinusCircle className="h-4 w-4" />}
                  {transferring ? "Processing…" : `${creditAction === "send" ? "Send" : "Deduct"} ${creditAmt || 0} cr`}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Edit Profile Dialog ── */}
      <Dialog open={editingProfile} onOpenChange={(o) => { if (!o) setEditingProfile(false); }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto [&_input]:min-h-11 sm:[&_input]:min-h-9">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> Edit Organization Profile</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2 space-y-1.5">
                <Label>Organization Name *</Label>
                <Input value={profileDraft.company_name} onChange={(e) => setProfileDraft({ ...profileDraft, company_name: e.target.value })} />
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label>Organization Type</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {COMPANY_TYPES.map((t) => (
                    <button key={t.value} type="button"
                      onClick={() => setProfileDraft({ ...profileDraft, company_type: t.value })}
                      className={`rounded-xl border px-3 py-2 text-xs font-medium min-h-[36px] text-center transition-colors ${
                        profileDraft.company_type === t.value
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border bg-card/50 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      }`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{cfg.regLabel}</Label>
                <Input value={profileDraft.registration_no} onChange={(e) => setProfileDraft({ ...profileDraft, registration_no: e.target.value })} />
              </div>
              {cfg.showEstYear && (
                <div className="space-y-1.5">
                  <Label>Established Year</Label>
                  <Input type="number" value={profileDraft.established_year} onChange={(e) => setProfileDraft({ ...profileDraft, established_year: e.target.value })} />
                </div>
              )}
              <div className="space-y-1.5">
                <Label>{cfg.staffLabel}</Label>
                <Input type="number" value={profileDraft.total_students} onChange={(e) => setProfileDraft({ ...profileDraft, total_students: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={profileDraft.phone} onChange={(e) => setProfileDraft({ ...profileDraft, phone: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={profileDraft.email} onChange={(e) => setProfileDraft({ ...profileDraft, email: e.target.value })} />
              </div>
              {cfg.showWebsite && (
                <div className="space-y-1.5">
                  <Label>Website</Label>
                  <Input value={profileDraft.website} onChange={(e) => setProfileDraft({ ...profileDraft, website: e.target.value })} />
                </div>
              )}
              <div className="sm:col-span-2 space-y-1.5">
                <Label>Address</Label>
                <Input value={profileDraft.address} onChange={(e) => setProfileDraft({ ...profileDraft, address: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>City</Label>
                <Input value={profileDraft.city} onChange={(e) => setProfileDraft({ ...profileDraft, city: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Province</Label>
                <Select value={profileDraft.province} onValueChange={(v) => setProfileDraft({ ...profileDraft, province: v })}>
                  <SelectTrigger className="min-h-11 sm:min-h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{PROVINCES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label>About</Label>
                <textarea value={profileDraft.description} onChange={(e) => setProfileDraft({ ...profileDraft, description: e.target.value })}
                  rows={2} title="About your organization" placeholder="Brief description of your organization…"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40" />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="ghost" className="h-11 flex-1" onClick={() => setEditingProfile(false)}>Cancel</Button>
              <Button className="h-11 flex-1 bg-gradient-primary text-primary-foreground gap-1.5" onClick={() => void saveProfile()} disabled={savingProfile}>
                <Save className="h-4 w-4" /> {savingProfile ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
