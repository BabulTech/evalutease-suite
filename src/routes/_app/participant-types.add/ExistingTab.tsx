import { useRef, useState } from "react";
import { Check, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ExistingParticipant = {
  id: string;
  name: string;
  email: string | null;
  mobile: string | null;
  participant_type: string | null;
  metadata: Record<string, unknown>;
};

export function ExistingTab({ ownerId, subId }: { ownerId: string; subId: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ExistingParticipant[]>([]);
  const [adding, setAdding] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = (q: string) => {
    setQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim()) {
      setResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      const { data } = await supabase
        .from("participants")
        .select("id, name, email, mobile, metadata")
        .eq("owner_id", ownerId)
        .or(`name.ilike.%${q.trim()}%,email.ilike.%${q.trim()}%`)
        .order("name")
        .limit(20);
      setResults(
        (data ?? []).map((r) => ({ ...r, participant_type: null })) as ExistingParticipant[],
      );
    }, 400);
  };

  const addToGroup = async (p: ExistingParticipant) => {
    if (!subId) {
      toast.error("Please select a group first.");
      return;
    }
    setAdding(p.id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: exists } = await (supabase.rpc as any)("check_participant_email_in_subtype", {
      p_subtype_id: subId,
      p_email: p.email ?? "",
    });
    if (exists && p.email) {
      toast.error("This participant's email is already in the target group.");
      setAdding(null);
      return;
    }
    const { error } = await supabase.from("participants").insert({
      owner_id: ownerId,
      subtype_id: subId,
      name: p.name,
      email: p.email,
      mobile: p.mobile,
      metadata: p.metadata ?? {},
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    if (error) {
      toast.error(error.message);
    } else {
      setAdded((prev) => new Set(prev).add(p.id));
      toast.success(`${p.name} added to group.`);
    }
    setAdding(null);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Search participants you've already added elsewhere and add them to this group in one click.
      </p>
      <Input
        value={query}
        onChange={(e) => search(e.target.value)}
        placeholder="Search by name or email…"
      />
      {results.length === 0 && query.trim() && (
        <p className="text-center text-sm text-muted-foreground py-6">
          No participants found for "{query}"
        </p>
      )}
      {results.length > 0 && (
        <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
          {results.map((p) => {
            const isAdded = added.has(p.id);
            const isBusy = adding === p.id;
            return (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 px-4 py-3 bg-card/50"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  {p.email && <p className="text-xs text-muted-foreground truncate">{p.email}</p>}
                </div>
                <Button
                  size="sm"
                  variant={isAdded ? "ghost" : "default"}
                  disabled={isBusy || isAdded || !subId}
                  onClick={() => addToGroup(p)}
                  className={`shrink-0 gap-1.5 ${isAdded ? "text-success" : "bg-gradient-primary text-primary-foreground shadow-glow"}`}
                >
                  {isBusy ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : isAdded ? (
                    <Check size={14} />
                  ) : (
                    <Plus size={14} />
                  )}
                  {isBusy ? "Adding…" : isAdded ? "Added" : "Add"}
                </Button>
              </div>
            );
          })}
        </div>
      )}
      {!subId && query.trim() && (
        <p className="text-xs text-amber-400 text-center">
          Select a group above before adding participants.
        </p>
      )}
    </div>
  );
}
