import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Search, Plus, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { validationError } from "@/components/ui/validation-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SectionHead } from "./-shared";
import { fmtDateShort } from "./helpers";

// react-doctor-disable-next-line react-doctor/prefer-useReducer
export function BlockedDomainsSection() {
  type DomainRow = {
    id: string;
    domain: string;
    reason: string | null;
    is_active: boolean;
    created_at: string;
  };
  const [domains, setDomains] = useState<DomainRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newDomain, setNewDomain] = useState("");
  const [newReason, setNewReason] = useState("");
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("blocked_email_domains").select("*").order("domain");
    setDomains((data ?? []) as DomainRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async () => {
    const d = newDomain.trim().toLowerCase().replace(/^@/, "");
    if (!d) {
      validationError("Enter a domain");
      return;
    }
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)) {
      validationError("Invalid domain format (e.g. gmail.com)");
      return;
    }
    setAdding(true);
    const { error } = await supabase
      .from("blocked_email_domains")
      .insert({ domain: d, reason: newReason.trim() || "Public email provider" });
    setAdding(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setNewDomain("");
    setNewReason("");
    toast.success(`${d} blocked`);
    void load();
  };

  const toggle = async (row: DomainRow) => {
    await supabase
      .from("blocked_email_domains")
      .update({ is_active: !row.is_active })
      .eq("id", row.id);
    void load();
  };

  const del = async (id: string) => {
    await supabase.from("blocked_email_domains").delete().eq("id", id);
    void load();
  };

  const filtered = domains.filter((d) => d.domain.includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <SectionHead
        title="Blocked Email Domains"
        sub="Domains blocked from Enterprise plan registration. Users must use a company email."
      />

      <div className="rounded-2xl border border-border bg-card/60 p-4 space-y-3">
        <div className="text-sm font-semibold">Block New Domain</div>
        <div className="flex gap-2 flex-wrap">
          <Input
            className="flex-1 min-w-[160px]"
            placeholder="gmail.com"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void add()}
          />
          <Input
            className="flex-1 min-w-[160px]"
            placeholder="Reason (optional)"
            value={newReason}
            onChange={(e) => setNewReason(e.target.value)}
          />
          <Button
            onClick={() => void add()}
            disabled={adding}
            className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow"
          >
            <Plus className="size-4" /> {adding ? "Adding…" : "Block Domain"}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Enter domain only, no @ sign needed. Example:{" "}
          <code className="bg-muted px-1 rounded">gmail.com</code>
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search domains…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="flex gap-4 text-sm">
        <span className="text-muted-foreground">
          Total: <strong>{domains.length}</strong>
        </span>
        <span className="text-success">
          Active: <strong>{domains.filter((d) => d.is_active).length}</strong>
        </span>
        <span className="text-muted-foreground">
          Inactive: <strong>{domains.filter((d) => !d.is_active).length}</strong>
        </span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 rounded-xl bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr>
                {["Domain", "Reason", "Status", "Added", ""].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((row) => (
                <tr key={row.id} className="hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-3 font-mono text-sm font-semibold">{row.domain}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{row.reason ?? "-"}</td>
                  <td className="px-4 py-3">
                    <Badge
                      className={`text-[10px] border-0 ${row.is_active ? "bg-destructive/10 text-destructive" : "bg-muted/40 text-muted-foreground"}`}
                    >
                      {row.is_active ? "Blocked" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {fmtDateShort(row.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => void toggle(row)}
                      >
                        {row.is_active ? (
                          <ToggleRight className="size-3.5 text-success" />
                        ) : (
                          <ToggleLeft className="size-3.5 text-muted-foreground" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-destructive/60 hover:text-destructive"
                        onClick={() => void del(row.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">
                    No domains found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
