import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { logClientActivity } from "@/lib/audit";
import { type DraftQuestion, type QuestionSource } from "@/components/questions/types";
import { draftToRow } from "@/components/questions/persistence";
import type { User } from "@supabase/supabase-js";

type Cat = { id: string; name: string; icon: string | null };
type Sub = { id: string; category_id: string; name: string };

export type { Cat, Sub };

export function useAddQuestion(user: User | null, initialCategoryId: string, initialSubId: string) {
  const { t } = useI18n();
  const appliedInitialSelection = useRef(false);

  const [cats, setCats] = useState<Cat[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [selectedCat, setSelectedCat] = useState("");
  const [selectedSub, setSelectedSub] = useState("");
  const [saving, setSaving] = useState(false);

  const loadMeta = useCallback(async () => {
    if (!user) return;
    const [cRes, sRes] = await Promise.all([
      supabase
        .from("question_categories")
        .select("id,name,icon")
        .eq("owner_id", user.id)
        .order("created_at"),
      supabase
        .from("question_subcategories")
        .select("id,category_id,name")
        .eq("owner_id", user.id)
        .order("created_at"),
    ]);
    if (cRes.data) setCats(cRes.data);
    if (sRes.data) setSubs(sRes.data);
  }, [user]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    if (appliedInitialSelection.current || cats.length === 0 || !initialCategoryId) return;
    if (!cats.some((c) => c.id === initialCategoryId)) return;
    // react-doctor-disable-next-line react-doctor/no-chain-state-updates
    setSelectedCat(initialCategoryId);
    // react-doctor-disable-next-line react-doctor/no-event-handler
    if (
      initialSubId &&
      subs.some((s) => s.id === initialSubId && s.category_id === initialCategoryId)
    ) {
      // react-doctor-disable-next-line react-doctor/no-chain-state-updates
      setSelectedSub(initialSubId);
    }
    appliedInitialSelection.current = true;
  }, [cats, subs, initialCategoryId, initialSubId]);

  const filteredSubs = useMemo(
    () => subs.filter((s) => s.category_id === selectedCat),
    [subs, selectedCat],
  );

  const createCat = async (name: string) => {
    if (!user) return;
    const { data, error } = await supabase
      .from("question_categories")
      .insert({ owner_id: user.id, name })
      .select("id")
      .single();
    if (error) {
      toast.error(error.message);
      throw error;
    }
    void logClientActivity({
      actionType: "created",
      module: "questions",
      entityType: "question_category",
      entityId: data.id,
      entityLabel: name,
      message: `Created question category "${name}"`,
      details: { category_name: name },
    });
    toast.success(t("cat.categoryCreated").replace("{name}", name));
    setCats((prev) => [...prev, { id: data.id, name, icon: null }]);
    setSelectedCat(data.id);
    setSelectedSub("");
  };

  const createSub = async (name: string) => {
    if (!user || !selectedCat) return;
    const { data, error } = await supabase
      .from("question_subcategories")
      .insert({ owner_id: user.id, category_id: selectedCat, name })
      .select("id")
      .single();
    if (error) {
      toast.error(error.message);
      throw error;
    }
    void logClientActivity({
      actionType: "created",
      module: "questions",
      entityType: "question_topic",
      entityId: data.id,
      entityLabel: name,
      message: `Created question topic "${name}"`,
      details: { category_id: selectedCat, topic_name: name },
    });
    toast.success(t("cat.topicCreated").replace("{name}", name));
    setSubs((prev) => [...prev, { id: data.id, category_id: selectedCat, name }]);
    setSelectedSub(data.id);
  };

  const saveDrafts = async (drafts: DraftQuestion[], source: QuestionSource) => {
    if (!user || !selectedCat || !selectedSub) {
      toast.error(t("add.selectCatTopicFirst"));
      return;
    }
    setSaving(true);
    await supabase.auth.getSession();
    const rows = drafts.map((d) =>
      draftToRow(d, {
        ownerId: user.id,
        categoryId: selectedCat,
        subcategoryId: selectedSub,
        source,
      }),
    );
    const { data: inserted, error } = await supabase
      .from("questions")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- questions insert shape validated upstream; cast needed due to Supabase strict RejectExcessProperties
      .insert(rows as any)
      .select("id,text,source");
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const methodLabel =
      source === "manual"
        ? "manually"
        : source === "ai"
          ? "with AI"
          : source === "ocr"
            ? "from scan"
            : "from upload";
    void logClientActivity({
      actionType: "created",
      module: "questions",
      entityType: rows.length === 1 ? "question" : "question_batch",
      entityId: inserted?.[0]?.id ?? null,
      entityLabel: rows.length === 1 ? rows[0]?.text?.slice(0, 120) : `${rows.length} questions`,
      message: `Created ${rows.length} question${rows.length === 1 ? "" : "s"} ${methodLabel}`,
      details: {
        source,
        count: rows.length,
        category_id: selectedCat,
        topic_id: selectedSub,
        question_ids: (inserted ?? []).map((q) => q.id),
      },
      riskScore: rows.length >= 50 ? 45 : rows.length >= 20 ? 25 : 5,
    });
    toast.success(
      `${rows.length} ${rows.length === 1 ? t("q.count") : t("q.counts")} ${t("q.saved")}`,
    );
  };

  const selectCat = (id: string) => {
    setSelectedCat(id);
    setSelectedSub("");
  };

  return {
    cats,
    filteredSubs,
    selectedCat,
    selectedSub,
    saving,
    selectCat,
    setSelectedSub,
    createCat,
    createSub,
    saveDrafts,
  };
}
