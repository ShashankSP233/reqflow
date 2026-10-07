import { useEffect,useState } from "react";
import { useLocation } from "wouter";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useCreateRequisition,
  useListProjects,
  useListSites,
  useListItemNames,
  useListAssets,
  getListRequisitionsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Trash2, IndianRupee, Paperclip, X, FileText } from "lucide-react";
import { Link } from "wouter";
import { useRole } from "@/context/RoleContext";
import { formatINR } from "@/lib/format";


const DRAFT_KEY = "reqflow:create-requisition-draft";

const itemSchema = z.object({
  item_name: z.string().min(1, "Item name is required"),
  quantity: z.coerce.number().min(0.001, "Qty must be > 0"),
  unit: z.string().optional(),
  reference_no: z.string().optional(),
  expected_cost: z.coerce.number().optional(),
  description: z.string().optional(),
  remark: z.string().optional(),
  asset_id: z.coerce.number().optional(),
  asset_name: z.string().optional(),
});

const formSchema = z.object({
  project_id: z.coerce.number({ required_error: "Project is required", invalid_type_error: "Project is required" }).min(1, "Project is required"),
  site_id: z.coerce.number({ required_error: "Site is required", invalid_type_error: "Site is required" }).min(1, "Site is required"),
  requisition_date: z.string().min(1, "Date is required"),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  purpose: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1, "Add at least one item"),
});

type FormValues = z.infer<typeof formSchema>;

