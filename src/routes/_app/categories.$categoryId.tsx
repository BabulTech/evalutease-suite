import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, FolderOpen, Plus } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  SubCategoryDialog,
  type SubCategoryDraft,
} from "@/components/categories/SubCategoryDialog";
import { SubCategoryGrid, type SubCategoryCard } from "@/components/categories/SubCategoryGrid";
import { iconFor, type IconKey } from "@/components/categories/icons";

export const Route = createFileRoute("/_app/categories/$categoryId")({
  component: CategoryDetailPage,
});

type CategoryRow = { id: string; name: string; icon: string | null };

function CategoryDetailPage() {
  const { categoryId } = Route.useParams();
  const { user } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const expected = `/categories/${categoryId}`;
  const onIndex = pathname === expected || pathname === expected + "/";
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
    if (onIndex) void load();
  }, [load, onIndex]);

  if (!onIndex) return <Outlet />;

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

  const Icon = iconFor((category?.icon ?? null) as IconKey | null);

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/categories"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> All categories
        </Link>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center text-primary shadow-glow">
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">
              {category?.name ?? "Category"}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Topics let you organise questions further - pick one to add or edit
              questions.
            </p>
          </div>
        </div>
        <SubCategoryDialog
          title="Add topic"
          submitLabel="Create"
          onSubmit={create}
          trigger={
            <Button className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow">
              <Plus className="h-4 w-4" /> Add topic
            </Button>
          }
        />
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border bg-card/40 p-6 text-sm text-muted-foreground">
          Loading topics…
        </div>
      ) : (
        <SubCategoryGrid
          subcategories={cards}
          onEdit={update}
          onDelete={remove}
          emptyState={
            <div className="rounded-2xl border border-dashed border-border bg-card/30 p-10 text-center">
              <FolderOpen className="mx-auto h-10 w-10 text-muted-foreground/60" />
              <p className="mt-3 text-sm font-medium">No topics yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Create one - e.g. <span className="text-foreground">World War II</span>,{" "}
                <span className="text-foreground">Class 9</span>, or{" "}
                <span className="text-foreground">ICS Lecture 1</span>.
              </p>
            </div>
          }
        />
      )}
    </div>
  );
}
