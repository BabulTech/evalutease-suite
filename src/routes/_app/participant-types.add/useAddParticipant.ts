import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { draftToRow, type ParticipantDraft } from "@/components/participants/types";
import {
  defaultHostSettings,
  normalizeRegistrationFields,
  normalizeRegistrationFieldsByType,
  type HostSettings,
} from "@/components/settings/host-settings";
import type { TypeRow, SubRow, InviteRow } from "./types";

export function useAddParticipant(user: User | null) {
  const [types, setTypes] = useState<TypeRow[]>([]);
  const [subs, setSubs] = useState<SubRow[]>([]);
  const [typeId, setTypeId] = useState("");
  const [subId, setSubId] = useState("");
  const [hostSettings, setHostSettings] = useState<HostSettings>(() => defaultHostSettings());

  const loadGroups = useCallback(async () => {
    if (!user) return;
    const [tRes, sRes, hsRes] = await Promise.all([
      supabase
        .from("participant_types")
        .select("id, name")
        .eq("owner_id", user.id)
        .order("created_at"),
      supabase
        .from("participant_subtypes")
        .select("id, type_id, name")
        .eq("owner_id", user.id)
        .order("created_at"),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- host_settings table not yet in generated Supabase types
      (supabase as any)
        .from("host_settings")
        .select("registration_fields, registration_fields_by_type")
        .eq("owner_id", user.id)
        .maybeSingle(),
    ]);
    if (tRes.data) setTypes(tRes.data);
    if (sRes.data) setSubs(sRes.data);
    if (hsRes.data) {
      setHostSettings({
        ...defaultHostSettings(),
        registration_fields: normalizeRegistrationFields(hsRes.data.registration_fields),
        registration_fields_by_type: normalizeRegistrationFieldsByType(
          (hsRes.data as Record<string, unknown>).registration_fields_by_type,
        ),
      });
    }
  }, [user]);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  const createType = async (name: string) => {
    if (!user) return;
    const { data, error } = await supabase
      .from("participant_types")
      .insert({ owner_id: user.id, name })
      .select("id")
      .single();
    if (error) {
      toast.error(error.message);
      throw error;
    }
    toast.success(`Type "${name}" created`);
    await loadGroups();
    if (data) setTypeId(data.id);
  };

  const createSub = async (name: string, currentTypeId: string) => {
    if (!user || !currentTypeId) return;
    const { data, error } = await supabase
      .from("participant_subtypes")
      .insert({ owner_id: user.id, type_id: currentTypeId, name })
      .select("id")
      .single();
    if (error) {
      toast.error(error.message);
      throw error;
    }
    toast.success(`Group "${name}" created`);
    await loadGroups();
    if (data) setSubId(data.id);
  };

  const insertOne = async (draft: ParticipantDraft, currentSubId: string) => {
    if (!user) return;
    if (draft.email?.trim()) {
      const { data: existing } = await supabase
        .from("participants")
        .select("id, name")
        .eq("owner_id", user.id)
        .ilike("email", draft.email.trim())
        .maybeSingle();
      if (existing) {
        const err = new Error(`A participant with this email already exists: "${existing.name}"`);
        toast.error(err.message);
        throw err;
      }
    }
    const row = draftToRow(draft, user.id);
    const { error } = await supabase
      .from("participants")
      .insert({ ...row, subtype_id: currentSubId || null });
    if (error) {
      toast.error(error.message);
      throw error;
    }
  };

  const insertMany = async (drafts: ParticipantDraft[], currentSubId: string) => {
    if (!user || !drafts.length) return;
    const emails = drafts.flatMap((d) => {
      const e = d.email?.trim().toLowerCase();
      return e ? [e] : [];
    });
    if (emails.length > 0) {
      const { data: dupes } = await supabase
        .from("participants")
        .select("name, email")
        .eq("owner_id", user.id)
        .in("email", emails);
      if (dupes && dupes.length > 0) {
        const list = dupes
          .map((d: { name: string; email: string | null }) => d.email ?? "")
          .join(", ");
        toast.error(
          `${dupes.length} duplicate email(s) found: ${list}. Remove them and try again.`,
        );
        throw new Error("Duplicate emails");
      }
    }
    const rows = drafts.map((d) => ({
      ...draftToRow(d, user.id),
      subtype_id: currentSubId || null,
    }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.from("participants").insert(rows as any);
    if (error) {
      toast.error(error.message);
      throw error;
    }
    toast.success(`Added ${drafts.length} ${drafts.length === 1 ? "participant" : "participants"}`);
  };

  const generateInvite = async (
    currentSubId: string,
    participantType?: string,
  ): Promise<InviteRow | null> => {
    if (!user || !currentSubId) {
      toast.error("Select a group first");
      return null;
    }
    const { data, error } = await supabase
      .from("participant_invites")

      .insert([
        {
          owner_id: user.id,
          subtype_id: currentSubId,
          email: null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- participant_type column not yet in generated types
          ...({ participant_type: participantType || null } as any),
        },
      ])
      .select("id, email, token")
      .single();
    if (error) {
      toast.error(error.message);
      return null;
    }
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return {
      email: data.email,
      token: data.token,
      url: `${origin}/invite/${data.token}`,
      participant_type: participantType,
    };
  };

  return {
    types,
    subs,
    typeId,
    setTypeId,
    subId,
    setSubId,
    hostSettings,
    createType,
    createSub,
    insertOne,
    insertMany,
    generateInvite,
  };
}
