import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { useI18n } from "@/lib/i18n";
import {
  draftToRow,
  type Participant,
  type ParticipantDraft,
  type ParticipantMeta,
} from "@/components/participants/types";
import { logClientActivity } from "@/lib/audit";
import type { InviteRow } from "@/components/participants/InviteDialog";
import { type Step } from "@/components/ui/LoadingOverlay";
import type { TypeRow, SubRow, ParticipantRow } from "./types";
import { rowToParticipant, PARTICIPANT_PAGE_SIZE } from "./types";

export function useParticipantsIndex(user: User | null) {
  const { t } = useI18n();

  const [types, setTypes] = useState<TypeRow[]>([]);
  const [subs, setSubs] = useState<SubRow[]>([]);
  const participantsRef = useRef<Participant[]>([]);
  const [rawRows, setRawRows] = useState<(ParticipantRow & { meta: ParticipantMeta })[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState<string>("__all__");
  const [selectedSubId, setSelectedSubId] = useState<string>("__all__");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [participantTotal, setParticipantTotal] = useState(0);
  const [createTypeOpen, setCreateTypeOpen] = useState(false);
  const [createSubOpen, setCreateSubOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<1 | 2 | 3>(1);
  const [overlay, setOverlay] = useState<{
    visible: boolean;
    title: string;
    steps: Step[];
    step: number;
    hint?: string;
  }>({
    visible: false,
    title: "",
    steps: [],
    step: 0,
  });
  const [typeCounts, setTypeCounts] = useState<Map<string, number>>(new Map());
  const [subCounts, setSubCounts] = useState<Map<string, number>>(new Map());

  const showOverlay = (title: string, steps: Step[], hint?: string) =>
    setOverlay({ visible: true, title, steps, step: 0, hint });
  const advanceOverlay = (step: number) => setOverlay((prev) => ({ ...prev, step }));
  const finishOverlay = () => setOverlay((prev) => ({ ...prev, step: prev.steps.length }));
  const hideOverlay = () => setOverlay((prev) => ({ ...prev, visible: false }));

  const visibleSubs = useMemo(
    () => (selectedTypeId === "__all__" ? subs : subs.filter((s) => s.type_id === selectedTypeId)),
    [subs, selectedTypeId],
  );

  const loadWithRaw = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const from = page * PARTICIPANT_PAGE_SIZE;
    const to = from + PARTICIPANT_PAGE_SIZE - 1;
    const searchTerm = search.trim();

    const subtypeRes = await supabase
      .from("participant_subtypes")
      .select("id, type_id, name, description")
      .eq("owner_id", user.id)
      .order("created_at");
    const subRows = subtypeRes.data ?? [];

    let pQuery = supabase
      .from("participants")
      .select("id, name, email, mobile, metadata, subtype_id, created_at", { count: "exact" })
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (selectedSubId !== "__all__") {
      pQuery = pQuery.eq("subtype_id", selectedSubId);
    } else if (selectedTypeId !== "__all__") {
      const ids = subRows.flatMap((s) => (s.type_id === selectedTypeId ? [s.id] : []));
      if (ids.length === 0) {
        setTypes([]);
        setSubs(subRows);
        setRawRows([]);
        participantsRef.current = [];
        setParticipantTotal(0);
        setLoading(false);
        return;
      }
      pQuery = pQuery.in("subtype_id", ids);
    }
    if (searchTerm)
      pQuery = pQuery.or(
        `name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,mobile.ilike.%${searchTerm}%`,
      );

    const [tRes, pRes, allPartsRes] = await Promise.all([
      supabase
        .from("participant_types")
        .select("id, name, icon")
        .eq("owner_id", user.id)
        .order("created_at"),
      pQuery,
      supabase.from("participants").select("subtype_id").eq("owner_id", user.id),
    ]);

    setLoading(false);
    if (tRes.error) {
      toast.error(tRes.error.message);
      return;
    }
    if (pRes.error) {
      toast.error(pRes.error.message);
      return;
    }

    setTypes(tRes.data ?? []);
    setSubs(subRows);
    setParticipantTotal(pRes.count ?? 0);

    const sc = new Map<string, number>();
    for (const r of allPartsRes.data ?? []) {
      if (r.subtype_id) sc.set(r.subtype_id, (sc.get(r.subtype_id) ?? 0) + 1);
    }
    setSubCounts(sc);
    const tc = new Map<string, number>();
    for (const sub of subRows)
      tc.set(sub.type_id, (tc.get(sub.type_id) ?? 0) + (sc.get(sub.id) ?? 0));
    setTypeCounts(tc);

    const rows = (pRes.data ?? []) as ParticipantRow[];
    setRawRows(
      rows.map((r) => ({
        ...r,
        meta: (r.metadata && typeof r.metadata === "object" ? r.metadata : {}) as ParticipantMeta,
      })),
    );
    participantsRef.current = rows.map(rowToParticipant);
  }, [user, page, search, selectedTypeId, selectedSubId]);

  useEffect(() => {
    void loadWithRaw();
  }, [loadWithRaw]);
  // react-doctor-disable-next-line react-doctor/no-derived-state-effect
  // react-doctor-disable-next-line react-doctor/no-chain-state-updates
  useEffect(() => {
    setPage(0);
  }, [selectedTypeId, selectedSubId, search]);

  const filteredParticipants = useMemo(() => rawRows.map(rowToParticipant), [rawRows]);

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
    void logClientActivity({
      actionType: "created",
      module: "participants",
      entityType: "participant_type",
      entityId: data?.id ?? null,
      entityLabel: name,
      message: `Created participant type "${name}"`,
      details: { type_name: name },
    });
    toast.success(t("pt.typeCreated").replace("{name}", name));
    await loadWithRaw();
  };

  const createSub = async (name: string) => {
    if (!user || selectedTypeId === "__all__") return;
    const { data, error } = await supabase
      .from("participant_subtypes")
      .insert({ owner_id: user.id, type_id: selectedTypeId, name })
      .select("id")
      .single();
    if (error) {
      toast.error(error.message);
      throw error;
    }
    void logClientActivity({
      actionType: "created",
      module: "participants",
      entityType: "participant_group",
      entityId: data?.id ?? null,
      entityLabel: name,
      message: `Created participant group "${name}"`,
      details: { type_id: selectedTypeId, group_name: name },
    });
    toast.success(t("pt.groupCreated").replace("{name}", name));
    await loadWithRaw();
    if (data) setSelectedSubId(data.id);
  };

  const createParticipant = async (draft: ParticipantDraft) => {
    if (!user) return;
    const row = draftToRow(draft, user.id);
    const subtypeId = selectedSubId !== "__all__" ? selectedSubId : null;
    const { data, error } = await supabase
      .from("participants")
      .insert({ ...row, subtype_id: subtypeId })
      .select("id, name, email, mobile, metadata, subtype_id, created_at")
      .single();
    if (error) {
      toast.error(error.message);
      throw error;
    }
    if (data) {
      void logClientActivity({
        actionType: "created",
        module: "participants",
        entityType: "participant",
        entityId: data.id,
        entityLabel: data.name,
        message: `Added participant "${data.name}"`,
        details: { subtype_id: subtypeId, email: data.email, mobile: data.mobile },
        riskScore: 5,
      });
      toast.success(t("pt.participantAdded").replace("{name}", data.name));
      setPage(0);
      await loadWithRaw();
    }
  };

  const createMany = async (drafts: ParticipantDraft[]) => {
    if (!user || drafts.length === 0) return;
    const subtypeId = selectedSubId !== "__all__" ? selectedSubId : null;
    showOverlay(
      "Importing participants",
      [
        {
          label: "Preparing rows",
          detail: `Mapping ${drafts.length} record${drafts.length === 1 ? "" : "s"} to your database schema…`,
        },
        {
          label: "Saving to database",
          detail: "Inserting all participants in a single transaction…",
        },
        {
          label: "Refreshing your roster",
          detail: "Reloading the participant list so the new entries appear…",
        },
      ],
      `${drafts.length} participant${drafts.length === 1 ? "" : "s"} · usually 1–5 seconds`,
    );
    advanceOverlay(1);
    const rows = drafts.map((d) => ({ ...draftToRow(d, user.id), subtype_id: subtypeId }));
    const { data, error } = await supabase
      .from("participants")
      .insert(rows)
      .select("id, name, email, mobile, metadata, subtype_id, created_at");
    if (error) {
      hideOverlay();
      toast.error(error.message);
      throw error;
    }
    const inserted = (data ?? []) as ParticipantRow[];
    advanceOverlay(2);
    void logClientActivity({
      actionType: "created",
      module: "participants",
      entityType: "participant_batch",
      entityId: inserted[0]?.id ?? null,
      entityLabel: `${inserted.length} participants`,
      message: `Imported ${inserted.length} participant${inserted.length === 1 ? "" : "s"}`,
      details: {
        count: inserted.length,
        subtype_id: subtypeId,
        participant_ids: inserted.map((p) => p.id),
      },
      riskScore: inserted.length >= 500 ? 70 : inserted.length >= 100 ? 45 : 10,
    });
    toast.success(
      `${t("pt.added")} ${inserted.length} ${inserted.length === 1 ? t("pt.participant") : t("pt.participants")}`,
    );
    setPage(0);
    await loadWithRaw();
    finishOverlay();
    setTimeout(hideOverlay, 400);
  };

  const updateParticipant = async (id: string, draft: ParticipantDraft) => {
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
    setRawRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              name: row.name,
              email: row.email,
              mobile: row.mobile,
              metadata: row.metadata,
              meta: row.metadata as ParticipantMeta,
            }
          : r,
      ),
    );
    void logClientActivity({
      actionType: "updated",
      module: "participants",
      entityType: "participant",
      entityId: id,
      entityLabel: row.name,
      message: `Updated participant "${row.name}"`,
      details: { email: row.email, mobile: row.mobile },
      riskScore: 5,
    });
    toast.success(t("pt.participantUpdated"));
  };

  const removeParticipant = async (id: string) => {
    const target = filteredParticipants.find((p) => p.id === id);
    const { error } = await supabase.from("participants").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (selectedId === id) setSelectedId(null);
    void logClientActivity({
      actionType: "deleted",
      module: "participants",
      entityType: "participant",
      entityId: id,
      entityLabel: target?.name ?? "Participant",
      message: `Deleted participant "${target?.name ?? "Participant"}"`,
      details: { email: target?.email, mobile: target?.mobile },
      riskScore: 30,
    });
    toast.success(t("pt.participantRemoved"));
    await loadWithRaw();
  };

  const generateInvites = async (emails: string[]): Promise<InviteRow[]> => {
    if (!user) return [];
    const subtypeId = selectedSubId !== "__all__" ? selectedSubId : null;
    if (!subtypeId) {
      toast.error(t("pt.selectGroupFirst"));
      return [];
    }
    const inputs =
      emails.length > 0
        ? emails.map((e) => ({
            owner_id: user.id,
            subtype_id: subtypeId,
            email: e as string | null,
          }))
        : [{ owner_id: user.id, subtype_id: subtypeId, email: null as string | null }];

    const { data, error } = await supabase
      .from("participant_invites")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- participant_invites insert shape validated upstream
      .insert(inputs as any)
      .select("id, email, token");
    if (error) {
      toast.error(error.message);
      throw error;
    }
    void logClientActivity({
      actionType: "created",
      module: "participants",
      entityType: "participant_invite_batch",
      entityId: data?.[0]?.id ?? null,
      entityLabel: `${data?.length ?? 0} invite${(data?.length ?? 0) === 1 ? "" : "s"}`,
      message: `Generated ${data?.length ?? 0} participant invite${(data?.length ?? 0) === 1 ? "" : "s"}`,
      details: { subtype_id: subtypeId, count: data?.length ?? 0, emails },
      riskScore: (data?.length ?? 0) >= 100 ? 45 : 10,
    });
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return (data ?? []).map((r) => ({
      email: r.email,
      token: r.token,
      url: `${origin}/invite/${r.token}`,
    }));
  };

  const handlePickType = (id: string) => {
    setSelectedTypeId(id);
    setSelectedSubId("__all__");
    setSelectedId(null);
    setActiveTab(id === "__all__" ? 3 : 2);
  };
  const handlePickSub = (id: string) => {
    setSelectedSubId(id);
    setSelectedId(null);
    setActiveTab(3);
  };

  const canAddSub = selectedTypeId !== "__all__";
  const totalAll = Array.from(typeCounts.values()).reduce((a, b) => a + b, 0);
  const selectedTypeName = types.find((ty) => ty.id === selectedTypeId)?.name ?? "";
  const selectedGroupName = subs.find((s) => s.id === selectedSubId)?.name ?? "";
  const canAddToGroup = selectedTypeId !== "__all__" && selectedSubId !== "__all__";
  const selectedParticipant = selectedId
    ? (filteredParticipants.find((p) => p.id === selectedId) ?? null)
    : null;

  return {
    types,
    subs,
    visibleSubs,
    filteredParticipants,
    selectedParticipant,
    loading,
    selectedTypeId,
    selectedSubId,
    search,
    setSearch,
    selectedId,
    setSelectedId,
    page,
    setPage,
    participantTotal,
    typeCounts,
    subCounts,
    createTypeOpen,
    setCreateTypeOpen,
    createSubOpen,
    setCreateSubOpen,
    activeTab,
    setActiveTab,
    overlay,
    canAddSub,
    canAddToGroup,
    totalAll,
    selectedTypeName,
    selectedGroupName,
    handlePickType,
    handlePickSub,
    createType,
    createSub,
    createParticipant,
    createMany,
    updateParticipant,
    removeParticipant,
    generateInvites,
  };
}
