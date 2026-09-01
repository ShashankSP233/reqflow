import { useState, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useGetRequisition,
  getGetRequisitionQueryKey,
  getListApprovalNotesQueryKey,
  useSubmitRequisition,
  useChecker1Review,
  useChecker2Review,
  useApproveRequisition,
  useRejectRequisition,
  useHoldRequisition,
  useResumeRequisition,
  useCompleteRequisition,
  useListApprovalNotes,
  useAddApprovalNote,
  useDeleteApprovalNote,
  useAssignRequisition,
  useAddRequisitionItem,                      // add item during edit log 25-8
  useUpdateRequisitionItem,
  useListAssets,
  useListItemNames,
  useRaiseQuery,
  useReplyToQuery,
  useResolveQuery,
  useAddStatusUpdate,
  useDeleteRequisition,
  useListUsers,
  getListRequisitionsQueryKey,
  getGetAnalyticsSummaryQueryKey,
  ApiError,
} from "@workspace/api-client-react";
import type { RequisitionDetail as RequisitionDetailType } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatINR, formatDate, formatDateTime } from "@/lib/format";
import { StatusBadge } from "@/components/requisition/StatusBadge";
import { PriorityBadge } from "@/components/requisition/PriorityBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Paperclip, MessageSquare, CheckCircle, XCircle, Send, Upload, Trash2, ClipboardList, IndianRupee, User, MapPin, Calendar, Folder, Pencil, PauseCircle, PlayCircle, FileCheck, PlusCircle } from "lucide-react";
import { Link } from "wouter";
import { useRole } from "@/context/RoleContext";

const STAGE_OPTIONS = [
  { value: "prepared", label: "Prepared" },
  { value: "checked", label: "Checked" },
  { value: "accounts_reviewed", label: "Reviewed by Accounts" },
  { value: "reviewed_person1", label: "Reviewed by Person 1" },
  { value: "reviewed_person2", label: "Reviewed by Person 2" },
  { value: "reviewed_person3", label: "Reviewed by Person 3" },
  { value: "reviewed_md", label: "Reviewed by MD" },
  { value: "reviewed_chairman", label: "Reviewed by Chairman" },
];