export default function CreateRequisition() {
  const [, setLocation] = useLocation();
  const { user } = useRole();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createRequisition = useCreateRequisition();
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const { data: projects } = useListProjects();
  const { data: sites } = useListSites();
  const { data: itemNameSuggestions } = useListItemNames();

  // Today only (point 3) — this can't be backdated or postdated, so there's
  // nothing to pick; the date is fixed the moment the page loads.
  const today = new Date().toISOString().split("T")[0];

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      requisition_date: today,
      priority: "medium",
      items: [{ item_name: "", quantity: 1, unit: "", reference_no: "", expected_cost: undefined, description: "", remark: "", asset_id: undefined, asset_name: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });
  
  useEffect(() => {
    const savedDraft = localStorage.getItem(DRAFT_KEY);

    if (!savedDraft) return;

    try {
      const draft = JSON.parse(savedDraft);
      form.reset(draft);
    } catch (error) {
      console.error("Failed to restore requisition draft:", error);
      localStorage.removeItem(DRAFT_KEY);
    }
  }, [form]);
  
  const selectedProjectId = form.watch("project_id");
  const { data: assets } = useListAssets(selectedProjectId ? { project_id: selectedProjectId } : undefined);

  const watchItems = form.watch("items");
  const totalEstimate = watchItems.reduce((sum, item) => sum + (Number(item.expected_cost) || 0) * (Number(item.quantity) || 1), 0);

  function saveDraft() {
    const values = form.getValues();

    localStorage.setItem(DRAFT_KEY, JSON.stringify(values));

    toast({
      title: "Draft saved",
      description: "Your requisition draft has been saved.",
    });
  }
  function clearDraft() {
    localStorage.removeItem(DRAFT_KEY);

    toast({
      title: "Draft cleared",
      description: "The saved requisition draft has been removed.",
    });
  }
  function onSubmit(values: FormValues) {
    createRequisition.mutate(
      {
        data: {
          project_id: values.project_id,
          site_id: values.site_id,
          requisition_date: values.requisition_date,
          priority: values.priority,
          purpose: values.purpose,
          notes: values.notes,
          items: values.items.map((item, i) => ({
            item_name: item.item_name,
            quantity: item.quantity,
            unit: item.unit,
            reference_no: item.reference_no,
            expected_cost: item.expected_cost ?? null,
            description: item.description,
            remark: item.remark,
            asset_id: item.asset_id ?? null,
            asset_name: item.asset_name || null,
            sort_order: i,
          })),
        },
      },
      {
        onSuccess: async (newReq) => {
          queryClient.invalidateQueries({ queryKey: getListRequisitionsQueryKey() });

          let uploadFailures = 0;
          if (pendingFiles.length > 0) {
            const results = await Promise.allSettled(
              pendingFiles.map((file) => {
                const fd = new FormData();
                fd.append("file", file);
                return fetch(
                  `/api/upload/${newReq.id}?context=requisition&uploaded_by=${encodeURIComponent(user.name)}`,
                  { method: "POST", body: fd }
                ).then((res) => { if (!res.ok) throw new Error("upload failed"); });
              })
            );
            uploadFailures = results.filter((r) => r.status === "rejected").length;
          }

          const itemCount = values.items.length;
          const attachmentNote =
            pendingFiles.length === 0
              ? ""
              : uploadFailures > 0
              ? ` ${pendingFiles.length - uploadFailures}/${pendingFiles.length} attachment(s) uploaded (${uploadFailures} failed — you can retry from the detail page).`
              : ` ${pendingFiles.length} attachment(s) uploaded.`;
         
          localStorage.removeItem(DRAFT_KEY);

          toast({
            title: "Requisition created",
            description: `${newReq.ref_number} saved as draft with ${itemCount} item${itemCount > 1 ? "s" : ""}.${attachmentNote}`,
          });
          setLocation(`/requisitions/${newReq.id}`);
        },
        onError: (err: unknown) => toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to create requisition.", variant: "destructive" }),
      }
    );
  }

  function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length > 0) setPendingFiles((prev) => [...prev, ...selected]);
    e.target.value = "";
  }

  function removeFile(index: number) {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <datalist id="item-name-suggestions">
        {itemNameSuggestions?.map((name) => <option key={name} value={name} />)}
      </datalist>

      <div className="flex items-center gap-3">
        <Link href="/requisitions" className="p-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Requisition</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Create a purchase requisition with line items</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Header Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Requisition Header</CardTitle>
              <CardDescription>Common details for this requisition</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="input-raised-by" className="text-sm font-medium leading-none">Raised By</label>
                <Input id="input-raised-by" value={user.name} readOnly aria-readonly="true" className="bg-muted/40 cursor-not-allowed" data-testid="input-raised-by" />
              </div>

              <FormField control={form.control} name="site_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Site <span className="text-destructive">*</span></FormLabel>
                  <Select
                    value={field.value ? String(field.value) : ""}
                    onValueChange={(value) => field.onChange(value ? Number(value) : undefined)}
                    disabled={!sites?.length}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-site">
                        <SelectValue placeholder={!sites ? "Loading sites..." : sites.length ? "Select site" : "No sites available"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {sites?.map((site) => (
                        <SelectItem key={site.id} value={String(site.id)}>{site.location || site.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="requisition_date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Date of Requisition <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Input type="date" {...field} readOnly className="bg-muted/40 cursor-not-allowed" data-testid="input-req-date" />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">Always today — requisitions can't be backdated or postdated.</p>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="priority" render={({ field }) => (
                <FormItem>
                  <FormLabel>Priority</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger data-testid="select-priority">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="project_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Project <span className="text-destructive">*</span></FormLabel>
                  <Select value={field.value ? String(field.value) : ""} onValueChange={(v) => field.onChange(v ? Number(v) : undefined)}>
                    <FormControl>
                      <SelectTrigger data-testid="select-project">
                        <SelectValue placeholder="Select project" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {projects?.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}{p.code ? ` (${p.code})` : ""}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="purpose" render={({ field }) => (
                <FormItem className="col-span-full">
                  <FormLabel>Purpose / Description</FormLabel>
                  <FormControl><Textarea placeholder="Briefly describe the purpose of this requisition..." rows={2} {...field} data-testid="input-purpose" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem className="col-span-full">
                  <FormLabel>Additional Notes</FormLabel>
                  <FormControl><Textarea placeholder="Any additional notes or instructions..." rows={2} {...field} data-testid="input-notes" /></FormControl>
                </FormItem>
              )} />
            </CardContent>
          </Card>

          {/* Line Items */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Line Items</CardTitle>
                  <CardDescription>Add all items required under this requisition</CardDescription>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Total Estimate</p>
                  <p className="text-lg font-bold text-primary">{formatINR(totalEstimate)}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {fields.map((field, index) => (
                <div key={field.id} className="border rounded-lg p-4 bg-muted/20 space-y-3 relative">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold text-muted-foreground">Item #{index + 1}</p>
                    {fields.length > 1 && (
                      <button type="button" onClick={() => remove(index)} className="text-destructive hover:text-destructive/80 transition-colors" data-testid={`button-remove-item-${index}`}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <FormField control={form.control} name={`items.${index}.item_name`} render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Item Name <span className="text-destructive">*</span></FormLabel>
                        <FormControl><Input placeholder="e.g. TMT Steel Bar 16mm" list="item-name-suggestions" autoComplete="off" {...field} data-testid={`input-item-name-${index}`} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name={`items.${index}.reference_no`} render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reference No.</FormLabel>
                        <FormControl><Input placeholder="e.g. STL-001" {...field} data-testid={`input-ref-no-${index}`} /></FormControl>
                      </FormItem>
                    )} />

                    <FormField control={form.control} name={`items.${index}.quantity`} render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantity <span className="text-destructive">*</span></FormLabel>
                        <FormControl><Input type="number" step="0.001" min="0" {...field} data-testid={`input-qty-${index}`} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name={`items.${index}.unit`} render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unit</FormLabel>
                        <FormControl><Input placeholder="e.g. kg, nos, MT" {...field} data-testid={`input-unit-${index}`} /></FormControl>
                      </FormItem>
                    )} />

                    <FormField control={form.control} name={`items.${index}.asset_id`} render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vessel / Equipment / Location</FormLabel>
                        <Select
                          value={field.value ? String(field.value) : ""}
                          onValueChange={(v) => {
                            const a = assets?.find(a => String(a.id) === v);
                            field.onChange(v ? Number(v) : undefined);
                            form.setValue(`items.${index}.asset_name`, a?.name ?? "");
                          }}
                        >
                          <FormControl>
                            <SelectTrigger data-testid={`select-asset-${index}`}>
                              <SelectValue placeholder={selectedProjectId ? "Select (optional)" : "Pick a project first"} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="max-h-60">
                            {assets?.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />

                    <FormField control={form.control} name={`items.${index}.expected_cost`} render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expected Cost per Unit (₹)</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <IndianRupee className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input type="number" step="0.01" min="0" className="pl-8" placeholder="Cost of one unit" {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)} data-testid={`input-cost-${index}`} />
                          </div>
                        </FormControl>
                        <p className="text-xs text-muted-foreground">Enter the expected cost of one unit. Total is calculated automatically.</p>
                      </FormItem>
                    )} />

                    <FormField control={form.control} name={`items.${index}.description`} render={({ field }) => (
                      <FormItem className="col-span-full md:col-span-2">
                        <FormLabel>Description</FormLabel>
                        <FormControl><Input placeholder="Specification, grade, standards..." {...field} data-testid={`input-desc-${index}`} /></FormControl>
                      </FormItem>
                    )} />

                    <FormField control={form.control} name={`items.${index}.remark`} render={({ field }) => (
                      <FormItem className="col-span-full md:col-span-1">
                        <FormLabel>Remark</FormLabel>
                        <FormControl><Input placeholder="Optional remark" {...field} data-testid={`input-remark-${index}`} /></FormControl>
                      </FormItem>
                    )} />
                  </div>
                </div>
              ))}

              {form.formState.errors.items?.root && (
                <p className="text-sm text-destructive">{form.formState.errors.items.root.message}</p>
              )}

              <Button
                type="button"
                variant="outline"
                onClick={() => append({ item_name: "", quantity: 1, unit: "", reference_no: "", expected_cost: undefined, description: "", remark: "", asset_id: undefined, asset_name: "" })}
                className="w-full border-dashed gap-2"
                data-testid="button-add-item"
              >
                <Plus className="w-4 h-4" />
                Add Another Item
              </Button>
            </CardContent>
          </Card>

          {/* Attachments */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Attachments</CardTitle>
              <CardDescription>Photos, PDF, Excel or Word files — quotes, specs, references (optional)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingFiles.length > 0 && (
                <div className="space-y-2">
                  {pendingFiles.map((file, index) => (
                    <div key={`${file.name}-${index}`} className="flex items-center justify-between gap-2 border rounded-md px-3 py-2 bg-muted/20">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="text-sm truncate">{file.name}</span>
                        <span className="text-xs text-muted-foreground shrink-0">{formatFileSize(file.size)}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="text-destructive hover:text-destructive/80 transition-colors shrink-0"
                        data-testid={`button-remove-file-${index}`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <label
                className="flex items-center justify-center gap-2 w-full border border-dashed rounded-md py-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer transition-colors"
                data-testid="label-attach-files"
              >
                <Paperclip className="w-4 h-4" />
                Attach photos, PDF, or Excel/Word files
                <input
                  type="file"
                  multiple
                  className="hidden"
                  accept=".jpg,.jpeg,.png,.gif,.pdf,.xlsx,.xls,.csv,.doc,.docx"
                  onChange={handleFilesSelected}
                  data-testid="input-attach-files"
                />
              </label>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between pt-2">
            <Link href="/requisitions" className="text-sm text-muted-foreground hover:text-foreground">Cancel</Link>
            <Button
              type="button"
              variant="outline"
              onClick={saveDraft}
              data-testid="button-save-draft"
            >
              Save as Draft
            </Button>
            <Button type="submit" disabled={createRequisition.isPending} className="min-w-[160px]" data-testid="button-submit-requisition">
              {createRequisition.isPending ? "Creating..." : "Create Requisition"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
