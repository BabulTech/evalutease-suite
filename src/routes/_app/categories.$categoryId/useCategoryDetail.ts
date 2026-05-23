import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { SubCategoryCard } from "@/components/categories/SubCategoryGrid";
import type { SubCategoryDraft } from "@/components/categories/SubCategoryDialog";
import type { User } from "@supabase/supabase-js";

type CategoryRow = { id: string; name: string; icon: string | null };

export type { CategoryRow };

export function useCategoryDetail(user: User | null, categoryId: string, active: boolean) {
  const [category, setCategory] = useState<CategoryRow | null>(null);
  const [cards, setCards] = useState<SubCategoryCard[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [cat, subs, qs] = await Promise.all([
      supabase
        .from("question_categories")
        .select("id, name, icon")
        .eq("id", categoryId)
        .eq("owner_id", user.id)
        .maybeSingle(),
      supabase
        .from("question_subcategories")
        .select("id, category_id, name, description")
        .eq("category_id", categoryId)
        .eq("owner_id", user.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("questions")
        .select("subcategory_id")
        .eq("owner_id", user.id)
        .eq("category_id", categoryId),
    ]);
    setLoading(false);
    if (cat.error) {
      toast.error(cat.error.message);
      return;
    }
    setCategory(cat.data ?? null);
    if (subs.error) {
      toast.error(subs.error.message);
      return;
    }
    const counts = new Map<string, number>();
    for (const q of qs.data ?? []) {
      if (q.subcategory_id) counts.set(q.subcategory_id, (counts.get(q.subcategory_id) ?? 0) + 1);
    }
    setCards(
      (subs.data ?? []).map((s) => ({
        id: s.id,
        category_id: s.category_id,
        name: s.name,
        description: s.description,
        questionCount: counts.get(s.id) ?? 0,
      })),
    );
  }, [user, categoryId]);

  useEffect(() => {
    // react-doctor-disable-next-line react-doctor/no-event-handler
    if (active) void load();
  }, [load, active]);

  const create = async (draft: SubCategoryDraft) => {
    if (!user) return;
    const { error } = await supabase.from("question_subcategories").insert({
      owner_id: user.id,
      category_id: categoryId,
      name: draft.name,
      description: draft.description || null,
    });
    if (error) {
      toast.error(error.message);
      throw error;
    }
    toast.success(`Created "${draft.name}"`);
    await load();
  };

  const update = async (id: string, draft: SubCategoryDraft) => {
    const { error } = await supabase
      .from("question_subcategories")
      .update({ name: draft.name, description: draft.description || null })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      throw error;
    }
    toast.success("Topic updated");
    await load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("question_subcategories").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setCards((prev) => prev.filter((c) => c.id !== id));
    toast.success("Topic deleted");
  };

  return { category, cards, loading, create, update, remove };
}
