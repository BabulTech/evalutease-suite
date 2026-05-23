import { Link } from "@tanstack/react-router";
import { Building2, Crown } from "lucide-react";
import type { CompanyProfile } from "./types";
import { COMPANY_TYPES, getCfg } from "./types";
import type { PlanInfo } from "@/contexts/PlanContext";

type Props = {
  company: CompanyProfile;
  plan: PlanInfo | null;
  maxHosts: number;
  maxHostsDisplay: number | string;
};

export function OverviewTab({ company, plan, maxHosts: _maxHosts, maxHostsDisplay }: Props) {
  return (
    <div className="space-y-5">
      <div className="rounded-xl md:rounded-2xl border border-border bg-card/50 overflow-hidden">
        <div className="p-4 md:px-5 border-b border-border flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <Building2 className="size-4 text-primary" /> Organization Profile
          </div>
          <span className="inline-flex items-center rounded-full bg-muted/40 text-muted-foreground px-2 py-0.5 text-[10px] font-medium capitalize">
            {COMPANY_TYPES.find((t) => t.value === company.company_type)?.label ??
              company.company_type}
          </span>
        </div>
        <div className="p-4 md:p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          {[
            { label: getCfg(company.company_type).regLabel, value: company.registration_no },
            { label: getCfg(company.company_type).staffLabel, value: company.total_students },
            { label: "Established", value: company.established_year },
            {
              label: "City",
              value:
                company.city && company.province
                  ? `${company.city}, ${company.province}`
                  : company.city,
            },
            { label: "Phone", value: company.phone },
            { label: "Email", value: company.email },
            { label: "Website", value: company.website },
            { label: "Address", value: company.address },
          ].flatMap(({ label, value }) =>
            !value
              ? []
              : [
                  <div key={label}>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
                      {label}
                    </div>
                    <div className="font-medium text-sm">{value}</div>
                  </div>,
                ],
          )}
          {company.description && (
            <div className="sm:col-span-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
                About
              </div>
              <div className="text-sm text-muted-foreground">{company.description}</div>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl md:rounded-2xl border border-warning/20 bg-warning/5 p-4 md:p-5 flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="rounded-xl bg-warning/15 p-3 shrink-0">
          <Crown className="size-5 text-warning" />
        </div>
        <div className="flex-1">
          <div className="font-semibold">{plan?.name}</div>
          <div className="text-xs text-muted-foreground mt-1 space-y-1">
            <div>
              Up to <strong>{maxHostsDisplay} hosts</strong> ·{" "}
              {plan?.participants_per_session === -1 ? "Unlimited" : plan?.participants_per_session}{" "}
              students/session
            </div>
            <div>
              <strong>{plan?.credits_per_month}</strong> credits/month included
            </div>
          </div>
        </div>
        <Link
          to="/billing"
          search={{ plan: "" }}
          className="text-xs font-semibold text-primary hover:underline shrink-0"
        >
          Manage Plan →
        </Link>
      </div>
    </div>
  );
}
