import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  GraduationCap,
  Hash,
  Mail,
  MapPin,
  Phone,
  Globe,
  Plus,
  Save,
  Trash2,
  UserPlus,
  Users,
  Crown,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { validationError } from "@/components/ui/validation-toast";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { User as AuthUser } from "@supabase/supabase-js";
import type { CompanyProfile, MemberRow } from "./types";
import { COMPANY_TYPES, PROVINCES, DEPARTMENTS, DESIGNATIONS, getCfg } from "./types";
import type { PlanInfo } from "@/contexts/PlanContext";

type Props = {
  user: AuthUser;
  plan: PlanInfo | null;
  maxHosts: number;
  companyId: string | null;
  setCompanyId: (id: string) => void;
  company: CompanyProfile;
  setCompany: (c: CompanyProfile) => void;
  members: MemberRow[];
  setMembers: (m: MemberRow[]) => void;
  onComplete: () => void;
  onBack: () => void;
};

export function OnboardingWizard({
  user,
  plan,
  maxHosts,
  companyId,
  setCompanyId,
  company,
  setCompany,
  members,
  setMembers,
  onComplete,
  onBack,
}: Props) {
  const [step, setStep] = useState<1 | 2>(companyId ? 2 : 1);
  const [saving, setSaving] = useState(false);
  const cfg = getCfg(company.company_type);

  const saveCompany = async (goNext: boolean) => {
    if (!company.company_name.trim()) {
      validationError("Organization name is required");
      return;
    }
    setSaving(true);
    const payload = {
      admin_user_id: user.id,
      company_name: company.company_name.trim(),
      company_type: company.company_type as
        | "school"
        | "university"
        | "college"
        | "training_center"
        | "corporate"
        | "government"
        | "ngo"
        | "other",
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
      if (error) {
        toast.error(error.message);
        setSaving(false);
        return;
      }
    } else {
      const { data, error } = await supabase
        .from("company_profiles")
        .insert(payload)
        .select("id")
        .single();
      if (error) {
        toast.error(error.message);
        setSaving(false);
        return;
      }
      id = (data as { id: string }).id;
      setCompanyId(id);
    }
    setSaving(false);
    toast.success(goNext ? "Saved! Now add your hosts." : "Draft saved.");
    if (goNext) setStep(2);
  };

  const finishOnboarding = async () => {
    if (!companyId) return;
    setSaving(true);
    const { error } = await supabase
      .from("company_profiles")
      .update({ onboarding_completed: true })
      .eq("id", companyId);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Organization setup complete!");
    onComplete();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5 md:space-y-6 pb-10">
      <div className="flex items-start gap-3 pt-2">
        <button
          type="button"
          title="Back"
          onClick={onBack}
          className="rounded-xl p-2 hover:bg-muted/40 transition-colors"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div>
          <h1 className="font-display text-xl md:text-2xl font-semibold flex items-center gap-2">
            Organization Setup
          </h1>
          <p className="text-sm text-muted-foreground">One-time setup, takes less than 2 minutes</p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-0">
        {(
          [
            { n: 1, label: "Organization Info" },
            { n: 2, label: "Add Hosts" },
          ] as const
        ).map(({ n, label }, idx) => (
          <div key={n} className="flex items-center flex-1">
            <div
              className={`flex items-center gap-2 ${step >= n ? "text-primary" : "text-muted-foreground"}`}
            >
              <div
                className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${step > n ? "bg-primary border-primary text-primary-foreground" : step === n ? "border-primary text-primary" : "border-muted-foreground/30"}`}
              >
                {step > n ? <CheckCircle2 className="size-4" /> : n}
              </div>
              <span className="text-xs font-semibold hidden sm:block">{label}</span>
            </div>
            {idx < 1 && (
              <div className={`flex-1 h-px mx-3 ${step > n ? "bg-primary" : "bg-muted/40"}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Org Info */}
      {step === 1 && (
        <div className="rounded-xl md:rounded-2xl border border-border bg-card/40 p-4 md:p-6 space-y-5 [&_input]:min-h-11 sm:[&_input]:min-h-9">
          <p className="text-xs text-muted-foreground">
            Fields marked <span className="text-destructive">*</span> are required
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <Label>
                Organization Name <span className="text-destructive">*</span>
              </Label>
              <Input
                value={company.company_name}
                onChange={(e) => setCompany({ ...company, company_name: e.target.value })}
                placeholder={
                  company.company_type === "corporate"
                    ? "e.g. ABC Pvt. Ltd."
                    : company.company_type === "government"
                      ? "e.g. Directorate of Education Punjab"
                      : "e.g. Pakistan Model School"
                }
              />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label>
                Organization Type <span className="text-destructive">*</span>
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {COMPANY_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setCompany({ ...company, company_type: t.value })}
                    className={`rounded-xl border px-3 py-2.5 text-xs font-medium min-h-[40px] text-center transition-colors ${
                      company.company_type === t.value
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border bg-card/50 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Hash className="size-3.5" /> {cfg.regLabel}
              </Label>
              <Input
                value={company.registration_no}
                onChange={(e) => setCompany({ ...company, registration_no: e.target.value })}
                placeholder={cfg.regPlaceholder}
              />
            </div>
            {cfg.showEstYear && (
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <GraduationCap className="size-3.5" /> Established Year
                </Label>
                <Input
                  type="number"
                  value={company.established_year}
                  onChange={(e) => setCompany({ ...company, established_year: e.target.value })}
                  placeholder="e.g. 2005"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Users className="size-3.5" /> {cfg.staffLabel}
              </Label>
              <Input
                type="number"
                value={company.total_students}
                onChange={(e) => setCompany({ ...company, total_students: e.target.value })}
                placeholder={cfg.staffPlaceholder}
              />
            </div>
          </div>
          <div className="border-t border-border/40 pt-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Contact Details
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Phone className="size-3.5" /> Phone
                </Label>
                <Input
                  value={company.phone}
                  onChange={(e) => setCompany({ ...company, phone: e.target.value })}
                  placeholder="+92 300 0000000"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Mail className="size-3.5" /> Official Email
                </Label>
                <Input
                  type="email"
                  value={company.email}
                  onChange={(e) => setCompany({ ...company, email: e.target.value })}
                  placeholder="info@org.pk"
                />
              </div>
              {cfg.showWebsite && (
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <Globe className="size-3.5" /> Website
                  </Label>
                  <Input
                    value={company.website}
                    onChange={(e) => setCompany({ ...company, website: e.target.value })}
                    placeholder="https://org.pk"
                  />
                </div>
              )}
            </div>
          </div>
          <div className="border-t border-border/40 pt-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <MapPin className="size-3.5" /> Location
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <Label>Address</Label>
                <Input
                  value={company.address}
                  onChange={(e) => setCompany({ ...company, address: e.target.value })}
                  placeholder="Street, area"
                />
              </div>
              <div className="space-y-1.5">
                <Label>City</Label>
                <Input
                  value={company.city}
                  onChange={(e) => setCompany({ ...company, city: e.target.value })}
                  placeholder="e.g. Lahore"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Province</Label>
                <Select
                  value={company.province}
                  onValueChange={(v) => setCompany({ ...company, province: v })}
                >
                  <SelectTrigger className="min-h-11 sm:min-h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVINCES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>
              About <span className="text-muted-foreground text-xs font-normal">(optional)</span>
            </Label>
            <textarea
              aria-label="About your organization"
              value={company.description}
              onChange={(e) => setCompany({ ...company, description: e.target.value })}
              placeholder="Brief description of your organization…"
              rows={2}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              onClick={() => void saveCompany(false)}
              disabled={saving}
              className="h-11 gap-1.5"
            >
              <Save className="size-4" /> Save Draft
            </Button>
            <Button
              onClick={() => void saveCompany(true)}
              disabled={saving}
              className="h-11 flex-1 bg-gradient-primary text-primary-foreground shadow-glow gap-1.5"
            >
              Continue to Add Hosts <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Add Hosts */}
      {step === 2 && companyId && (
        <HostsStep
          companyId={companyId}
          members={members}
          maxHosts={maxHosts}
          plan={plan}
          companyName={company.company_name}
          onMembersChange={setMembers}
          saving={saving}
          setSaving={setSaving}
          onBack={() => setStep(1)}
          onFinish={() => void finishOnboarding()}
        />
      )}
    </div>
  );
}

function HostsStep({
  companyId,
  members,
  maxHosts,
  plan,
  companyName,
  onMembersChange,
  saving,
  setSaving,
  onBack,
  onFinish,
}: {
  companyId: string;
  members: MemberRow[];
  maxHosts: number;
  companyName: string;
  plan: PlanInfo | null;
  onMembersChange: (m: MemberRow[]) => void;
  saving: boolean;
  setSaving: (v: boolean) => void;
  onBack: () => void;
  onFinish: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState({
    full_name: "",
    invited_email: "",
    department: "",
    designation: "",
    initial_credits: "10",
  });

  const add = async () => {
    if (!draft.full_name.trim() || !draft.invited_email.trim()) {
      validationError("Name and email required");
      return;
    }
    if (members.length >= maxHosts) {
      validationError(`Max ${maxHosts} hosts on ${plan?.name}`);
      return;
    }
    const emailLower = draft.invited_email.trim().toLowerCase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingMember } = await (supabase.from("company_members") as any)
      .select("id")
      .eq("company_id", companyId)
      .eq("invited_email", emailLower)
      .maybeSingle();
    if (existingMember) {
      validationError("This email is already invited or a member.");
      return;
    }
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", emailLower)
      .maybeSingle();
    if (existingProfile) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: otherMember } = await (supabase.from("company_members") as any)
        .select("id")
        .eq("user_id", existingProfile.id)
        .maybeSingle();
      if (otherMember) {
        validationError("This user already belongs to another organization.");
        return;
      }
    }
    const initialCredits = Math.max(0, parseInt(draft.initial_credits) || 0);
    setSaving(true);
    const token = crypto.randomUUID();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from("company_members") as any)
      .insert({
        company_id: companyId,
        invited_email: emailLower,
        full_name: draft.full_name.trim(),
        role: "host",
        department: draft.department || null,
        designation: draft.designation || null,
        invite_token: token,
        status: "pending",
        credit_limit: initialCredits,
        credits_used: 0,
      })
      .select("*")
      .single();
    if (error) {
      setSaving(false);
      toast.error((error as Error).message);
      return;
    }
    const member = data as unknown as MemberRow;
    const appOrigin = import.meta.env.VITE_APP_URL || window.location.origin;
    const inviteLink = `${appOrigin}/accept-invite?token=${token}&member_id=${member.id}&email=${encodeURIComponent(member.invited_email)}`;
    const { error: fnErr } = await supabase.functions.invoke("send-email", {
      body: {
        type: "host_invite",
        data: { to: member.invited_email, fullName: member.full_name, companyName, inviteLink },
      },
    });
    setSaving(false);
    if (fnErr) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body = await (fnErr as any).context?.json?.().catch?.(() => null);
      toast.warning(
        `${draft.full_name} added, but email failed: ${body?.error ?? (fnErr as Error).message}`,
      );
    } else {
      toast.success(`Invite sent to ${emailLower}`);
    }
    onMembersChange([...members, member]);
    setDraft({
      full_name: "",
      invited_email: "",
      department: "",
      designation: "",
      initial_credits: "10",
    });
    setShowForm(false);
  };

  const remove = async (id: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("company_members") as any).delete().eq("id", id);
    if (error) {
      toast.error((error as Error).message);
      return;
    }
    onMembersChange(members.filter((m) => m.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <Crown className="size-4 text-primary" />
          <span>
            <strong>{plan?.name}</strong>, {maxHosts} hosts allowed
          </span>
        </div>
        <span className="font-bold text-primary">
          {members.length}/{maxHosts} added
        </span>
      </div>

      <div className="rounded-2xl border border-border bg-card/40 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="font-semibold text-sm flex items-center gap-2">
            <Users className="size-4 text-primary" /> Your Hosts
          </div>
          {members.length < maxHosts && (
            <Button
              size="sm"
              onClick={() => setShowForm(true)}
              className="bg-gradient-primary text-primary-foreground gap-1.5 text-xs"
            >
              <UserPlus className="size-3.5" /> Add Host
            </Button>
          )}
        </div>

        {showForm && (
          <div className="border-b border-border bg-muted/10 p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Full Name *</Label>
                <Input
                  value={draft.full_name}
                  onChange={(e) => setDraft((p) => ({ ...p, full_name: e.target.value }))}
                  placeholder="e.g. Ayesha Khan"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email *</Label>
                <Input
                  type="email"
                  value={draft.invited_email}
                  onChange={(e) => setDraft((p) => ({ ...p, invited_email: e.target.value }))}
                  placeholder="teacher@school.edu.pk"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Department</Label>
                <Select
                  value={draft.department}
                  onValueChange={(v) => setDraft((p) => ({ ...p, department: v }))}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Designation</Label>
                <Select
                  value={draft.designation}
                  onValueChange={(v) => setDraft((p) => ({ ...p, designation: v }))}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {DESIGNATIONS.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {plan?.can_buy_credits && (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Initial Credits</Label>
                  <Input
                    type="number"
                    min={0}
                    value={draft.initial_credits}
                    onChange={(e) => setDraft((p) => ({ ...p, initial_credits: e.target.value }))}
                    placeholder="10"
                    className="h-8 text-sm w-32"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Deducted from your balance when host accepts invite
                  </p>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
                <X className="size-3.5 mr-1" /> Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => void add()}
                disabled={saving}
                className="bg-gradient-primary text-primary-foreground gap-1"
              >
                <Plus className="size-3.5" /> {saving ? "Adding…" : "Add Host"}
              </Button>
            </div>
          </div>
        )}

        {members.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <Users className="size-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground font-medium">No hosts yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Add teachers or trainers who will conduct quizzes
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                <div className="size-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                  {m.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{m.full_name}</div>
                  <div className="text-xs text-muted-foreground">{m.invited_email}</div>
                </div>
                <span className="inline-flex items-center rounded-full bg-warning/10 text-warning px-2 py-0.5 text-[10px] font-semibold">
                  Pending
                </span>
                <button
                  type="button"
                  title="Remove"
                  onClick={() => void remove(m.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors p-1"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="size-4 mr-1" /> Back
        </Button>
        <Button
          onClick={onFinish}
          disabled={saving}
          className="flex-1 bg-gradient-primary text-primary-foreground shadow-glow gap-1.5"
        >
          <CheckCircle2 className="size-4" /> {saving ? "Setting up…" : "Complete Setup →"}
        </Button>
      </div>
    </div>
  );
}
