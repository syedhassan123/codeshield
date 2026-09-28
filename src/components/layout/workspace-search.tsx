"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { searchWorkspaceAction } from "@/lib/actions/search";
import type { SearchHit } from "@/lib/search/queries";
import { cn } from "@/lib/utils";

const DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;

const PLACEHOLDERS: Record<string, string> = {
  admin: "Search assessments, students, questions…",
  student: "Search assessments, results, certificates…",
  interviewer: "Search interviews, candidates…",
};

export function WorkspaceSearch({
  role,
}: {
  role: "admin" | "student" | "interviewer";
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchHit[]>([]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setLoading(false);
      setOpen(trimmed.length > 0);
      return;
    }

    setLoading(true);
    setOpen(true);
    timerRef.current = setTimeout(() => {
      void (async () => {
        const response = await searchWorkspaceAction(trimmed);
        if ("results" in response) {
          setResults(response.results);
        } else {
          setResults([]);
        }
        setLoading(false);
      })();
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  const groups = results.reduce<Record<string, SearchHit[]>>((acc, hit) => {
    acc[hit.group] = acc[hit.group] ?? [];
    acc[hit.group].push(hit);
    return acc;
  }, {});

  const trimmed = query.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < MIN_QUERY_LENGTH;

  return (
    <div className="relative flex-1 max-w-full lg:max-w-md" ref={rootRef}>
      <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 h-10">
        <Search className="w-4 h-4 text-muted-foreground shrink-0" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => {
            if (trimmed.length > 0) setOpen(true);
          }}
          placeholder={PLACEHOLDERS[role] ?? "Search..."}
          aria-label="Search workspace"
          aria-expanded={open}
          className="bg-transparent outline-none text-sm flex-1 min-w-0 placeholder:text-muted-foreground focus-visible:ring-0"
        />
      </div>

      {open && (
        <div className="absolute left-0 right-0 mt-2 max-h-[420px] overflow-y-auto rounded-xl border border-border bg-card shadow-elevated z-40">
          {tooShort ? (
            <div className="px-4 py-6 text-sm text-muted-foreground text-center">
              Type at least 2 characters.
            </div>
          ) : loading ? (
            <div className="px-4 py-6 text-sm text-muted-foreground text-center">
              Searching…
            </div>
          ) : results.length ? (
            Object.entries(groups).map(([group, hits]) => (
              <div key={group}>
                <div className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group}
                </div>
                {hits.map((hit) => (
                  <Link
                    key={hit.id}
                    href={hit.href}
                    onClick={() => {
                      setOpen(false);
                      setQuery("");
                    }}
                    className={cn(
                      "block w-full text-left px-4 py-2.5 hover:bg-muted/50 transition-colors",
                    )}
                  >
                    <div className="text-sm font-semibold truncate">
                      {hit.title}
                    </div>
                    {hit.subtitle ? (
                      <div className="text-xs text-muted-foreground truncate">
                        {hit.subtitle}
                      </div>
                    ) : null}
                  </Link>
                ))}
              </div>
            ))
          ) : (
            <div className="px-4 py-6 text-sm text-muted-foreground text-center">
              No matches.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
