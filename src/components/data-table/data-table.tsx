"use client";

/**
 * Reusable data table (TanStack Table v8):
 * global search, select filters, sortable headers, pagination,
 * column visibility and Excel export of the filtered rows.
 *
 * Column definitions provide `meta.label` (header text, also used in the
 * column menu and Excel) and optionally `meta.exportValue` / `meta.align`.
 */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type FilterFn,
  type Row,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Columns3, FileSpreadsheet, Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { exportToExcel } from "./export-excel";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    label?: string;
    align?: "start" | "end" | "center";
    exportValue?: (row: TData) => string | number | null | undefined;
    className?: string;
  }
}

export type TableFilter = {
  columnId: string;
  label: string;
  options: { value: string; label: string }[];
};

/** Matches a single value or any element of an array value. */
const equalsOrIncludes: FilterFn<unknown> = (row, id, value) => {
  if (!value || value === "__all") return true;
  const v = row.getValue(id);
  return Array.isArray(v) ? v.map(String).includes(value) : String(v) === value;
};

export function DataTable<T>({
  data,
  columns,
  searchText,
  filters = [],
  exportName,
  toolbar,
  rowHref,
  rowClassName,
  initialSort = [],
  pageSize = 20,
}: {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  /** Text used by the search box for each row. */
  searchText?: (row: T) => string;
  filters?: TableFilter[];
  /** File name (without extension) for Excel export; omit to hide the button. */
  exportName?: string;
  toolbar?: React.ReactNode;
  rowHref?: (row: T) => string;
  rowClassName?: (row: T) => string | undefined;
  initialSort?: SortingState;
  pageSize?: number;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>(initialSort);
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [visibility, setVisibility] = useState<VisibilityState>({});
  const [exporting, setExporting] = useState(false);

  const cols = useMemo(
    () =>
      columns.map((c) => {
        const id = (c.id ?? (c as { accessorKey?: string }).accessorKey) as string | undefined;
        return filters.some((f) => f.columnId === id) ? { ...c, filterFn: equalsOrIncludes as FilterFn<T> } : c;
      }),
    [columns, filters],
  );

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table is not compiler-memoizable; fine without React Compiler.
  const table = useReactTable({
    data,
    columns: cols,
    state: { sorting, globalFilter, columnFilters, columnVisibility: visibility },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setVisibility,
    globalFilterFn: (row: Row<T>, _id, value: string) => {
      if (!value) return true;
      const hay = (searchText ? searchText(row.original) : JSON.stringify(row.original)).toLowerCase();
      return value
        .toLowerCase()
        .split(/\s+/)
        .every((w) => hay.includes(w));
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  const filtered = table.getFilteredRowModel().rows.length;
  const hasFilters = !!globalFilter || columnFilters.length > 0;
  const { pageIndex } = table.getState().pagination;
  const pageCount = Math.max(1, table.getPageCount());
  const Prev = locale === "ar" ? ChevronRight : ChevronLeft;
  const Next = locale === "ar" ? ChevronLeft : ChevronRight;

  async function onExport() {
    setExporting(true);
    try {
      const visibleCols = table.getVisibleLeafColumns().filter((c) => c.columnDef.meta?.label);
      await exportToExcel({
        fileName: exportName!,
        rtl: locale === "ar",
        headers: visibleCols.map((c) => c.columnDef.meta!.label!),
        rows: table.getSortedRowModel().rows.map((r) =>
          visibleCols.map((c) => {
            const ev = c.columnDef.meta?.exportValue;
            const v = ev ? ev(r.original) : r.getValue(c.id);
            return v == null ? "" : typeof v === "number" ? v : String(v);
          }),
        ),
      });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative w-full lg:max-w-xs">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder={t("table.search")}
            className="ps-8"
            aria-label={t("table.search")}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {filters.map((f) => {
            const col = table.getColumn(f.columnId);
            return (
              <Select
                key={f.columnId}
                value={(col?.getFilterValue() as string) ?? "__all"}
                onValueChange={(v) => col?.setFilterValue(v === "__all" ? undefined : v)}
              >
                <SelectTrigger size="sm" className="min-w-36" aria-label={f.label}>
                  <SelectValue placeholder={f.label} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">
                    {f.label}: {t("common.all")}
                  </SelectItem>
                  {f.options.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            );
          })}
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setGlobalFilter("");
                setColumnFilters([]);
              }}
            >
              <X /> {t("table.reset")}
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2 lg:ms-auto">
          {toolbar}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Columns3 /> <span className="hidden sm:inline">{t("table.columns")}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {table
                .getAllLeafColumns()
                .filter((c) => c.getCanHide() && c.columnDef.meta?.label)
                .map((c) => (
                  <DropdownMenuCheckboxItem
                    key={c.id}
                    checked={c.getIsVisible()}
                    onCheckedChange={(v) => c.toggleVisibility(!!v)}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {c.columnDef.meta?.label}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {exportName && (
            <Button variant="outline" size="sm" onClick={onExport} disabled={exporting || filtered === 0}>
              {exporting ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}
              <span className="hidden sm:inline">{t("common.exportExcel")}</span>
            </Button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader className="bg-muted/50">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => {
                  const meta = h.column.columnDef.meta;
                  const sorted = h.column.getIsSorted();
                  return (
                    <TableHead
                      key={h.id}
                      className={cn(meta?.align === "end" && "text-end", meta?.align === "center" && "text-center", meta?.className)}
                      aria-sort={sorted ? (sorted === "asc" ? "ascending" : "descending") : undefined}
                    >
                      {h.isPlaceholder ? null : h.column.getCanSort() ? (
                        <button
                          type="button"
                          onClick={h.column.getToggleSortingHandler()}
                          className={cn("inline-flex items-center gap-1 hover:text-foreground", meta?.align === "end" && "flex-row-reverse")}
                        >
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {sorted === "asc" ? (
                            <ArrowUp className="size-3.5" />
                          ) : sorted === "desc" ? (
                            <ArrowDown className="size-3.5" />
                          ) : (
                            <ArrowUpDown className="size-3.5 opacity-40" />
                          )}
                        </button>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={cn(rowHref && "cursor-pointer", rowClassName?.(row.original))}
                  onClick={(e) => {
                    if (!rowHref) return;
                    // Ignore clicks on interactive elements inside the row.
                    if ((e.target as HTMLElement).closest("a,button,input,[role=menuitem],[role=checkbox]")) return;
                    router.push(rowHref(row.original));
                  }}
                >
                  {row.getVisibleCells().map((cell) => {
                    const meta = cell.column.columnDef.meta;
                    return (
                      <TableCell
                        key={cell.id}
                        className={cn(meta?.align === "end" && "num text-end", meta?.align === "center" && "text-center", meta?.className)}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={table.getVisibleLeafColumns().length} className="h-28 text-center text-muted-foreground">
                  {t("table.noRows")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col items-center justify-between gap-2 text-sm text-muted-foreground sm:flex-row">
        <span>{t("table.rows", { count: filtered })}</span>
        <div className="flex items-center gap-2">
          <Select value={String(table.getState().pagination.pageSize)} onValueChange={(v) => table.setPageSize(Number(v))}>
            <SelectTrigger size="sm" className="w-20" aria-label={t("common.rowsPerPage")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 20, 50, 100].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="whitespace-nowrap">{t("common.pageOf", { page: pageIndex + 1, pages: pageCount })}</span>
          <Button variant="outline" size="icon-sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label={t("common.previous")}>
            <Prev />
          </Button>
          <Button variant="outline" size="icon-sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label={t("common.next")}>
            <Next />
          </Button>
        </div>
      </div>
    </div>
  );
}
