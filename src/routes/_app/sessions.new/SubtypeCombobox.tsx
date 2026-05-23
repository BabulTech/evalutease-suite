import { useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { TypeRow, SubtypeRow } from "./types";

export function SubtypeCombobox({
  types,
  subtypes,
  selectedIds,
  onToggle,
  typeNameById,
  hasError,
}: {
  types: TypeRow[];
  subtypes: SubtypeRow[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  typeNameById: Map<string, string>;
  hasError?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const placeholder =
    selectedIds.size === 0
      ? "Search sub-types…"
      : `${selectedIds.size} sub-type${selectedIds.size === 1 ? "" : "s"} selected`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={`w-full justify-between font-normal ${hasError ? "border-destructive" : ""}`}
        >
          <span className="flex items-center gap-2">
            <Search className="size-3.5 text-muted-foreground" />
            <span className={selectedIds.size === 0 ? "text-muted-foreground" : ""}>
              {placeholder}
            </span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
        <Command>
          <CommandInput placeholder="Type to search e.g. Class 9, Engineering…" />
          <CommandList>
            <CommandEmpty>No matches.</CommandEmpty>
            {types.map((t) => {
              const subs = subtypes.filter((s) => s.type_id === t.id);
              if (subs.length === 0) return null;
              return (
                <CommandGroup key={t.id} heading={t.name}>
                  {subs.map((s) => (
                    <CommandItem
                      key={s.id}
                      value={`${typeNameById.get(s.type_id) ?? ""} ${s.name}`}
                      onSelect={() => onToggle(s.id)}
                    >
                      <Check
                        className={`mr-2 h-4 w-4 ${selectedIds.has(s.id) ? "opacity-100" : "opacity-0"}`}
                      />
                      {s.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
