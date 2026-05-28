import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { usePlan } from "@/contexts/PlanContext";
import { Crown } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import type { CompanyProfile, MemberRow } from "./company/types";
import { OnboardingWizard } from "./company/OnboardingWizard";
import { Dashboard } from "./company/Dashboard";

// react-doctor-disable-next-line react-doctor/only-export-components
export const Route = createFileRoute("/_app/company")({ component: CompanyPage });

const EMPTY_PROFILE: CompanyProfile = {
  company_name: "",
  company_type: "school",
  registration_no: "",
  website: "",
  address: "",
  city: "",
  province: "Punjab",
  country: "Pakistan",
  phone: "",
  email: "",
  total_students: "",
  established_year: "",
  description: "",
};

// react-doctor-disable-next-line react-doctor/prefer-useReducer
// react-doctor-disable-next-line react-doctor/only-export-components
function CompanyPage() {
  const { user } = useAuth();
  const { plan } = usePlan();
  const isEnterprise = plan?.tier === "enterprise";
  const maxHosts = 10;

  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [company, setCompany] = useState<CompanyProfile>(EMPTY_PROFILE);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [onboardingDone, setOnboardingDone] = useState(false);

  const loadMembers = useCallback(async (cid: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("company_members")
      .select("*")
      .eq("company_id", cid);
    if (!data) return;
    const enriched: MemberRow[] = await Promise.all(
      data.map(async (m: MemberRow) => {
        if (!m.user_id) return { ...m, balance: 0 };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: wallet } = await (supabase as any)
          .from("user_credits")
          .select("balance")
          .eq("user_id", m.user_id)
          .maybeSingle();
        return { ...m, balance: wallet?.balance ?? 0 };
      }),
    );
    setMembers(enriched);
  }, []);

  const reload = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: comp } = await (supabase as any)
        .from("company_profiles")
        .select("*")
        .eq("admin_user_id", user.id)
        .single();
      if (comp) {
        setCompanyId(comp.id);
        setCompany(comp);
        setOnboardingDone(!!comp.onboarding_completed);
        await loadMembers(comp.id);
      }
    } finally {
      setLoading(false);
    }
  }, [user, loadMembers]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Re-fetch org data whenever the user gains enterprise access
  useEffect(() => {
    if (isEnterprise) void reload();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEnterprise]);

  if (!isEnterprise) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
        <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Crown className="size-8 text-primary" />
        </div>
        <h2 className="text-xl font-semibold">Enterprise Plan Required</h2>
        <p className="text-muted-foreground max-w-sm text-sm">
          Organization management is available on the Enterprise plan. Upgrade to manage hosts,
          credits, and team settings.
        </p>
        <Button asChild className="bg-gradient-primary text-primary-foreground">
          <Link to="/billing" search={{ plan: "enterprise" }}>
            Upgrade to Enterprise
          </Link>
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6 animate-pulse">
        <div className="h-32 rounded-2xl bg-muted/40" />
        <div className="h-10 rounded-xl bg-muted/30 w-1/3" />
        <div className="h-64 rounded-2xl bg-muted/40" />
      </div>
    );
  }

  if (!onboardingDone || !companyId) {
    return (
      <OnboardingWizard
        user={user!}
        plan={plan}
        maxHosts={maxHosts}
        companyId={companyId}
        setCompanyId={setCompanyId}
        company={company}
        setCompany={setCompany}
        members={members}
        setMembers={setMembers}
        onComplete={() => {
          setOnboardingDone(true);
          reload();
        }}
        onBack={() => {}}
      />
    );
  }

  return (
    <Dashboard
      company={company}
      setCompany={setCompany}
      members={members}
      companyId={companyId}
      plan={plan}
      maxHosts={maxHosts}
      reload={reload}
      onEditProfile={() => reload()}
    />
  );
}
