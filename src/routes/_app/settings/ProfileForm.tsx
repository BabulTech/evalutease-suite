import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Lock, Upload } from "lucide-react";
import { toast } from "sonner";
import { validationError } from "@/components/ui/validation-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { optimizeAvatar, optimizeLogo } from "@/lib/image-optimization";
import { useI18n } from "@/lib/i18n";
import { usePlan } from "@/contexts/PlanContext";
import {
  ROLES_OPTS,
  USE_CASES_OPTS,
  REFERRALS_OPTS,
  REFERRAL_KEYS_MAP,
  INDUSTRIES_OPTS,
  TEAM_SIZES_OPTS,
  GRADE_YEARS_OPTS,
} from "./types";

type Profile = {
  first_name: string;
  last_name: string;
  organization: string;
  mobile: string;
  country: string;
  avatar_url: string;
  logo_url: string;
  role: string;
  use_cases: string[];
  referral: string;
  school: string;
  grade_year: string;
  field_of_study: string;
  institution: string;
  subject_taught: string;
  years_exp: string;
  company_name: string;
  industry: string;
  team_size: string;
  other_details: string;
};

function BrandingBlock({
  profile,
  setProfile,
  userId,
  uploadLogo,
  uploadingLogo,
}: {
  profile: Profile;
  setProfile: (fn: (p: Profile) => Profile) => void;
  userId: string;
  uploadLogo: (f: File | undefined) => Promise<void>;
  uploadingLogo: boolean;
}) {
  const { plan } = usePlan();
  const { t } = useI18n();
  const canBrand = plan?.custom_branding ?? false;

  return (
    <div className="rounded-xl border border-border bg-muted/10 p-4 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <Label className="text-sm font-semibold flex items-center gap-2">
            {t("settings.branding")}
            {!canBrand && (
              <span className="text-[10px] bg-warning/20 text-warning border border-warning/30 rounded-full px-2 py-0.5 font-semibold">
                {t("common.proPlus")}
              </span>
            )}
          </Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            {canBrand ? t("settings.brandingDesc") : t("settings.brandingLocked")}
          </p>
        </div>
        {!canBrand && (
          <Link
            to="/settings"
            search={{ tab: "plan" }}
            className="text-xs text-primary hover:underline flex items-center gap-1 shrink-0"
          >
            <Lock className="size-3" /> Upgrade
          </Link>
        )}
      </div>

      {canBrand ? (
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {profile.logo_url ? (
            <div className="h-12 w-auto rounded-xl border border-border bg-card/60 overflow-hidden flex items-center px-3">
              <img
                src={profile.logo_url}
                alt="Custom logo"
                className="h-8 w-auto object-contain max-w-[120px]"
              />
            </div>
          ) : (
            <div className="h-12 w-24 rounded-xl border border-dashed border-border bg-card/30 flex items-center justify-center text-[10px] text-muted-foreground">
              {t("settings.noLogo")}
            </div>
          )}
          <div>
            <Input
              id="logo-upload"
              type="file"
              accept="image/*"
              className="w-full max-w-xs min-h-11 sm:min-h-9"
              disabled={uploadingLogo}
              onChange={(e) => void uploadLogo(e.target.files?.[0])}
            />
            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Upload className="size-3.5" />
              {uploadingLogo ? t("settings.uploading") : t("settings.logoUploadHint")}
            </div>
          </div>
          {!!profile.logo_url && (
            <button
              type="button"
              className="text-xs text-destructive hover:underline"
              onClick={async () => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (supabase.from("profiles") as any).update({ logo_url: "" }).eq("id", userId);
                setProfile((p) => ({ ...p, logo_url: "" }));
                toast.success("Logo removed");
              }}
            >
              {t("settings.removeLogo")}
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-lg bg-muted/30 border border-dashed border-border p-4 flex items-center gap-3 opacity-60">
          <Lock className="size-5 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground">{t("settings.brandingLocked")}</span>
        </div>
      )}
    </div>
  );
}

export function ProfileForm({ userId }: { userId: string }) {
  const { t } = useI18n();
  const tUseCase = (uc: string) => t(`signup.useCase.${uc.toLowerCase()}`);
  const tReferral = (r: string) => t(REFERRAL_KEYS_MAP[r] ?? r);
  const tRole = (r: string) => t(`signup.role.${r.toLowerCase()}`);

  const [profile, setProfile] = useState<Profile>({
    first_name: "",
    last_name: "",
    organization: "",
    mobile: "",
    country: "",
    avatar_url: "",
    logo_url: "",
    role: "",
    use_cases: [],
    referral: "",
    school: "",
    grade_year: "",
    field_of_study: "",
    institution: "",
    subject_taught: "",
    years_exp: "",
    company_name: "",
    industry: "",
    team_size: "",
    other_details: "",
  });
  const [uploading, setUploading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const d = data as Record<string, unknown>;
        setProfile({
          first_name: (d.first_name as string) ?? "",
          last_name: (d.last_name as string) ?? "",
          organization: (d.organization as string) ?? "",
          mobile: (d.mobile as string) ?? "",
          country: (d.country as string) ?? "",
          avatar_url: (d.avatar_url as string) ?? "",
          logo_url: (d.logo_url as string) ?? "",
          role: (d.role as string) ?? "",
          use_cases: Array.isArray(d.use_cases) ? (d.use_cases as string[]) : [],
          referral: (d.referral as string) ?? "",
          school: (d.school as string) ?? "",
          grade_year: (d.grade_year as string) ?? "",
          field_of_study: (d.field_of_study as string) ?? "",
          institution: (d.institution as string) ?? "",
          subject_taught: (d.subject_taught as string) ?? "",
          years_exp: (d.years_exp as string) ?? "",
          company_name: (d.company_name as string) ?? "",
          industry: (d.industry as string) ?? "",
          team_size: (d.team_size as string) ?? "",
          other_details: (d.other_details as string) ?? "",
        });
      });
  }, [userId]);

  const name = `${profile.first_name} ${profile.last_name}`.trim() || "User";
  const initials = name.slice(0, 2).toUpperCase();

  const uploadAvatar = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      validationError("Choose an image file");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      validationError("Profile picture must be under 3 MB");
      return;
    }
    setUploading(true);
    const optimized = await optimizeAvatar(file).catch(() => file);
    const path = `${userId}/avatar-${Date.now()}.webp`;
    const { error } = await supabase.storage
      .from("avatars")
      .upload(path, optimized, { cacheControl: "3600", upsert: true });
    if (error) {
      setUploading(false);
      toast.error(error.message);
      return;
    }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    const avatar_url = data.publicUrl;
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url })
      .eq("id", userId);
    setUploading(false);
    if (updateError) {
      toast.error(updateError.message);
      return;
    }
    setProfile((prev) => ({ ...prev, avatar_url }));
    toast.success("Profile picture updated");
  };

  const uploadLogo = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      validationError("Choose an image file");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      validationError("Logo must be under 3 MB");
      return;
    }
    setUploadingLogo(true);
    const optimized = await optimizeLogo(file).catch(() => file);
    const path = `${userId}/logo-${Date.now()}.webp`;
    const { error } = await supabase.storage
      .from("avatars")
      .upload(path, optimized, { cacheControl: "3600", upsert: true });
    if (error) {
      setUploadingLogo(false);
      toast.error(error.message);
      return;
    }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    const logo_url = data.publicUrl;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase.from("profiles") as any)
      .update({ logo_url })
      .eq("id", userId);
    setUploadingLogo(false);
    if (updateError) {
      toast.error(updateError.message);
      return;
    }
    setProfile((prev) => ({ ...prev, logo_url }));
    toast.success("Logo updated - refresh to see it in the navbar");
  };

  const set =
    (k: keyof Omit<Profile, "use_cases" | "avatar_url" | "logo_url">) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setProfile((p) => ({ ...p, [k]: e.target.value }));

  const toggleUseCase = (val: string) =>
    setProfile((p) => ({
      ...p,
      use_cases: p.use_cases.includes(val)
        ? p.use_cases.filter((u) => u !== val)
        : [...p.use_cases, val],
    }));

  const save = async () => {
    setSaving(true);
    const full_name = `${profile.first_name} ${profile.last_name}`.trim();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("profiles") as any)
      .update({ ...profile, full_name })
      .eq("id", userId);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Profile saved");
  };

  const selectCls =
    "w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50";

  return (
    <div className="rounded-xl md:rounded-2xl border border-border bg-card/60 p-4 md:p-6 space-y-5 [&_input]:min-h-11 sm:[&_input]:min-h-9 [&_select]:min-h-11 sm:[&_select]:min-h-9">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Avatar className="size-20 border border-primary/30">
          {profile.avatar_url && <AvatarImage src={profile.avatar_url} />}
          <AvatarFallback className="bg-primary/15 text-primary text-xl font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <Label htmlFor="avatar-upload" className="mb-1.5 block">
            {t("settings.profilePicture")}
          </Label>
          <Input
            id="avatar-upload"
            type="file"
            accept="image/*"
            className="w-full max-w-sm"
            disabled={uploading}
            onChange={(e) => void uploadAvatar(e.target.files?.[0])}
          />
          <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Upload className="size-3.5" />{" "}
            {uploading ? t("settings.uploading") : t("settings.avatarUploadHint")}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="mb-1.5">{t("auth.firstName")}</Label>
          <Input
            value={profile.first_name}
            onChange={(e) => setProfile((p) => ({ ...p, first_name: e.target.value }))}
          />
        </div>
        <div>
          <Label className="mb-1.5">{t("auth.lastName")}</Label>
          <Input
            value={profile.last_name}
            onChange={(e) => setProfile((p) => ({ ...p, last_name: e.target.value }))}
          />
        </div>
      </div>
      <div>
        <Label className="mb-1.5">{t("auth.organization")}</Label>
        <Input
          value={profile.organization}
          onChange={(e) => setProfile((p) => ({ ...p, organization: e.target.value }))}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="mb-1.5">{t("auth.mobile")}</Label>
          <Input
            value={profile.mobile}
            onChange={(e) => setProfile((p) => ({ ...p, mobile: e.target.value }))}
          />
        </div>
        <div>
          <Label className="mb-1.5">{t("settings.country")}</Label>
          <Input
            value={profile.country}
            onChange={(e) => setProfile((p) => ({ ...p, country: e.target.value }))}
          />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-muted/10 p-4 space-y-4">
        <h3 className="text-sm font-semibold">{t("settings.aboutYou")}</h3>

        <div>
          <Label className="mb-1.5 text-xs">{t("settings.iAmA")}</Label>
          <select
            title={t("settings.iAmA")}
            value={profile.role}
            onChange={set("role")}
            className={selectCls}
          >
            <option value="" disabled>
              {t("signup.selectRole")}
            </option>
            {ROLES_OPTS.map((r) => (
              <option key={r} value={r}>
                {tRole(r)}
              </option>
            ))}
          </select>
        </div>

        {profile.role === "Student" && (
          <div className="space-y-3 p-3 rounded-xl bg-primary/5 border border-primary/15">
            <p className="text-xs font-semibold text-primary uppercase tracking-wide">
              {t("settings.studentDetails")}
            </p>
            <div>
              <Label className="mb-1.5 text-xs">School / University</Label>
              <Input
                value={profile.school}
                onChange={set("school")}
                placeholder="e.g. University of Karachi"
                className="h-9 text-sm"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 text-xs">Grade / Year</Label>
                <select
                  title="Grade / Year"
                  value={profile.grade_year}
                  onChange={set("grade_year")}
                  className={selectCls}
                >
                  <option value="" disabled>
                    Select
                  </option>
                  {GRADE_YEARS_OPTS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="mb-1.5 text-xs">Field of Study</Label>
                <Input
                  value={profile.field_of_study}
                  onChange={set("field_of_study")}
                  placeholder="e.g. Computer Science"
                  className="h-9 text-sm"
                />
              </div>
            </div>
          </div>
        )}

        {profile.role === "Teacher" && (
          <div className="space-y-3 p-3 rounded-xl bg-blue-500/5 border border-blue-500/15">
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-wide">
              {t("settings.teacherDetails")}
            </p>
            <div>
              <Label className="mb-1.5 text-xs">Institution / School Name</Label>
              <Input
                value={profile.institution}
                onChange={set("institution")}
                placeholder="e.g. Beaconhouse School"
                className="h-9 text-sm"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 text-xs">Subject Taught</Label>
                <Input
                  value={profile.subject_taught}
                  onChange={set("subject_taught")}
                  placeholder="e.g. Mathematics"
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <Label className="mb-1.5 text-xs">Years of Experience</Label>
                <Input
                  value={profile.years_exp}
                  onChange={set("years_exp")}
                  type="number"
                  min="0"
                  max="50"
                  placeholder="e.g. 5"
                  className="h-9 text-sm"
                />
              </div>
            </div>
          </div>
        )}

        {profile.role === "Employer" && (
          <div className="space-y-3 p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/15">
            <p className="text-xs font-semibold text-yellow-400 uppercase tracking-wide">
              {t("settings.employerDetails")}
            </p>
            <div>
              <Label className="mb-1.5 text-xs">{t("settings.companyName")}</Label>
              <Input
                value={profile.company_name}
                onChange={set("company_name")}
                placeholder="e.g. Acme Corp"
                className="h-9 text-sm"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 text-xs">{t("settings.industry")}</Label>
                <select
                  title={t("settings.industry")}
                  value={profile.industry}
                  onChange={set("industry")}
                  className={selectCls}
                >
                  <option value="" disabled>
                    Select
                  </option>
                  {INDUSTRIES_OPTS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="mb-1.5 text-xs">{t("settings.teamSize")}</Label>
                <select
                  title={t("settings.teamSize")}
                  value={profile.team_size}
                  onChange={set("team_size")}
                  className={selectCls}
                >
                  <option value="" disabled>
                    Select
                  </option>
                  {TEAM_SIZES_OPTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {profile.role === "Other" && (
          <div className="space-y-2 p-3 rounded-xl bg-purple-500/5 border border-purple-500/15">
            <p className="text-xs font-semibold text-purple-400 uppercase tracking-wide">
              {t("signup.other.details")}
            </p>
            <textarea
              aria-label="Other role details"
              value={profile.other_details}
              onChange={set("other_details")}
              rows={3}
              placeholder="Describe how you use EvaluTease..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            />
          </div>
        )}

        <div>
          <Label className="mb-2 text-xs block">{t("settings.useFor")}</Label>
          <div className="flex flex-wrap gap-2">
            {USE_CASES_OPTS.map((uc) => {
              const active = profile.use_cases.includes(uc);
              return (
                <button
                  key={uc}
                  type="button"
                  onClick={() => toggleUseCase(uc)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    active
                      ? "bg-primary text-primary-foreground border-primary shadow-glow"
                      : "bg-secondary/40 border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  }`}
                >
                  {active && <Check className="inline size-3 mr-1" />}
                  {tUseCase(uc)}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <Label className="mb-1.5 text-xs">{t("signup.hearAbout")}</Label>
          <select
            title={t("signup.hearAbout")}
            value={profile.referral}
            onChange={set("referral")}
            className={selectCls}
          >
            <option value="">Select an option</option>
            {REFERRALS_OPTS.map((r) => (
              <option key={r} value={r}>
                {tReferral(r)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <BrandingBlock
        profile={profile}
        setProfile={setProfile}
        userId={userId}
        uploadLogo={uploadLogo}
        uploadingLogo={uploadingLogo}
      />

      <Button
        onClick={save}
        disabled={saving}
        className="h-11 w-full sm:w-auto bg-gradient-primary text-primary-foreground shadow-glow"
      >
        {saving ? t("settings.saving") : t("settings.saveChanges")}
      </Button>
    </div>
  );
}
