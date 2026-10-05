import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useListRequisitions, getListRequisitionsQueryKey } from "@workspace/api-client-react";
import { formatINR, formatDate } from "@/lib/format";
import { StatusBadge } from "@/components/requisition/StatusBadge";
import { PriorityBadge } from "@/components/requisition/PriorityBadge";
import { Input } from "@/components/ui/input";
import { Search, PlusCircle, FilterX, MapPin, Calendar } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useRole } from "@/context/RoleContext";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "pending_checkers", label: "Pending Checkers" },
  { value: "pending_approver", label: "Pending Approval" },
  { value: "on_hold", label: "On Hold" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const DRAFT_KEY = "reqflow:create-requisition-draft";
const LIST_PREFERENCES_KEY = "reqflow:requisitions-list";

function readListPreferences(userId: number) {
  try {
    const saved = sessionStorage.getItem(`${LIST_PREFERENCES_KEY}:${userId}`);
    if (saved) return JSON.parse(saved) as { searchInput?: string; statusFilter?: string; priorityFilter?: string; hasQueriesFilter?: string; tab?: string };
  } catch {
    // Ignore unavailable or invalid session storage and use the defaults.
  }
  return {};
}

export default function RequisitionsList() {
  const { user } = useRole();
  const { toast } = useToast();
  const savedPreferences = readListPreferences(user.id);
  const hasQueriesFromUrl = new URLSearchParams(window.location.search).get("has_queries") === "true";
  const clearDraft = () => {
  localStorage.removeItem(DRAFT_KEY);
    toast({
      title: "Draft cleared",
      description: "The saved requisition draft has been removed.",
    });
  };
  const [searchInput, setSearchInput] = useState(savedPreferences.searchInput ?? "");
  const [search, setSearch] = useState(savedPreferences.searchInput ?? "");
  const [statusFilter, setStatusFilter] = useState(hasQueriesFromUrl || savedPreferences.hasQueriesFilter === "yes" ? "has_queries" : savedPreferences.statusFilter ?? "all");
  const [priorityFilter, setPriorityFilter] = useState(savedPreferences.priorityFilter ?? "all");
  const [tab, setTab] = useState(savedPreferences.tab === "action" ? "action" : "all");

  useEffect(() => {
    try {
      sessionStorage.setItem(`${LIST_PREFERENCES_KEY}:${user.id}`, JSON.stringify({ searchInput, statusFilter, priorityFilter, tab }));
    } catch {
      // Filtering continues to work when storage is unavailable.
    }
  }, [user.id, searchInput, statusFilter, priorityFilter, tab]);

  // Debounce: wait for a short pause in typing before actually searching,
  // rather than firing a request on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const params: Record<string, string | number | boolean | undefined> = {};
  if (statusFilter === "has_queries") params.has_queries = true;
  else if (statusFilter !== "all") params.status = statusFilter;
  if (priorityFilter !== "all") params.priority = priorityFilter;
  if (user.role === "site_user") params.raised_by_id = user.id;
  // if (user.role === "purchase_member") params.assigned_to_id = user.id;
  if (user.role === "checker") params.checker_id = user.id;
  if (search) params.search = search;
  if (tab === "action") params.needs_action = true;

  const { data: requisitions, isLoading } = useListRequisitions(params as Parameters<typeof useListRequisitions>[0]);

  const hasFilters = statusFilter !== "all" || priorityFilter !== "all" || !!search || tab === "action";

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Requisitions</h1>
          <p className="text-muted-foreground text-sm mt-0.5">All purchase requests across sites</p>
        </div>
        {user.role === "site_user" && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={clearDraft}
              data-testid="button-clear-draft"
            >
              Clear Draft
            </Button>

            <Link
              href="/requisitions/new"
              className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
              data-testid="button-create-req"
            >
              <PlusCircle className="w-4 h-4" />
              New Requisition
            </Link>
          </div>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList aria-label="Requisition views">
          <TabsTrigger value="all">All Requisitions</TabsTrigger>
          <TabsTrigger value="action">Needs My Action</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-col sm:flex-row gap-3 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search ref no., requester, purpose, site, item, vessel/equipment..." className="pl-9 w-full" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} data-testid="input-search" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="has_queries">Has Queries</SelectItem>
            {STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-full sm:w-[140px]" data-testid="select-priority">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            {PRIORITY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {hasFilters && (
          <button onClick={() => { setStatusFilter("all"); setPriorityFilter("all"); setSearchInput(""); setSearch(""); }} className="p-2 text-muted-foreground hover:text-foreground" title="Clear" data-testid="button-clear-filters">
            <FilterX className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="rounded-lg border bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Ref No.</TableHead>
              <TableHead>Purpose / Requester</TableHead>
              <TableHead>Site</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Est. Value (₹)</TableHead>
              <TableHead className="text-right">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                </TableRow>
              ))
            ) : !requisitions?.length ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground text-sm">
                  {hasFilters ? "No requisitions match your filters." : "No requisitions yet."}
                </TableCell>
              </TableRow>
            ) : (
              requisitions.map((req) => (
                <TableRow key={req.id} className="cursor-pointer hover:bg-muted/40 group" data-testid={`row-req-${req.id}`}>
                  <TableCell>
                    <Link href={`/requisitions/${req.id}`} className="block">
                      <span className="font-mono text-sm font-semibold text-primary group-hover:underline">{req.ref_number}</span>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/requisitions/${req.id}`} className="block">
                      <p className="font-medium text-sm truncate max-w-[200px]">{req.purpose ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{req.raised_by_name}</p>
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{req.site_name ?? "—"}</span>
                  </TableCell>
                  <TableCell><PriorityBadge priority={req.priority} /></TableCell>
                  <TableCell><StatusBadge status={req.status} /></TableCell>
                  <TableCell className="text-right font-medium text-sm">{formatINR(req.total_expected_cost)}</TableCell>
                  <TableCell className="text-right text-muted-foreground text-xs">
                    <span className="flex items-center justify-end gap-1"><Calendar className="w-3 h-3" />{formatDate(req.requisition_date)}</span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {requisitions && <p className="text-xs text-muted-foreground text-right">{requisitions.length} requisition{requisitions.length !== 1 ? "s" : ""} shown</p>}
    </div>
  );
}
