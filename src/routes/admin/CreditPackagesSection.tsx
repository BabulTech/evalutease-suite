import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Plus, X, Edit2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SectionHead } from "./-shared";

// react-doctor-disable-next-line react-doctor/prefer-useReducer
export function CreditPackagesSection() {
  type PkgRow = {
    id: string;
    name: string;
    credits: number;
    price_pkr: number;
    badge_text: string | null;
    is_active: boolean;
    sort_order: number;
    allowed_tiers: string[];
  };
  const [packages, setPackages] = useState<PkgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<PkgRow | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);

  const blankPkg = (): PkgRow => ({
    id: "",
    name: "",
    credits: 100,
    price_pkr: 199,
    badge_text: null,
    is_active: true,
    sort_order: 0,
    allowed_tiers: ["individual", "enterprise"],
  });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("credit_packages").select("*").order("sort_order");
    setPackages((data ?? []) as PkgRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    const payload = {
      name: editing.name,
      credits: editing.credits,
      price_pkr: editing.price_pkr,
      badge_text: editing.badge_text || null,
      is_active: editing.is_active,
      sort_order: editing.sort_order,
      allowed_tiers: editing.allowed_tiers,
    };
    const { error } = isNew
      ? await supabase.from("credit_packages").insert(payload)
      : await supabase.from("credit_packages").update(payload).eq("id", editing.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(isNew ? "Package created" : "Package saved");
    setEditing(null);
    setIsNew(false);
    void load();
  };

  const del = async (id: string) => {
    await supabase.from("credit_packages").delete().eq("id", id);
    void load();
  };

  const costPer = (pkg: PkgRow) => (pkg.price_pkr / pkg.credits).toFixed(2);
  const margin = (pkg: PkgRow) =>
    Math.round(((pkg.price_pkr - pkg.credits * 0.7) / pkg.price_pkr) * 100);

  return (
    <div className="space-y-4">
      <SectionHead
        title="Credit Packages"
        sub="Manage add-on credit packages users can purchase."
      />
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setEditing(blankPkg());
            setIsNew(true);
          }}
          className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow"
        >
          <Plus className="size-4" /> New Package
        </Button>
      </div>

      {editing && (
        <div className="rounded-2xl border border-primary/30 bg-card/60 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-bold text-lg">{isNew ? "New Package" : "Edit Package"}</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setEditing(null);
                setIsNew(false);
              }}
            >
              <X className="size-4" />
            </Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <span className="text-xs text-muted-foreground mb-1 block">Package Name</span>
              <Input
                value={editing.name}
                onChange={(e) => setEditing((prev) => ({ ...prev!, name: e.target.value }))}
                placeholder="Value Pack"
              />
            </div>
            <div>
              <span className="text-xs text-muted-foreground mb-1 block">Badge (optional)</span>
              <Input
                value={editing.badge_text ?? ""}
                onChange={(e) =>
                  setEditing((prev) => ({ ...prev!, badge_text: e.target.value || null }))
                }
                placeholder="Best Value"
              />
            </div>
            <div>
              <span className="text-xs text-muted-foreground mb-1 block">Credits</span>
              <Input
                type="number"
                min={1}
                value={editing.credits}
                onChange={(e) =>
                  setEditing((prev) => ({ ...prev!, credits: Number(e.target.value) }))
                }
              />
            </div>
            <div>
              <span className="text-xs text-muted-foreground mb-1 block">Price (PKR)</span>
              <Input
                type="number"
                min={1}
                value={editing.price_pkr}
                onChange={(e) =>
                  setEditing((prev) => ({ ...prev!, price_pkr: Number(e.target.value) }))
                }
              />
            </div>
            <div>
              <span className="text-xs text-muted-foreground mb-1 block">Sort Order</span>
              <Input
                type="number"
                min={0}
                value={editing.sort_order}
                onChange={(e) =>
                  setEditing((prev) => ({ ...prev!, sort_order: Number(e.target.value) }))
                }
              />
            </div>
          </div>
          <div className="rounded-xl bg-muted/20 px-4 py-3 text-sm flex gap-6">
            <span>
              PKR/credit:{" "}
              <strong>{(editing.price_pkr / Math.max(1, editing.credits)).toFixed(2)}</strong>
            </span>
            <span>
              API cost: <strong>~{(editing.credits * 0.7).toFixed(0)} PKR</strong>
            </span>
            <span className={margin(editing) >= 100 ? "text-success" : "text-destructive"}>
              Margin: <strong>{margin(editing)}%</strong>
            </span>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              aria-label="Active (visible to users)"
              checked={editing.is_active}
              onChange={(e) => setEditing((prev) => ({ ...prev!, is_active: e.target.checked }))}
              className="size-4 accent-primary"
            />
            <span className="text-sm font-medium">Active (visible to users)</span>
          </label>
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button
              variant="ghost"
              onClick={() => {
                setEditing(null);
                setIsNew(false);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void save()}
              disabled={saving}
              className="bg-gradient-primary text-primary-foreground shadow-glow"
            >
              {saving ? "Saving…" : "Save Package"}
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 rounded-2xl bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className={`rounded-2xl border p-5 space-y-3 transition-all ${pkg.is_active ? "border-border bg-card/60 hover:shadow-glow" : "border-border/40 bg-card/20 opacity-50"}`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-bold text-sm">{pkg.name}</div>
                  {pkg.badge_text && (
                    <Badge className="bg-warning/15 text-warning border-0 text-[10px] mt-1">
                      {pkg.badge_text}
                    </Badge>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => {
                      setEditing(pkg);
                      setIsNew(false);
                    }}
                  >
                    <Edit2 className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-destructive/60 hover:text-destructive"
                    onClick={() => void del(pkg.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
              <div className="text-center">
                <div className="font-display text-2xl font-bold text-primary">
                  PKR {pkg.price_pkr}
                </div>
                <div className="text-xs text-warning font-semibold">{pkg.credits} credits</div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  {costPer(pkg)} PKR/credit · {margin(pkg)}% margin
                </div>
              </div>
              <div className="flex justify-center">
                <Badge
                  className={`text-[10px] border-0 ${pkg.is_active ? "bg-success/10 text-success" : "bg-muted/40 text-muted-foreground"}`}
                >
                  {pkg.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>
          ))}
          {packages.length === 0 && (
            <div className="sm:col-span-3 rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground text-sm">
              No packages yet. Click "New Package" to create one.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
