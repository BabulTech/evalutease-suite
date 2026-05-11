import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type PaginationControlsProps = {
  page: number;
  pageSize: number;
  total: number;
  label: string;
  onPageChange: (page: number) => void;
  pageSizeOptions?: number[];
  onPageSizeChange?: (pageSize: number) => void;
  maxPageButtons?: number;
};

export function PaginationControls({
  page,
  pageSize,
  total,
  label,
  onPageChange,
  pageSizeOptions,
  onPageSizeChange,
  maxPageButtons = 5,
}: PaginationControlsProps) {
  if (total <= pageSize) return null;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const start = safePage * pageSize + 1;
  const end = Math.min(total, start + pageSize - 1);

  const pageWindow = Math.max(3, maxPageButtons);
  const half = Math.floor(pageWindow / 2);
  const startPage = Math.max(0, Math.min(safePage - half, totalPages - pageWindow));
  const endPage = Math.min(totalPages - 1, startPage + pageWindow - 1);
  const pageButtons = [] as number[];
  for (let p = startPage; p <= endPage; p += 1) pageButtons.push(p);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 px-4 py-3 text-xs text-muted-foreground">
      <div className="flex flex-wrap items-center gap-2">
        <span>
          Showing {start}-{end} of {total} {label}
        </span>
        {pageSizeOptions && onPageSizeChange && (
          <Select
            value={String(pageSize)}
            onValueChange={(value) => onPageSizeChange(Number(value))}
          >
            <SelectTrigger className="h-7 w-[90px] text-xs">
              <SelectValue placeholder="Page size" />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size} / page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={safePage === 0}
          onClick={() => onPageChange(Math.max(0, safePage - 1))}
          className="h-8 gap-1"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Prev
        </Button>
        {pageButtons.map((p) => (
          <Button
            key={p}
            type="button"
            variant={p === safePage ? "default" : "outline"}
            size="sm"
            onClick={() => onPageChange(p)}
            className="h-8 min-w-8 px-2"
          >
            {p + 1}
          </Button>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={safePage >= totalPages - 1}
          onClick={() => onPageChange(Math.min(totalPages - 1, safePage + 1))}
          className="h-8 gap-1"
        >
          Next <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