export default function RequisitionDetail() {
  const [, params] = useRoute("/requisitions/:id");
  const [, setLocation] = useLocation();
  const id = Number(params?.id);
  const { user } = useRole();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [submitOpen, setSubmitOpen] = useState(false);
  const [checkerReviewOpen, setCheckerReviewOpen] = useState(false);
  const [approverOpen, setApproverOpen] = useState(false);
  const [holdOpen, setHoldOpen] = useState(false);
  const [queryOpen, setQueryOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [statusUpdateOpen, setStatusUpdateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [approvalNoteOpen, setApprovalNoteOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [replyQueryId, setReplyQueryId] = useState<number | null>(null);
  const [replyFile, setReplyFile] = useState<File | null>(null);
  const [uploadingFor, setUploadingFor] = useState<"requisition" | null>(null);

  const { data: req, isLoading, error } =
    useGetRequisition<RequisitionDetailType, ApiError>(id, {
      query: {
        enabled: !!id,
        queryKey: getGetRequisitionQueryKey(id),
      },
    });
  const { data: allUsers } = useListUsers();
  const { data: assets } = useListAssets(req?.project_id ? { project_id: req.project_id } : undefined);
  const { data: itemNameSuggestions } = useListItemNames();
  // Only people assigned to this requisition's project are eligible — keeps
  // checker/approver selection consistent with the project-based visibility
  // rules (point 8).
  const projectScoped = (u: { project_ids?: number[] }) => !req?.project_id || u.project_ids?.includes(req.project_id);
  const checkers = allUsers?.filter(u => u.role === "checker" && projectScoped(u)) ?? [];
  const approvers = allUsers?.filter(u => u.role === "approver" && projectScoped(u)) ?? [];
  const purchaseMembers = allUsers?.filter(u => u.role === "purchase_member") ?? [];
  const { data: approvalNotes } = useListApprovalNotes(id, {
      query: {
        enabled: !!id,
        queryKey: getListApprovalNotesQueryKey(id),
      },
    });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetRequisitionQueryKey(id) });
    queryClient.invalidateQueries({ queryKey: getListRequisitionsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetAnalyticsSummaryQueryKey() });
  };

  const submitMut = useSubmitRequisition();
  const checker1Mut = useChecker1Review();
  const checker2Mut = useChecker2Review();
  const approveMut = useApproveRequisition();
  const rejectMut = useRejectRequisition();
  const holdMut = useHoldRequisition();
  const resumeMut = useResumeRequisition();
  const completeMut = useCompleteRequisition();
  const addApprovalNoteMut = useAddApprovalNote();
  const deleteApprovalNoteMut = useDeleteApprovalNote();
  const assignMut = useAssignRequisition();
  const updateItemMut = useUpdateRequisitionItem();
  const addItemMut = useAddRequisitionItem()                // adding item while editing log 25-8
  const raiseQueryMut = useRaiseQuery();
  const replyMut = useReplyToQuery();
  const resolveMut = useResolveQuery();
  const statusUpdateMut = useAddStatusUpdate();
  const deleteMut = useDeleteRequisition();

  // Forms
  const submitForm = useForm({ defaultValues: { checker1_id: "", checker1_name: "", checker2_id: "", checker2_name: "", approver_id: "", approver_name: "" } });
  const checkerForm = useForm({ defaultValues: { action: "approved", suggestion: "" } });
  const approverForm = useForm({ defaultValues: { action: "approved", suggestion: "" } });
  const holdForm = useForm({ defaultValues: { reason: "" } });
  const queryForm = useForm({ defaultValues: { message: "" } });
  const replyForm = useForm({ defaultValues: { message: "" } });
  const assignForm = useForm({ defaultValues: { assigned_to_id: "", assigned_to_name: "" } });
  const statusForm = useForm({ defaultValues: { stage: "prepared", notes: "" } });
  const [editItems, setEditItems] = useState<Array<{ tempId: string;id: number; item_name: string; quantity: string; unit: string; reference_no: string; expected_cost: string; description: string; remark: string; asset_id: string; asset_name: string }>>([]);
  const approvalNoteForm = useForm({ defaultValues: { note_number: "" } });

  if (isLoading) return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  );

  if (!req) {
    const isForbidden = error instanceof ApiError && error.status === 403;
    return (
      <div className="p-6 text-center text-muted-foreground" data-testid="text-requisition-unavailable">
        {isForbidden
          ? "You don't have access to this requisition's project. Ask Purchase Head to add you under Setup → Users."
          : "Requisition not found."}
      </div>
    );
  }

  const isChecker1 = user.role === "checker" && req.status === "pending_checkers" && req.checker1_id === user.id && req.checker1_status !== "approved";
  const isChecker2 = user.role === "checker" && req.status === "pending_checkers" && req.checker2_id === user.id && req.checker2_status !== "approved";
  const isWaitingOnOtherChecker =
    user.role === "checker" &&
    req.status === "pending_checkers" &&
    ((req.checker1_id === user.id && req.checker1_status === "approved") ||
      (req.checker2_id === user.id && req.checker2_status === "approved"));
  const isApprover = user.role === "approver" && req.approver_id === user.id && req.status === "pending_approver";
  const isOnHold = req.status === "on_hold";
  const isPurchaseHead = user.role === "purchase_head";
  const canResume = isOnHold && (isPurchaseHead || req.checker1_id === user.id || req.checker2_id === user.id || req.approver_id === user.id);
  const isPurchaseMember = user.role === "purchase_member" && req.assigned_to_id === user.id;
  const canSubmit = user.role === "site_user" && req.status === "draft" && req.raised_by_id === user.id;
  const canRaiseQuery = ["site_user", "checker", "approver", "purchase_head", "purchase_member"].includes(user.role);
  // Point 1: raiser, either checker, or the approver can edit while it's
  // still in an editable stage — mirrors the backend's canEditRequisition.
  const isParty = req.raised_by_id === user.id || req.checker1_id === user.id || req.checker2_id === user.id || req.approver_id === user.id;
  const canEdit = (isPurchaseHead || isParty) && ["draft", "pending_checkers", "pending_approver", "on_hold"].includes(req.status);
  const canComplete = isPurchaseHead && req.status === "in_progress";

  function startEdit() {

    if (!req) return;

    setEditItems((req.items ?? []).map((item) => ({
      tempId: `existing-${item.id}`,
      id: item.id,
      item_name: item.item_name,
      quantity: String(item.quantity),
      unit: item.unit ?? "",
      reference_no: item.reference_no ?? "",
      expected_cost: item.expected_cost != null ? String(item.expected_cost) : "",
      description: item.description ?? "",
      remark: item.remark ?? "",
      asset_id: item.asset_id ? String(item.asset_id) : "",
      asset_name: item.asset_name ?? "",
    })));
    setEditOpen(true);
  }

  function updateEditItem(tempId: string, field: string, value: string) {
    setEditItems((prev) => prev.map((it) => (it.tempId === tempId ? { ...it, [field]: value } : it)));
  }

  function removeUnsavedEditItem(tempId: string) {
  setEditItems((prev) =>
    prev.filter((it) => !(it.id === 0 && it.tempId === tempId))
  );
}
  function addNewEditItem() {
    setEditItems((prev) => [
      ...prev,
      {
        tempId: `new-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        id: 0,
        item_name: "",
        quantity: "",
        unit: "",
        reference_no: "",
        expected_cost: "",
        description: "",
        remark: "",
        asset_id: "",
        asset_name: "",
      },
    ]);
  }
  async function saveEditedItems() {
    try {
      await Promise.all(
        editItems.map((it) => {
          const data = {
            item_name: it.item_name,
            quantity: Number(it.quantity),
            unit: it.unit || undefined,
            reference_no: it.reference_no || undefined,
            expected_cost: it.expected_cost
              ? Number(it.expected_cost)
              : null,
            description: it.description || undefined,
            remark: it.remark || undefined,
            asset_id: it.asset_id ? Number(it.asset_id) : null,
            asset_name: it.asset_name || undefined,
          };

          if (it.id > 0) {
            return updateItemMut.mutateAsync({
              id,
              itemId: it.id,
              data,
            });
          }

          return addItemMut.mutateAsync({
            id,
            data,
          });
        })
      );

      invalidate();
      setEditOpen(false);

      toast({
        title: "Items updated",
        description: "The requisition items have been saved successfully.",
      });
    } catch (error) {
      toast({
        title: "Some items didn't save",
        description: "Please check the items and try again.",
        variant: "destructive",
      });
    }
  }
  
  

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch(`/api/upload/${id}?context=requisition&uploaded_by=${encodeURIComponent(user.name)}`, { method: "POST", body: formData });
      if (!res.ok) throw new Error();
      toast({ title: "File uploaded" });
      invalidate();
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }
  
  const formatStatusUpdateTime = (value: string) => {
    const date = new Date(value);
    date.setMinutes(date.getMinutes() - 330);

    return formatDateTime(date.toISOString());
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link href="/requisitions" className="mt-1 p-2 rounded-md hover:bg-accent text-muted-foreground">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold font-mono">{req.ref_number}</h1>
              <StatusBadge status={req.status} />
              <PriorityBadge priority={req.priority} />
            </div>
            <p className="text-muted-foreground text-sm mt-1">{req.purpose ?? "No purpose stated"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {canEdit && (
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={startEdit} data-testid="button-edit-requisition">
                  <Pencil className="w-3.5 h-3.5" />Edit
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Edit Line Items</DialogTitle></DialogHeader>
                <div className="space-y-4 mt-2">
                  {editItems.length === 0 && <p className="text-sm text-muted-foreground">No items on this requisition.</p>}
                  {editItems.map((it, index) => (
                    <div key={it.tempId} className="border rounded-lg p-3 bg-muted/20 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-muted-foreground">
                          Item #{index + 1}
                        </p>

                        {it.id === 0 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => removeUnsavedEditItem(it.tempId)}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="col-span-2">
                          <label className="text-xs font-medium">Item Name</label>
                          <Input
                            value={it.item_name}
                            list="edit-item-name-suggestions"
                            autoComplete="off"
                            onChange={(e) => updateEditItem(it.tempId, "item_name", e.target.value)}
                            data-testid={`input-edit-item-name-${it.id}`}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium">Quantity</label>
                          <Input type="number" step="0.001" min="0" value={it.quantity} onChange={(e) => updateEditItem(it.tempId, "quantity", e.target.value)} data-testid={`input-edit-item-qty-${it.id}`} />
                        </div>
                        <div>
                          <label className="text-xs font-medium">Unit</label>
                          <Input value={it.unit} onChange={(e) => updateEditItem(it.tempId, "unit", e.target.value)} data-testid={`input-edit-item-unit-${it.id}`} />
                        </div>
                        <div>
                          <label className="text-xs font-medium">Reference No.</label>
                          <Input value={it.reference_no} onChange={(e) => updateEditItem(it.tempId, "reference_no", e.target.value)} data-testid={`input-edit-item-ref-${it.id}`} />
                        </div>
                        <div>
                          <label className="text-xs font-medium">Expected Cost (₹, benchmark)</label>
                          <Input type="number" step="0.01" min="0" value={it.expected_cost} onChange={(e) => updateEditItem(it.tempId, "expected_cost", e.target.value)} data-testid={`input-edit-item-cost-${it.id}`} />
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs font-medium">Vessel / Equipment / Location</label>
                          <Select
                            value={it.asset_id}
                            onValueChange={(v) => {
                              const a = assets?.find((a) => String(a.id) === v);
                              updateEditItem(it.tempId, "asset_id", v);
                              updateEditItem(it.tempId, "asset_name", a?.name ?? "");
                            }}
                          >
                            <SelectTrigger data-testid={`select-edit-item-asset-${it.id}`}><SelectValue placeholder="None" /></SelectTrigger>
                            <SelectContent>{assets?.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs font-medium">Description</label>
                          <Input value={it.description} onChange={(e) => updateEditItem(it.tempId, "description", e.target.value)} data-testid={`input-edit-item-desc-${it.id}`} />
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs font-medium">Remark</label>
                          <Input value={it.remark} onChange={(e) => updateEditItem(it.tempId, "remark", e.target.value)} data-testid={`input-edit-item-remark-${it.id}`} />
                        </div>
                      </div>
                    </div>
                  ))}
                  <datalist id="edit-item-name-suggestions">
                    {itemNameSuggestions?.map((name) => <option key={name} value={name} />)}
                  </datalist>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={addNewEditItem}
                  >
                    + Add Another Item
                  </Button>

                  <Button
                    className="w-full"
                    disabled={updateItemMut.isPending || editItems.length === 0}
                    onClick={saveEditedItems}
                    data-testid="button-save-edit"
                  >
                    Save Changes
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}

          {canSubmit && (
            <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="button-submit">Submit for Review</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Submit Requisition</DialogTitle></DialogHeader>
                <div className="space-y-3 mt-2">
                  <p className="text-sm text-muted-foreground">
                    Select both checkers and the approver for this requisition. Either checker can review first —
                    it moves to the approver once both have checked it.
                  </p>
                  <div>
                    <label className="text-sm font-medium">Checker 1</label>
                    <Select onValueChange={(v) => {
                      const u = checkers.find(c => String(c.id) === v);
                      if (u) { submitForm.setValue("checker1_id", v); submitForm.setValue("checker1_name", u.name); }
                    }}>
                      <SelectTrigger data-testid="select-checker1"><SelectValue placeholder="Select Checker 1" /></SelectTrigger>
                      <SelectContent>{checkers.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Checker 2</label>
                    <Select onValueChange={(v) => {
                      const u = checkers.find(c => String(c.id) === v);
                      if (u) { submitForm.setValue("checker2_id", v); submitForm.setValue("checker2_name", u.name); }
                    }}>
                      <SelectTrigger data-testid="select-checker2"><SelectValue placeholder="Select Checker 2" /></SelectTrigger>
                      <SelectContent>{checkers.filter(c => String(c.id) !== submitForm.watch("checker1_id")).map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Approver</label>
                    <Select onValueChange={(v) => {
                      const u = approvers.find(a => String(a.id) === v);
                      if (u) { submitForm.setValue("approver_id", v); submitForm.setValue("approver_name", u.name); }
                    }}>
                      <SelectTrigger data-testid="select-approver"><SelectValue placeholder="Select approver" /></SelectTrigger>
                      <SelectContent>{approvers.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <Button className="w-full" disabled={submitMut.isPending} onClick={() => {
                    const vals = submitForm.getValues();
                    if (!vals.checker1_id || !vals.checker2_id || !vals.approver_id) { toast({ title: "Select both checkers and an approver", variant: "destructive" }); return; }
                    if (vals.checker1_id === vals.checker2_id) { toast({ title: "Checker 1 and Checker 2 must be different people", variant: "destructive" }); return; }
                    submitMut.mutate({
                      id,
                      data: {
                        checker1_id: Number(vals.checker1_id), checker1_name: vals.checker1_name,
                        checker2_id: Number(vals.checker2_id), checker2_name: vals.checker2_name,
                        approver_id: Number(vals.approver_id), approver_name: vals.approver_name,
                      },
                    }, {
                      onSuccess: () => { invalidate(); setSubmitOpen(false); toast({ title: "Submitted for review" }); },
                    });
                  }} data-testid="button-confirm-submit">
                    {submitMut.isPending ? "Submitting..." : "Submit"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}

          {isWaitingOnOtherChecker && (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200" data-testid="badge-waiting-other-checker">
              You've checked this — waiting on the other checker
            </Badge>
          )}

          {(isChecker1 || isChecker2) && (
            <Dialog open={checkerReviewOpen} onOpenChange={setCheckerReviewOpen}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="button-checker-review">Review</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Checker Review</DialogTitle></DialogHeader>
                <div className="space-y-3 mt-2">
                  <div>
                    <label className="text-sm font-medium">Action</label>
                    <Select defaultValue="approved" onValueChange={(v) => checkerForm.setValue("action", v)}>
                      <SelectTrigger data-testid="select-checker-action"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="approved">Approve</SelectItem>
                        <SelectItem value="rejected">Reject</SelectItem>
                        <SelectItem value="hold">Hold</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">{checkerForm.watch("action") === "hold" ? "Reason for hold" : "Suggestion / Notes"}</label>
                    <Textarea placeholder={checkerForm.watch("action") === "hold" ? "Why is this being paused..." : "Add your suggestion or notes..."} rows={3} onChange={(e) => checkerForm.setValue("suggestion", e.target.value)} data-testid="input-checker-suggestion" />
                  </div>
                  <Button className="w-full" disabled={checker1Mut.isPending || checker2Mut.isPending} onClick={() => {
                    const vals = checkerForm.getValues();
                    const mutFn = isChecker1 ? checker1Mut : checker2Mut;
                    mutFn.mutate({ id, data: { action: vals.action, suggestion: vals.suggestion, checker_name: user.name } }, {
                      onSuccess: () => {
                        invalidate(); setCheckerReviewOpen(false);
                        toast({ title: vals.action === "hold" ? "Requisition put on hold" : "Review submitted" });
                      },
                    });
                  }} data-testid="button-confirm-review">Submit</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}

          {isApprover && (
            <>
              <Dialog open={approverOpen} onOpenChange={setApproverOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" data-testid="button-approver-action">Approve / Reject</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Approver Decision</DialogTitle></DialogHeader>
                  <div className="space-y-3 mt-2">
                    <Select defaultValue="approved" onValueChange={(v) => approverForm.setValue("action", v)}>
                      <SelectTrigger data-testid="select-approver-action"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="approved">Approve</SelectItem>
                        <SelectItem value="rejected">Reject</SelectItem>
                      </SelectContent>
                    </Select>
                    <Textarea placeholder="Suggestion or reason for rejection..." rows={3} onChange={(e) => approverForm.setValue("suggestion", e.target.value)} data-testid="input-approver-suggestion" />
                    <Button className="w-full" disabled={approveMut.isPending || rejectMut.isPending} onClick={() => {
                      const vals = approverForm.getValues();
                      const mutFn = vals.action === "approved" ? approveMut : rejectMut;
                      mutFn.mutate({ id, data: { action: vals.action, suggestion: vals.suggestion, approver_name: user.name } }, {
                        onSuccess: () => { invalidate(); setApproverOpen(false); toast({ title: vals.action === "approved" ? "Requisition approved" : "Requisition rejected" }); },
                      });
                    }} data-testid="button-confirm-approver">Confirm</Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={holdOpen} onOpenChange={setHoldOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-1.5" data-testid="button-hold">
                    <PauseCircle className="w-3.5 h-3.5" />Hold
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Put On Hold</DialogTitle></DialogHeader>
                  <div className="space-y-3 mt-2">
                    <p className="text-sm text-muted-foreground">An alternative to approving or rejecting — pause this without a final decision yet.</p>
                    <Textarea placeholder="Reason for holding (optional)..." rows={3} {...holdForm.register("reason")} data-testid="input-hold-reason" />
                    <Button className="w-full" variant="outline" disabled={holdMut.isPending} onClick={() => {
                      holdMut.mutate({ id, data: { reason: holdForm.getValues("reason") } }, {
                        onSuccess: () => { invalidate(); setHoldOpen(false); holdForm.reset(); toast({ title: "Requisition put on hold" }); },
                      });
                    }} data-testid="button-confirm-hold">Confirm Hold</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}

          {canResume && (
            <Button size="sm" variant="outline" className="gap-1.5" disabled={resumeMut.isPending} onClick={() => {
              resumeMut.mutate({ id }, { onSuccess: () => { invalidate(); toast({ title: "Resumed" }); } });
            }} data-testid="button-resume">
              <PlayCircle className="w-3.5 h-3.5" />Resume
            </Button>
          )}

          {isPurchaseHead && req.status === "approved" && (
            <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" data-testid="button-assign">Assign to Team</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Assign to Purchase Member</DialogTitle></DialogHeader>
                <div className="space-y-3 mt-2">
                  <Select onValueChange={(v) => {
                    const u = purchaseMembers.find(m => String(m.id) === v);
                    if (u) { assignForm.setValue("assigned_to_id", v); assignForm.setValue("assigned_to_name", u.name); }
                  }}>
                    <SelectTrigger data-testid="select-purchase-member"><SelectValue placeholder="Select team member" /></SelectTrigger>
                    <SelectContent>{purchaseMembers.map(m => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button className="w-full" disabled={assignMut.isPending} onClick={() => {
                    const vals = assignForm.getValues();
                    if (!vals.assigned_to_id) { toast({ title: "Select a team member", variant: "destructive" }); return; }
                    assignMut.mutate({ id, data: { assigned_to_id: Number(vals.assigned_to_id), assigned_to_name: vals.assigned_to_name } }, {
                      onSuccess: () => { invalidate(); setAssignOpen(false); toast({ title: "Assigned to purchase team" }); },
                    });
                  }} data-testid="button-confirm-assign">Assign</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}

          {canComplete && (
            <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1.5" data-testid="button-complete">
                  <FileCheck className="w-3.5 h-3.5" />Close Requisition
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Close Requisition</DialogTitle></DialogHeader>
                <div className="space-y-3 mt-2">
                  <p className="text-xs text-muted-foreground">
                    An approval note number is required to close this — add one below if it isn't linked yet.
                  </p>

                  {approvalNotes && approvalNotes.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {approvalNotes.map(n => (
                        <Badge key={n.id} variant="outline" className="gap-1.5" data-testid={`badge-complete-approval-note-${n.id}`}>
                          {n.note_number}
                          <button type="button" onClick={() => deleteApprovalNoteMut.mutate({ id, noteId: n.id }, { onSuccess: () => invalidate() })} className="text-muted-foreground hover:text-destructive">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Input placeholder="Approval note number" {...approvalNoteForm.register("note_number")} data-testid="input-complete-approval-note" />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={addApprovalNoteMut.isPending}
                      onClick={() => {
                        const note_number = approvalNoteForm.getValues("note_number");
                        if (!note_number) return;
                        addApprovalNoteMut.mutate({ id, data: { note_number } }, {
                          onSuccess: () => { invalidate(); approvalNoteForm.reset(); toast({ title: "Approval note added" }); },
                        });
                      }}
                      data-testid="button-add-approval-note-inline"
                    >
                      Add
                    </Button>
                  </div>

                  {(!approvalNotes || approvalNotes.length === 0) && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2.5">
                      No approval note linked yet — add one above before closing.
                    </p>
                  )}

                  <Button className="w-full" disabled={completeMut.isPending || !approvalNotes?.length} onClick={() => {
                    completeMut.mutate({ id }, {
                      onSuccess: () => { invalidate(); setCompleteOpen(false); toast({ title: "Requisition closed" }); },
                      onError: () => toast({ title: "Error", description: "Add an approval note first.", variant: "destructive" }),
                    });
                  }} data-testid="button-confirm-complete">Confirm Close</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {isOnHold && (
        <div className="flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm bg-orange-50 border-orange-200 text-orange-800" data-testid="banner-on-hold">
          <PauseCircle className="w-4 h-4 flex-shrink-0" />
          On hold{req.hold_reason ? ` — ${req.hold_reason}` : ""}{req.held_at ? ` (since ${formatDate(req.held_at)})` : ""}
        </div>
      )}

      {isPurchaseMember && req.compliance && (req.compliance.business_days_overdue > 0 || req.compliance.due_today) && (
        <div className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm ${req.compliance.business_days_overdue > 0 ? "bg-red-50 border-red-200 text-red-800" : "bg-amber-50 border-amber-200 text-amber-800"}`} data-testid="banner-compliance">
          <ClipboardList className="w-4 h-4 flex-shrink-0" />
          {req.compliance.business_days_overdue > 0
            ? `Status update overdue — ${req.compliance.business_days_overdue} business day${req.compliance.business_days_overdue > 1 ? "s" : ""} without an update (last: ${formatDate(req.compliance.last_activity_date)}).`
            : "Today's status update is still due."}
        </div>
      )}

      {/* Details */}
      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="items">Items ({req.items?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="workflow">Workflow</TabsTrigger>
          <TabsTrigger value="queries">Queries ({req.queries?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="attachments">Attachments ({req.attachments?.length ?? 0})</TabsTrigger>
          {(req.status === "in_progress" || req.status === "completed") && (
            <TabsTrigger value="updates">Status Updates</TabsTrigger>
          )}
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details" className="mt-4 space-y-4">
          <Card>
            <CardContent className="pt-5 grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div><p className="text-xs text-muted-foreground uppercase font-medium mb-1">Raised By</p><p className="font-medium flex items-center gap-1"><User className="w-3.5 h-3.5" />{req.raised_by_name}</p></div>
              <div><p className="text-xs text-muted-foreground uppercase font-medium mb-1">Site</p><p className="font-medium flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{req.site_name ?? "—"}</p></div>
              <div><p className="text-xs text-muted-foreground uppercase font-medium mb-1">Date</p><p className="font-medium flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{formatDate(req.requisition_date)}</p></div>
              <div><p className="text-xs text-muted-foreground uppercase font-medium mb-1">Project</p><p className="font-medium flex items-center gap-1"><Folder className="w-3.5 h-3.5" />{req.project_name ?? "—"}</p></div>
              <div><p className="text-xs text-muted-foreground uppercase font-medium mb-1">Total Estimate</p><p className="font-bold text-primary text-base">{formatINR(req.total_expected_cost)}</p></div>
              {req.purpose && <div className="col-span-full"><p className="text-xs text-muted-foreground uppercase font-medium mb-1">Purpose</p><p>{req.purpose}</p></div>}
              {req.notes && <div className="col-span-full"><p className="text-xs text-muted-foreground uppercase font-medium mb-1">Notes</p><p className="text-muted-foreground">{req.notes}</p></div>}
              {req.assigned_to_name && <div><p className="text-xs text-muted-foreground uppercase font-medium mb-1">Assigned To</p><p className="font-medium">{req.assigned_to_name}</p></div>}

              {/* Approval Notes (point 2) — replaces the old Directors section */}
              {(approvalNotes && approvalNotes.length > 0) || isPurchaseHead ? (
                <div className="col-span-full">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-muted-foreground uppercase font-medium">Approval Notes</p>
                    {isPurchaseHead && (
                      <Dialog open={approvalNoteOpen} onOpenChange={setApprovalNoteOpen}>
                        <DialogTrigger asChild>
                          <button type="button" className="text-xs text-primary hover:underline flex items-center gap-1" data-testid="button-add-approval-note">
                            <PlusCircle className="w-3 h-3" />Add note number
                          </button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader><DialogTitle>Add Approval Note Number</DialogTitle></DialogHeader>
                          <div className="space-y-3 mt-2">
                            <p className="text-xs text-muted-foreground">A requisition can have more than one — add each note number that applies.</p>
                            <Input placeholder="Approval note number" {...approvalNoteForm.register("note_number")} data-testid="input-approval-note-number" />
                            <Button className="w-full" disabled={addApprovalNoteMut.isPending} onClick={() => {
                              const note_number = approvalNoteForm.getValues("note_number");
                              if (!note_number) return;
                              addApprovalNoteMut.mutate({ id, data: { note_number } }, {
                                onSuccess: () => { invalidate(); queryClient.invalidateQueries(); approvalNoteForm.reset(); setApprovalNoteOpen(false); toast({ title: "Approval note added" }); },
                              });
                            }} data-testid="button-confirm-approval-note">Add</Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                  {!approvalNotes?.length ? (
                    <p className="text-sm text-muted-foreground">None added yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {approvalNotes.map(n => (
                        <Badge key={n.id} variant="outline" className="gap-1.5" data-testid={`badge-approval-note-${n.id}`}>
                          {n.note_number}
                          {isPurchaseHead && (
                            <button type="button" onClick={() => deleteApprovalNoteMut.mutate({ id, noteId: n.id }, { onSuccess: () => invalidate() })} className="text-muted-foreground hover:text-destructive">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Items Tab */}
        <TabsContent value="items" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Line Items</CardTitle>
                <p className="text-sm font-semibold">Total: <span className="text-primary">{formatINR(req.total_expected_cost)}</span></p>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>#</TableHead>
                    <TableHead>Item Name</TableHead>
                    <TableHead>Vessel/Equip.</TableHead>
                    <TableHead>Ref No.</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead className="text-right">Expected Cost (₹)</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Remark</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!req.items?.length ? (
                    <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No items added.</TableCell></TableRow>
                  ) : req.items.map((item, i) => (
                    <TableRow key={item.id} data-testid={`row-item-${item.id}`}>
                      <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                      <TableCell className="font-medium">{item.item_name}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{item.asset_name ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-xs font-mono">{item.reference_no ?? "—"}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-muted-foreground">{item.unit ?? "—"}</TableCell>
                      <TableCell className="text-right font-medium">{item.expected_cost != null ? formatINR(item.expected_cost) : "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-xs max-w-[150px] truncate">{item.description ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{item.remark ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Workflow Tab */}
        <TabsContent value="workflow" className="mt-4 space-y-3">
          {[
            { label: "Site User", name: req.raised_by_name, status: "submitted", time: req.submitted_at, note: null },
            { label: "Checker 1", name: req.checker1_name, status: req.checker1_status, time: req.checker1_reviewed_at, note: req.checker1_suggestion },
            { label: "Checker 2", name: req.checker2_name, status: req.checker2_status, time: req.checker2_reviewed_at, note: req.checker2_suggestion },
            { label: "Approver", name: req.approver_name, status: req.approver_status, time: req.approver_reviewed_at, note: req.approver_suggestion },
            { label: "Purchase Head", name: req.purchase_head_name, status: req.purchase_head_name ? "assigned" : null, time: req.assigned_at, note: null },
            { label: "Assigned To", name: req.assigned_to_name, status: req.assigned_to_name ? "in_progress" : null, time: req.assigned_at, note: null },
          ].map((step, i) => (
            <div key={i} className="flex gap-3 items-start">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${step.status === "approved" || step.status === "submitted" || step.status === "assigned" || step.status === "in_progress" ? "bg-emerald-100 text-emerald-700" : step.status === "rejected" ? "bg-red-100 text-red-700" : step.name ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground"}`}>
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{step.label}</span>
                  {step.name && <span className="text-sm text-muted-foreground">— {step.name}</span>}
                  {step.status && <Badge variant="outline" className="text-xs">{step.status}</Badge>}
                </div>
                {step.time && <p className="text-xs text-muted-foreground mt-0.5">{formatDateTime(step.time)}</p>}
                {step.note && <p className="text-xs bg-muted/50 rounded px-2 py-1 mt-1 italic">"{step.note}"</p>}
              </div>
            </div>
          ))}
        </TabsContent>

        {/* Queries Tab */}
        <TabsContent value="queries" className="mt-4 space-y-3">
          {canRaiseQuery && (
            <Dialog open={queryOpen} onOpenChange={setQueryOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2" data-testid="button-raise-query">
                  <MessageSquare className="w-4 h-4" />Raise Query
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Raise a Query</DialogTitle></DialogHeader>
                <div className="space-y-3 mt-2">
                  <Textarea placeholder="Describe your query..." rows={4} {...queryForm.register("message")} data-testid="input-query-message" />
                  <Button className="w-full" disabled={raiseQueryMut.isPending} onClick={() => {
                    const msg = queryForm.getValues("message");
                    if (!msg.trim()) return;
                    raiseQueryMut.mutate({ id, data: { raised_by_name: user.name, raised_by_role: user.role, message: msg } }, {
                      onSuccess: () => { invalidate(); setQueryOpen(false); queryForm.reset(); toast({ title: "Query raised" }); },
                    });
                  }} data-testid="button-submit-query">Submit Query</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}

          {!req.queries?.length ? (
            <div className="text-center py-10 text-muted-foreground text-sm border rounded-lg">No queries raised yet.</div>
          ) : req.queries.map((q) => (
            <Card key={q.id} className={q.is_resolved ? "opacity-70" : ""}>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{q.raised_by_name} <span className="text-xs text-muted-foreground">({q.raised_by_role})</span></p>
                    <p className="text-sm mt-1">{q.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">{formatDateTime(q.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {q.is_resolved ? (
                      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Resolved</Badge>
                    ) : (
                      <>
                        <Badge className="bg-amber-50 text-amber-700 border-amber-200">Open</Badge>
                        {(user.role === "checker" || user.role === "approver" || user.name === q.raised_by_name) && (
                          <Button size="sm" variant="ghost" onClick={() => resolveMut.mutate({ queryId: q.id, data: { resolved_by_name: user.name } }, { onSuccess: () => { invalidate(); toast({ title: "Query resolved" }); } })} data-testid={`button-resolve-${q.id}`}>
                            <CheckCircle className="w-4 h-4 text-emerald-600" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {q.replies && q.replies.length > 0 && (
                  <div className="ml-4 space-y-2 border-l-2 pl-3">
                    {q.replies.map((r) => (
                      <div key={r.id} className="text-sm">
                        <span className="font-medium">{r.replied_by_name}</span> <span className="text-xs text-muted-foreground">({r.replied_by_role})</span>
                        <p className="mt-0.5">{r.message}</p>
                        <p className="text-xs text-muted-foreground">{formatDateTime(r.created_at)}</p>
                        {r.attachments && r.attachments.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-1">
                            {r.attachments.map((a) => (
                              <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                                <Paperclip className="w-3 h-3" />{a.original_name}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {!q.is_resolved && (
                  <div className="flex gap-2">
                    {replyQueryId === q.id ? (
                      <div className="flex-1 space-y-1.5">
                        <div className="flex gap-2">
                          <Textarea rows={2} placeholder="Your reply..." {...replyForm.register("message")} className="flex-1" />
                          <div className="flex flex-col gap-1">
                            <Button size="sm" disabled={replyMut.isPending} onClick={() => {
                              const msg = replyForm.getValues("message");
                              if (!msg.trim()) return;
                              replyMut.mutate({ queryId: q.id, data: { replied_by_name: user.name, replied_by_role: user.role, message: msg } }, {
                                onSuccess: async (newReply) => {
                                  if (replyFile) {
                                    const fd = new FormData();
                                    fd.append("file", replyFile);
                                    try {
                                      await fetch(`/api/upload/${id}?context=query_reply&context_id=${newReply.id}&uploaded_by=${encodeURIComponent(user.name)}`, { method: "POST", body: fd });
                                    } catch {
                                      toast({ title: "Reply saved, but the attachment failed to upload", variant: "destructive" });
                                    }
                                  }
                                  invalidate(); setReplyQueryId(null); setReplyFile(null); replyForm.reset(); toast({ title: "Reply added" });
                                },
                              });
                            }} data-testid={`button-send-reply-${q.id}`}><Send className="w-4 h-4" /></Button>
                            <Button size="sm" variant="ghost" onClick={() => { setReplyQueryId(null); setReplyFile(null); }}>✕</Button>
                          </div>
                        </div>
                        <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer" data-testid={`label-reply-attach-${q.id}`}>
                          <Paperclip className="w-3.5 h-3.5" />
                          {replyFile ? replyFile.name : "Attach photo / PDF (optional)"}
                          <input
                            type="file"
                            className="hidden"
                            accept=".jpg,.jpeg,.png,.gif,.pdf,.xlsx,.xls,.csv,.doc,.docx"
                            onChange={(e) => setReplyFile(e.target.files?.[0] ?? null)}
                            data-testid={`input-reply-attachment-${q.id}`}
                          />
                        </label>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setReplyQueryId(q.id)} data-testid={`button-reply-${q.id}`}>Reply</Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Attachments Tab */}
        <TabsContent value="attachments" className="mt-4 space-y-3">
          <div className="flex items-center gap-2">
            <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.gif,.pdf,.xlsx,.xls,.csv,.doc,.docx" className="hidden" onChange={handleUpload} />
            <Button variant="outline" size="sm" className="gap-2" onClick={() => fileInputRef.current?.click()} data-testid="button-upload">
              <Upload className="w-4 h-4" />Upload File
            </Button>
            <p className="text-xs text-muted-foreground">Images, PDF, Excel, Word — max 20MB</p>
          </div>
          {!req.attachments?.length ? (
            <div className="text-center py-10 text-muted-foreground text-sm border rounded-lg">No attachments yet.</div>
          ) : (
            <div className="space-y-2">
              {req.attachments.map((att) => (
                <div key={att.id} className="flex items-center justify-between p-3 rounded-lg border bg-card" data-testid={`att-${att.id}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <Paperclip className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium hover:underline text-primary truncate block">{att.original_name}</a>
                      <p className="text-xs text-muted-foreground">{att.uploaded_by_name} · {formatDateTime(att.uploaded_at)} · {att.size_bytes ? `${Math.round(att.size_bytes / 1024)} KB` : ""}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Status Updates Tab */}
        {(req.status === "in_progress" || req.status === "completed") && (
          <TabsContent value="updates" className="mt-4 space-y-3">
            {isPurchaseMember && (
              <Dialog open={statusUpdateOpen} onOpenChange={setStatusUpdateOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-2" data-testid="button-add-update">
                    <ClipboardList className="w-4 h-4" />Add Status Update
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Daily Status Update</DialogTitle></DialogHeader>
                  <div className="space-y-3 mt-2">
                    <div>
                      <label className="text-sm font-medium">Stage</label>
                      <Select defaultValue="prepared" onValueChange={(v) => statusForm.setValue("stage", v)}>
                        <SelectTrigger data-testid="select-stage"><SelectValue /></SelectTrigger>
                        <SelectContent>{STAGE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Notes</label>
                      <Textarea placeholder="What was done today..." rows={3} {...statusForm.register("notes")} data-testid="input-update-notes" />
                    </div>
                    <p className="text-xs text-muted-foreground">Recorded against today's date automatically — this can't be backdated (point 14).</p>
                    <Button className="w-full" disabled={statusUpdateMut.isPending} onClick={() => {
                      const vals = statusForm.getValues();
                      statusUpdateMut.mutate({ id, data: { updated_by_name: user.name, stage: vals.stage, notes: vals.notes } }, {
                        onSuccess: () => { invalidate(); setStatusUpdateOpen(false); statusForm.reset({ stage: "prepared", notes: "" }); toast({ title: "Status updated" }); },
                      });
                    }} data-testid="button-submit-update">Submit Update</Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}

            {!req.status_updates?.length ? (
              <div className="text-center py-10 text-muted-foreground text-sm border rounded-lg">No status updates yet.</div>
            ) : (
              <div className="space-y-2">
                {req.status_updates.map((u) => (
                  <div key={u.id} className="flex gap-3 items-start p-3 rounded-lg border">
                    <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{STAGE_OPTIONS.find(o => o.value === u.stage)?.label ?? u.stage}</p>
                      <p className="text-xs text-muted-foreground">
                        {u.updated_by_name} · {formatStatusUpdateTime(u.created_at)}
                      </p>
                      {u.notes && <p className="text-sm text-muted-foreground mt-1">{u.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
