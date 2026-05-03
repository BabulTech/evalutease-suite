import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, UsersRound } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { TypeDialog, type TypeDraft } from "@/components/participants/TypeDialog";
import { TypeGrid, type TypeCard } from "@/components/participants/TypeGrid";
import type { IconKey } from "@/components/categories/icons";

export const Route = createFileRoute("/_app/participant-types")({ component: TypesPage });

function TypesPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [cards, setCards] = useState<TypeCard[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [types, subs, parts] = await Promise.all([
      supabase
        .from("participant_types")
        .select("id, name, icon, created_at")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("participant_subtypes")
        .select("id, type_id")
        .eq("owner_id", user.id),
      supabase.from("participants").select("subtype_id").eq("owner_id", user.id),
    ]);
    setLoading(false);
    if (types.error) {
      toast.error(types.error.message);
      return;
    }
    const subToType = new Map<string, string>();
    const subCounts = new Map<string, number>();
    for (const s of subs.data ?? []) {
      subToType.set(s.id, s.type_id);
      subCounts.set(s.type_id, (subCounts.get(s.type_id) ?? 0) + 1);
    }
    const partCounts = new Map<string, number>();
    for (const p of parts.data ?? []) {
      const t = p.subtype_id ? subToType.get(p.subtype_id) : null;
      if (t) partCounts.set(t, (partCounts.get(t) ?? 0) + 1);
    }
    setCards(
      (types.data ?? []).map((t) => ({
        id: t.id,
        name: t.name,
        icon: (t.icon ?? null) as IconKey | null,
        subtypeCount: subCounts.get(t.id) ?? 0,
        participantCount: partCounts.get(t.id) ?? 0,
      })),
    );
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async (draft: TypeDraft) => {
    if (!user) return;
    const { error } = await supabase
      .from("participant_types")
      .insert({ owner_id: user.id, name: draft.name, icon: draft.icon });
    if (error) {
      toast.error(error.message);
      throw error;
    }
    toast.success(`Created "${draft.name}"`);
    await load();
  };

  const update = async (id: string, draft: TypeDraft) => {
    const { error } = await supabase
      .from("participant_types")
      .update({ name: draft.name, icon: draft.icon })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      throw error;
    }
    toast.success("Type updated");
    await load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("participant_types").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setCards((prev) => prev.filter((c) => c.id !== id));
    toast.success("Type deleted");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            {t("nav.manageParticipants") ?? "Manage Participants"}
          </h1>
          <p className="text-muted-foreground mt-1">
            Group your roster by type — students, teachers, partners, friends, etc. Click a type to
            manage sub-types and participants.
          </p>
        </div>
        <TypeDialog
          title="Add type"
          submitLabel="Create"
          onSubmit={create}
          trigger={
            <Button className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow">
              <Plus className="h-4 w-4" /> Add type
            </Button>
          }
        />
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border bg-card/40 p-6 text-sm text-muted-foreground">
          Loading types…
        </div>
      ) : (
        <TypeGrid
          types={cards}
          onEdit={update}
          onDelete={remove}
          emptyState={
            <div className="rounded-2xl border border-dashed border-border bg-card/30 p-10 text-center">
              <UsersRound className="mx-auto h-10 w-10 text-muted-foreground/60" />
              <p className="mt-3 text-sm font-medium">No participant types yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Create your first type — e.g. <span className="text-foreground">Student</span>,{" "}
                <span className="text-foreground">Teacher</span>,{" "}
                <span className="text-foreground">Partner</span>.
              </p>
            </div>
          }
        />
      )}
    </div>
  );
}
