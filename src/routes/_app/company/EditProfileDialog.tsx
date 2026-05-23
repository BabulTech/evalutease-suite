import { Building2, Save } from "lucide-react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { CompanyProfile } from "./types";
import { COMPANY_TYPES, PROVINCES, getCfg } from "./types";

type Props = {
  open: boolean;
  profileDraft: CompanyProfile;
  savingProfile: boolean;
  onClose: () => void;
  onChange: (c: CompanyProfile) => void;
  onSave: () => void;
};

export function EditProfileDialog({
  open,
  profileDraft,
  savingProfile,
  onClose,
  onChange,
  onSave,
}: Props) {
  const cfg = getCfg(profileDraft.company_type);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto [&_input]:min-h-11 sm:[&_input]:min-h-9">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="size-5" /> Edit Organization Profile
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Organization Name *</Label>
              <Input
                value={profileDraft.company_name}
                onChange={(e) => onChange({ ...profileDraft, company_name: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label>Organization Type</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {COMPANY_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => onChange({ ...profileDraft, company_type: t.value })}
                    className={`rounded-xl border px-3 py-2 text-xs font-medium min-h-[36px] text-center transition-colors ${
                      profileDraft.company_type === t.value
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
              <Label>{cfg.regLabel}</Label>
              <Input
                value={profileDraft.registration_no}
                onChange={(e) => onChange({ ...profileDraft, registration_no: e.target.value })}
              />
            </div>
            {cfg.showEstYear && (
              <div className="space-y-1.5">
                <Label>Established Year</Label>
                <Input
                  type="number"
                  value={profileDraft.established_year}
                  onChange={(e) => onChange({ ...profileDraft, established_year: e.target.value })}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>{cfg.staffLabel}</Label>
              <Input
                type="number"
                value={profileDraft.total_students}
                onChange={(e) => onChange({ ...profileDraft, total_students: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input
                value={profileDraft.phone}
                onChange={(e) => onChange({ ...profileDraft, phone: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                value={profileDraft.email}
                onChange={(e) => onChange({ ...profileDraft, email: e.target.value })}
              />
            </div>
            {cfg.showWebsite && (
              <div className="space-y-1.5">
                <Label>Website</Label>
                <Input
                  value={profileDraft.website}
                  onChange={(e) => onChange({ ...profileDraft, website: e.target.value })}
                />
              </div>
            )}
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Address</Label>
              <Input
                value={profileDraft.address}
                onChange={(e) => onChange({ ...profileDraft, address: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>City</Label>
              <Input
                value={profileDraft.city}
                onChange={(e) => onChange({ ...profileDraft, city: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Province</Label>
              <Select
                value={profileDraft.province}
                onValueChange={(v) => onChange({ ...profileDraft, province: v })}
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
            <div className="sm:col-span-2 space-y-1.5">
              <Label>About</Label>
              <textarea
                value={profileDraft.description}
                onChange={(e) => onChange({ ...profileDraft, description: e.target.value })}
                rows={2}
                aria-label="About your organization"
                title="About your organization"
                placeholder="Brief description of your organization…"
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="ghost" className="h-11 flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button
              className="h-11 flex-1 bg-gradient-primary text-primary-foreground gap-1.5"
              onClick={onSave}
              disabled={savingProfile}
            >
              <Save className="size-4" /> {savingProfile ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
