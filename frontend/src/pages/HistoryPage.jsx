import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Search, Trash2, FileText, FileDown, Eye, Filter } from "lucide-react";

import { api, API } from "@/lib/api";
import { ASTM_RATINGS, CATEGORY_STYLE } from "@/lib/astm";
import CategoryBadge from "@/components/CategoryBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const ALL_RATINGS = "__all__";

export default function HistoryPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [rating, setRating] = useState(ALL_RATINGS);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [detail, setDetail] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const params = {};
      if (q) params.q = q;
      if (rating && rating !== ALL_RATINGS) params.rating = rating;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const { data } = await api.get("/analyses", { params });
      setItems(data.items || []);
    } catch (e) {
      toast.error("Failed to load history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
    // eslint-disable-next-line
  }, []);

  const applyFilters = () => fetchItems();
  const resetFilters = () => {
    setQ("");
    setRating(ALL_RATINGS);
    setDateFrom("");
    setDateTo("");
    setTimeout(fetchItems, 0);
  };

  const showDetail = async (id) => {
    try {
      const { data } = await api.get(`/analyses/${id}`);
      setDetail(data);
    } catch (e) {
      toast.error("Failed to load detail");
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await api.delete(`/analyses/${toDelete.id}`);
      toast.success("Deleted");
      setToDelete(null);
      fetchItems();
    } catch (e) {
      toast.error("Delete failed");
    }
  };

  const downloadCsv = () => {
    window.open(`${API}/analyses/export/csv`, "_blank");
  };

  const totalsByCategory = useMemo(() => {
    const c = { "Slight Tarnish": 0, "Moderate Tarnish": 0, "Dark Tarnish": 0, "Corrosion": 0 };
    items.forEach((i) => { if (c[i.category] !== undefined) c[i.category] += 1; });
    return c;
  }, [items]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900">
            Analysis History
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            All saved copper strip analyses.  {items.length} record{items.length === 1 ? "" : "s"}.
          </p>
        </div>
        <Button
          onClick={downloadCsv}
          className="bg-slate-900 hover:bg-slate-800"
          data-testid="export-csv-btn"
        >
          <FileDown className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Category stat cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Object.entries(totalsByCategory).map(([cat, count]) => {
          const style = CATEGORY_STYLE[cat];
          return (
            <div
              key={cat}
              data-testid={`stat-${cat.replace(/\s+/g, "-").toLowerCase()}`}
              className={`rounded-lg border p-4 ring-1 ring-inset ${style.bg} ${style.ring}`}
            >
              <div className={`text-xs font-semibold uppercase tracking-wider ${style.text}`}>
                {cat}
              </div>
              <div className={`mt-1 font-display text-3xl font-extrabold ${style.text}`}>
                {count}
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            <div className="md:col-span-2 space-y-1.5">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  id="search"
                  data-testid="search-input"
                  className="pl-8"
                  placeholder="Sample name or notes…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Rating</Label>
              <Select value={rating} onValueChange={setRating}>
                <SelectTrigger data-testid="rating-filter">
                  <SelectValue placeholder="All ratings" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_RATINGS}>All ratings</SelectItem>
                  {ASTM_RATINGS.map((r) => (
                    <SelectItem key={r.rating} value={r.rating}>
                      {r.rating.toUpperCase()} — {r.category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="from">Date from</Label>
              <Input
                id="from"
                data-testid="date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="to">Date to</Label>
              <Input
                id="to"
                data-testid="date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button
              onClick={applyFilters}
              className="bg-slate-900 hover:bg-slate-800"
              data-testid="apply-filters-btn"
            >
              Apply
            </Button>
            <Button
              variant="ghost"
              onClick={resetFilters}
              data-testid="reset-filters-btn"
            >
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center p-16 text-slate-500">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading…
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 text-center">
              <FileText className="h-10 w-10 text-slate-300" />
              <div className="mt-3 font-semibold text-slate-700">No analyses yet</div>
              <div className="mt-1 text-sm text-slate-500">
                Run your first analysis from the Analyzer page.
              </div>
            </div>
          ) : (
            <Table data-testid="history-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Sample</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row, idx) => (
                  <TableRow
                    key={row.id}
                    data-testid={`history-row-${row.id}`}
                    className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/60"}
                  >
                    <TableCell className="font-mono text-xs text-slate-600">
                      {formatDate(row.created_at)}
                    </TableCell>
                    <TableCell className="font-medium text-slate-800">
                      {row.sample_name || <span className="text-slate-400">—</span>}
                    </TableCell>
                    <TableCell>
                      <span className="rating-display text-2xl text-slate-900">
                        {row.rating.toUpperCase()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <CategoryBadge category={row.category} />
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-600">
                      {row.confidence != null
                        ? `${(row.confidence * 100).toFixed(0)}%`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => showDetail(row.id)}
                          data-testid={`view-btn-${row.id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(`${API}/analyses/${row.id}/pdf`, "_blank")}
                          data-testid={`pdf-btn-${row.id}`}
                        >
                          <FileDown className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setToDelete(row)}
                          data-testid={`delete-btn-${row.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-rose-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail dialog */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-3xl" data-testid="detail-dialog">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-bold tracking-tight">
              Analysis Detail
            </DialogTitle>
            <DialogDescription className="font-mono text-xs">
              {detail && formatDate(detail.created_at)}
            </DialogDescription>
          </DialogHeader>

          {detail && (
            <div className="grid gap-6 md:grid-cols-2">
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                {detail.image_data ? (
                  <img src={detail.image_data} alt="Sample" className="h-full w-full object-contain" />
                ) : (
                  <div className="flex h-64 items-center justify-center text-slate-400">No image</div>
                )}
              </div>
              <div className="space-y-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                    Rating
                  </div>
                  <div className="rating-display text-6xl text-blue-700">
                    {detail.rating.toUpperCase()}
                  </div>
                  <div className="mt-1">
                    <CategoryBadge category={detail.category} />
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                    Sample
                  </div>
                  <div className="font-mono text-sm text-slate-700">
                    {detail.sample_name || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                    Description
                  </div>
                  <p className="text-sm text-slate-700">{detail.description}</p>
                </div>
                {detail.notes && (
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                      Notes
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-slate-700">{detail.notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            {detail && (
              <Button
                variant="outline"
                onClick={() => window.open(`${API}/analyses/${detail.id}/pdf`, "_blank")}
                data-testid="detail-pdf-btn"
              >
                <FileDown className="mr-2 h-4 w-4" />
                Export PDF
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent data-testid="delete-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this analysis?</AlertDialogTitle>
            <AlertDialogDescription>
              This action is permanent and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="delete-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700"
              onClick={confirmDelete}
              data-testid="delete-confirm"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function formatDate(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
