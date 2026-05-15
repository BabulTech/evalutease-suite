import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { BookOpen, ChevronLeft, FolderOpen, HelpCircle, Plus } from "lucide-react";
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

  const totalQuestions = cards.reduce((s, c) => s + c.questionCount, 0);

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link to="/categories" className="hover:text-foreground transition-colors flex items-center gap-1">
          <BookOpen size={12} /> All categories
        </Link>
        <ChevronLeft className="h-3 w-3 rotate-180 shrink-0" />
        <span className="text-foreground font-medium">{category?.name ?? "Category"}</span>
      </nav>

      {/* Hero header */}
      <div className="rounded-2xl border border-border bg-card/60 p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-12 w-12 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center text-primary shadow-glow shrink-0">
            <Icon className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight truncate">
              {category?.name ?? "Category"}
            </h1>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <FolderOpen size={11} /> {cards.length} {cards.length === 1 ? "topic" : "topics"}
              </span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <HelpCircle size={11} /> {totalQuestions} {totalQuestions === 1 ? "question" : "questions"}
              </span>
            </div>
          </div>
        </div>
        <SubCategoryDialog
          title="Add topic"
          submitLabel="Create"
          onSubmit={create}
          trigger={
            <Button className="h-10 gap-2 bg-gradient-primary text-primary-foreground shadow-glow">
              <Plus className="h-4 w-4" /> Add Topic
            </Button>
          }
        />
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border bg-card/40 p-6 text-sm text-muted-foreground animate-pulse">
          Loading topics…
        </div>
      ) : (
        <SubCategoryGrid
          subcategories={cards}
          onEdit={update}
          onDelete={remove}
          emptyState={
            <div className="rounded-2xl border border-dashed border-border bg-card/30 p-12 text-center space-y-3">
              <FolderOpen className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <div>
                <p className="text-sm font-semibold">No topics yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Add a topic to organise questions — e.g. <span className="text-foreground">World War II</span>, <span className="text-foreground">Class 9</span>, or <span className="text-foreground">Lecture 1</span>.
                </p>
              </div>
              <SubCategoryDialog
                title="Add topic"
                submitLabel="Create"
                onSubmit={create}
                trigger={
                  <Button size="sm" className="gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow">
                    <Plus size={14} /> Add first topic
                  </Button>
                }
              />
            </div>
          }
        />
      )}
    </div>
  );
}
