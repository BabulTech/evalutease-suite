import { Link } from "@tanstack/react-router";
import {
  AlertCircle,
  BadgeCheck,
  BookOpen,
  Briefcase,
  Clock,
  Coins,
  MinusCircle,
  Plus,
  PlusCircle,
  RefreshCw,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
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
import type { MemberRow } from "./types";
import { DEPARTMENTS, DESIGNATIONS } from "./types";
import type { PlanInfo, CreditInfo } from "@/contexts/PlanContext";

type Props = {
  members: MemberRow[];
  maxHosts: number;
  maxHostsDisplay: number | string;
  plan: PlanInfo | null;
  credits: CreditInfo;
  showCredits: boolean;
  showAddHost: boolean;
  hostDraft: {
    full_name: string;
    invited_email: string;
    department: string;
    designation: string;
    initial_credits: string;
  };
  addingHost: boolean;
  onSetShowAddHost: (v: boolean) => void;
  onHostDraftChange: (d: {
    full_name: string;
    invited_email: string;
    department: string;
    designation: string;
    initial_credits: string;
  }) => void;
  onAddHost: () => void;
  onRemoveHost: (id: string, name: string) => void;
  onSendCredit: (m: MemberRow) => void;
  onDeductCredit: (m: MemberRow) => void;
  onReload: () => void;
};

export function TeamTab({
  members,
  maxHosts,
  maxHostsDisplay: _maxHostsDisplay,
  plan,
  credits,
  showCredits,
  showAddHost,
  hostDraft,
  addingHost,
  onSetShowAddHost,
  onHostDraftChange,
  onAddHost,
  onRemoveHost,
  onSendCredit,
  onDeductCredit,
  onReload,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="font-semibold">Your Hosts</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {members.length} of {maxHosts} seats used
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onReload} className="h-10 gap-1.5">
            <RefreshCw className="size-3.5" />
          </Button>
          {members.length < maxHosts && (
            <Button
              size="sm"
              onClick={() => onSetShowAddHost(true)}
              className="h-10 flex-1 sm:flex-none bg-gradient-primary text-primary-foreground gap-1.5 shadow-glow"
            >
              <UserPlus className="size-3.5" /> Add Host
            </Button>
          )}
        </div>
      </div>

      {showAddHost && (
        <div className="rounded-xl md:rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-3 [&_input]:min-h-11 sm:[&_input]:min-h-9">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold flex items-center gap-2">
              <UserPlus className="size-4 text-primary" /> New Host
            </span>
            <button type="button" title="Close" onClick={() => onSetShowAddHost(false)}>
              <X className="size-4 text-muted-foreground hover:text-foreground" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Full Name *</Label>
              <Input
                value={hostDraft.full_name}
                onChange={(e) => onHostDraftChange({ ...hostDraft, full_name: e.target.value })}
                placeholder="e.g. Ahmad Ali"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email *</Label>
              <Input
                type="email"
                value={hostDraft.invited_email}
                onChange={(e) => onHostDraftChange({ ...hostDraft, invited_email: e.target.value })}
                placeholder="teacher@school.pk"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Department</Label>
              <Select
                value={hostDraft.department}
                onValueChange={(v) => onHostDraftChange({ ...hostDraft, department: v })}
              >
                <SelectTrigger className="min-h-11 sm:min-h-8 text-sm">
                  <SelectValue placeholder="Optional" />
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
                value={hostDraft.designation}
                onValueChange={(v) => onHostDraftChange({ ...hostDraft, designation: v })}
              >
                <SelectTrigger className="min-h-11 sm:min-h-8 text-sm">
                  <SelectValue placeholder="Optional" />
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
                <Label className="text-xs flex items-center gap-1.5">
                  <Coins className="size-3 text-warning" /> Initial Credits
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={credits.balance}
                  value={hostDraft.initial_credits}
                  onChange={(e) =>
                    onHostDraftChange({ ...hostDraft, initial_credits: e.target.value })
                  }
                  placeholder="10"
                  className="h-8 text-sm w-32"
                />
                <p className="text-[10px] text-muted-foreground">
                  Credits deducted from your pool (
                  <span className="font-semibold text-warning">{credits.balance}</span> available)
                  and given to host on signup.
                </p>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onSetShowAddHost(false)}
              className="h-10"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={onAddHost}
              disabled={addingHost}
              className="h-10 bg-gradient-primary text-primary-foreground gap-1"
            >
              <Plus className="size-3.5" /> {addingHost ? "Adding…" : "Add Host"}
            </Button>
          </div>
        </div>
      )}

      {members.length === 0 ? (
        <div className="rounded-xl md:rounded-2xl border border-dashed border-border bg-muted/10 py-14 text-center">
          <Users className="size-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="font-medium text-sm text-muted-foreground">No hosts yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Click "Add Host" to invite your first teacher
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {members.map((m) => (
            <div
              key={m.id}
              className="rounded-xl md:rounded-2xl border border-border bg-card/50 p-4 flex flex-col min-[460px]:flex-row min-[460px]:items-start gap-4 hover:border-primary/30 transition-colors"
            >
              <div className="size-10 rounded-full bg-primary/15 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                {m.full_name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{m.full_name}</span>
                  {m.user_id ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success/10 text-success px-2 py-0.5 text-[10px] font-semibold">
                      <BadgeCheck className="size-2.5" /> Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 text-warning px-2 py-0.5 text-[10px] font-semibold">
                      <Clock className="size-2.5" /> Pending
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">{m.invited_email}</div>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {m.department && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-medium">
                      <BookOpen className="size-2.5" />
                      {m.department}
                    </span>
                  )}
                  {m.designation && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted/50 text-muted-foreground px-2 py-0.5 text-[10px] font-medium">
                      <Briefcase className="size-2.5" />
                      {m.designation}
                    </span>
                  )}
                </div>
              </div>
              {showCredits && (
                <div className="text-center shrink-0 hidden sm:block">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    {m.user_id ? "Balance" : "Pre-allocated"}
                  </div>
                  <div className="font-bold text-warning text-lg">
                    {m.user_id ? (m.balance ?? 0) : (m.credit_limit ?? 0)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">credits</div>
                </div>
              )}
              <div className="flex flex-col gap-1.5 shrink-0">
                {showCredits && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2.5 text-[11px] gap-1 text-success border-success/30 hover:bg-success/10"
                      onClick={() => onSendCredit(m)}
                    >
                      <PlusCircle className="size-3" /> Send
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2.5 text-[11px] gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={() => onDeductCredit(m)}
                    >
                      <MinusCircle className="size-3" /> Deduct
                    </Button>
                  </>
                )}
                <button
                  type="button"
                  title="Remove host"
                  onClick={() => onRemoveHost(m.id, m.full_name)}
                  className="h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors px-1.5"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {members.length >= maxHosts && (
        <div className="rounded-xl border border-warning/20 bg-warning/5 px-4 py-3 text-sm flex items-center gap-2">
          <AlertCircle className="size-4 text-warning shrink-0" />
          <span>
            Max hosts reached for <strong>{plan?.name}</strong>.{" "}
            <Link
              to="/billing"
              search={{ plan: "" }}
              className="underline font-semibold text-warning"
            >
              Upgrade plan →
            </Link>
          </span>
        </div>
      )}
    </div>
  );
}
