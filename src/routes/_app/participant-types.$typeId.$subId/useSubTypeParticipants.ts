import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { Participant, ParticipantDraft } from "@/components/participants/types";
import { draftToRow } from "@/components/participants/types";
import type { SubRow, TypeRow, ParticipantRow } from "./types";
import { rowToParticipant, PARTICIPANT_PAGE_SIZE } from "./types";

export function useSubTypeParticipants(
  user: User | null,
  typeId: string,
  subId: string,
  page: number,
  search: string,
) {
  const [type, setType] = useState<TypeRow | null>(null);
  const [sub, setSub] = useState<SubRow | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalParticipants, setTotalParticipants] = useState(0);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const from = page * PARTICIPANT_PAGE_SIZE;
    const to = from + PARTICIPANT_PAGE_SIZE - 1;
    const searchTerm = search.trim();
    let participantQuery = supabase
      .from("participants")
      .select("id, name, email, mobile, metadata, subtype_id, created_at", { count: "exact" })
      .eq("owner_id", user.id)
      .eq("subtype_id", subId)
      .order("created_at", { ascending: false })
      .range(from, to);
    if (searchTerm) {
      participantQuery = participantQuery.or(
        `name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,mobile.ilike.%${searchTerm}%`,
      );
    }
    const [t, s, p] = await Promise.all([
      supabase
        .from("participant_types")
        .select("id, name")
        .eq("id", typeId)
        .eq("owner_id", user.id)
        .maybeSingle(),
      supabase
        .from("participant_subtypes")
        .select("id, type_id, name")
        .eq("id", subId)
        .eq("owner_id", user.id)
        .maybeSingle(),
      participantQuery,
    ]);
    setLoading(false);
    if (t.error) toast.error(t.error.message);
    if (s.error) toast.error(s.error.message);
    if (p.error) toast.error(p.error.message);
    setType(t.data ?? null);
    setSub(s.data ?? null);
    setTotalParticipants(p.count ?? 0);
    setParticipants(((p.data ?? []) as ParticipantRow[]).map(rowToParticipant));
  }, [user, typeId, subId, page, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async (draft: ParticipantDraft) => {
    if (!user) return;
    const row = draftToRow(draft, user.id);
    const { data, error } = await supabase
      .from("participants")
      .insert({ ...row, subtype_id: subId })
      .select("id, name, email, mobile, metadata, subtype_id, created_at")
      .single();
    if (error) {
      toast.error(error.message);
      throw error;
    }
    if (data) {
      setParticipants((prev) => [rowToParticipant(data as ParticipantRow), ...prev]);
      toast.success(`Added ${data.name}`);
    }
  };

  const createMany = async (drafts: ParticipantDraft[]) => {
    if (!user || drafts.length === 0) return;
    const rows = drafts.map((d) => ({ ...draftToRow(d, user.id), subtype_id: subId }));
    const { data, error } = await supabase
      .from("participants")
      .insert(rows)
      .select("id, name, email, mobile, metadata, subtype_id, created_at");
    if (error) {
      toast.error(error.message);
      throw error;
    }
    const inserted = ((data ?? []) as ParticipantRow[]).map(rowToParticipant);
    setParticipants((prev) => [...inserted, ...prev]);
    toast.success(`Added ${inserted.length} participant${inserted.length === 1 ? "" : "s"}`);
  };

  const update = async (id: string, draft: ParticipantDraft) => {
    if (!user) return;
    const row = draftToRow(draft, user.id);
    const { error } = await supabase
      .from("participants")
      .update({ name: row.name, email: row.email, mobile: row.mobile, metadata: row.metadata })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      throw error;
    }
    setParticipants((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, name: row.name, email: row.email, mobile: row.mobile, metadata: row.metadata }
          : p,
      ),
    );
    toast.success("Participant updated");
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("participants").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setParticipants((prev) => prev.filter((p) => p.id !== id));
    toast.success("Participant removed");
  };

  const generateInvites = async (
    emails: string[],
  ): Promise<{ email: string | null; token: string; url: string }[]> => {
    if (!user) return [];
    const inputs: Array<{ owner_id: string; subtype_id: string; email: string | null }> =
      emails.length > 0
        ? emails.map((e) => ({ owner_id: user.id, subtype_id: subId, email: e }))
        : [{ owner_id: user.id, subtype_id: subId, email: null }];
    const { data, error } = await supabase
      .from("participant_invites")
      .insert(inputs)
      .select("id, email, token");
    if (error) {
      toast.error(error.message);
      throw error;
    }
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return (data ?? []).map((r) => ({
      email: r.email,
      token: r.token,
      url: `${origin}/invite/${r.token}`,
    }));
  };

  return {
    type,
    sub,
    participants,
    loading,
    totalParticipants,
    create,
    createMany,
    update,
    remove,
    generateInvites,
  };
}
