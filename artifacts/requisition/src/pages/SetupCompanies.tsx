import { useState } from "react";
import {
  useListSites, useCreateSite, getListSitesQueryKey,
  useUpdateSite,
  useListProjects, useCreateProject, useUpdateProject, getListProjectsQueryKey,
  useListHolidays, useCreateHoliday, useUpdateHoliday, useDeleteHoliday, getListHolidaysQueryKey,
  useListAssets, useCreateAsset, useUpdateAsset, useDeleteAsset, getListAssetsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlusCircle, MapPin, Folder, CalendarDays, Trash2, Ship, Pencil } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useRole } from "@/context/RoleContext";

type MasterEdit = { type: "site" | "project" | "asset" | "holiday"; id: number };

export default function SetupCompanies() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useRole();
  const canEditMasterData = user.role === "purchase_head";

  const { data: sites, isLoading: siteLoading } = useListSites();
  const { data: projects, isLoading: projLoading } = useListProjects();
  const { data: holidays, isLoading: holidayLoading } = useListHolidays();
  const { data: assets, isLoading: assetLoading } = useListAssets();

  const createSite = useCreateSite();
  const updateSite = useUpdateSite();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const createHoliday = useCreateHoliday();
  const updateHoliday = useUpdateHoliday();
  const deleteHoliday = useDeleteHoliday();
  const createAsset = useCreateAsset();
  const updateAsset = useUpdateAsset();
  const deleteAsset = useDeleteAsset();

  const [siteForm, setSiteForm] = useState({ name: "", location: "" });
  const [projectForm, setProjectForm] = useState({ name: "", code: "" });
  const [holidayForm, setHolidayForm] = useState({ date: "", name: "" });
  const [assetForm, setAssetForm] = useState({ name: "", type: "vessel", project_id: "" });
  const [openDialog, setOpenDialog] = useState<"site" | "project" | "holiday" | "asset" | null>(null);
  const [editing, setEditing] = useState<MasterEdit | null>(null);
  const sortedHolidays = [...(holidays ?? [])].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Sites, Projects &amp; Assets</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Master data setup for the procurement system</p>
      </div>

      <Tabs defaultValue="sites">
        <TabsList>
          <TabsTrigger value="sites"><MapPin className="w-4 h-4 mr-1.5" />Sites</TabsTrigger>
          <TabsTrigger value="projects"><Folder className="w-4 h-4 mr-1.5" />Projects</TabsTrigger>
          <TabsTrigger value="assets"><Ship className="w-4 h-4 mr-1.5" />Vessels &amp; Equipment</TabsTrigger>
          <TabsTrigger value="holidays"><CalendarDays className="w-4 h-4 mr-1.5" />Holidays</TabsTrigger>
        </TabsList>

        {/* Sites */}
        <TabsContent value="sites" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Sites</CardTitle>
                <Dialog open={openDialog === "site"} onOpenChange={(v) => { setOpenDialog(v ? "site" : null); if (!v) setEditing(null); }}>
                  {canEditMasterData && <DialogTrigger asChild>
                    <Button size="sm" className="gap-2" onClick={() => { setEditing(null); setSiteForm({ name: "", location: "" }); }} data-testid="button-add-site"><PlusCircle className="w-4 h-4" />Add Site</Button>
                  </DialogTrigger>}
                  <DialogContent>
                    <DialogHeader><DialogTitle>{editing?.type === "site" ? "Edit Site" : "Add Site"}</DialogTitle></DialogHeader>
                    <div className="space-y-3 mt-2">
                      <Input placeholder="Site Name *" value={siteForm.name} onChange={e => setSiteForm(f => ({ ...f, name: e.target.value }))} data-testid="input-site-name" />
                      <Input placeholder="Location" value={siteForm.location} onChange={e => setSiteForm(f => ({ ...f, location: e.target.value }))} data-testid="input-site-location" />
                      <Button className="w-full" disabled={createSite.isPending || updateSite.isPending} onClick={() => {
                        if (!siteForm.name) return;
                        const data = { name: siteForm.name, location: siteForm.location };
                        const onSuccess = () => { queryClient.invalidateQueries({ queryKey: getListSitesQueryKey() }); setOpenDialog(null); setEditing(null); setSiteForm({ name: "", location: "" }); toast({ title: editing?.type === "site" ? "Site updated" : "Site added" }); };
                        if (editing?.type === "site") updateSite.mutate({ id: editing.id, data }, { onSuccess });
                        else createSite.mutate({ data: { name: data.name, location: data.location || undefined } }, { onSuccess });
                      }} data-testid="button-confirm-site">{editing?.type === "site" ? "Save Changes" : "Add"}</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Location</TableHead>{canEditMasterData && <TableHead className="w-12">Actions</TableHead>}</TableRow></TableHeader>
                <TableBody>
                  {siteLoading ? <TableRow><TableCell colSpan={canEditMasterData ? 3 : 2}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                    : sites?.map(s => <TableRow key={s.id}><TableCell className="font-medium">{s.name}</TableCell><TableCell className="text-muted-foreground text-sm">{s.location ?? "—"}</TableCell>{canEditMasterData && <TableCell><Button variant="ghost" size="icon" title="Edit site" aria-label={`Edit ${s.name}`} onClick={() => { setSiteForm({ name: s.name, location: s.location ?? "" }); setEditing({ type: "site", id: s.id }); setOpenDialog("site"); }}><Pencil className="w-4 h-4" /></Button></TableCell>}</TableRow>)}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Projects */}
        <TabsContent value="projects" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Projects</CardTitle>
                <Dialog open={openDialog === "project"} onOpenChange={(v) => { setOpenDialog(v ? "project" : null); if (!v) setEditing(null); }}>
                  {canEditMasterData && <DialogTrigger asChild>
                    <Button size="sm" className="gap-2" onClick={() => { setEditing(null); setProjectForm({ name: "", code: "" }); }} data-testid="button-add-project"><PlusCircle className="w-4 h-4" />Add Project</Button>
                  </DialogTrigger>}
                  <DialogContent>
                    <DialogHeader><DialogTitle>{editing?.type === "project" ? "Edit Project" : "Add Project"}</DialogTitle></DialogHeader>
                    <div className="space-y-3 mt-2">
                      <Input placeholder="Project Name *" value={projectForm.name} onChange={e => setProjectForm(f => ({ ...f, name: e.target.value }))} data-testid="input-project-name" />
                      <Input placeholder="Project Code" value={projectForm.code} onChange={e => setProjectForm(f => ({ ...f, code: e.target.value }))} data-testid="input-project-code" />
                      <Button className="w-full" disabled={createProject.isPending || updateProject.isPending} onClick={() => {
                        if (!projectForm.name) return;
                        const data = { name: projectForm.name, code: projectForm.code };
                        const onSuccess = () => { queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() }); setOpenDialog(null); setEditing(null); setProjectForm({ name: "", code: "" }); toast({ title: editing?.type === "project" ? "Project updated" : "Project added" }); };
                        if (editing?.type === "project") updateProject.mutate({ id: editing.id, data }, { onSuccess });
                        else createProject.mutate({ data: { name: data.name, code: data.code || undefined } }, { onSuccess });
                      }} data-testid="button-confirm-project">{editing?.type === "project" ? "Save Changes" : "Add"}</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                To give someone access to a project's requisitions, assign it to them under Setup → Users.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Code</TableHead>{canEditMasterData && <TableHead className="w-12">Actions</TableHead>}</TableRow></TableHeader>
                <TableBody>
                  {projLoading ? <TableRow><TableCell colSpan={canEditMasterData ? 3 : 2}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                    : projects?.map(p => <TableRow key={p.id}><TableCell className="font-medium">{p.name}</TableCell><TableCell className="font-mono text-sm text-muted-foreground">{p.code ?? "—"}</TableCell>{canEditMasterData && <TableCell><Button variant="ghost" size="icon" title="Edit project" aria-label={`Edit ${p.name}`} onClick={() => { setProjectForm({ name: p.name, code: p.code ?? "" }); setEditing({ type: "project", id: p.id }); setOpenDialog("project"); }}><Pencil className="w-4 h-4" /></Button></TableCell>}</TableRow>)}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Assets: vessels / equipment / locations */}
        <TabsContent value="assets" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm">Vessels, Equipment &amp; Locations</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">These show up as a dropdown on every requisition line item.</p>
                </div>
                <Dialog open={openDialog === "asset"} onOpenChange={(v) => { setOpenDialog(v ? "asset" : null); if (!v) setEditing(null); }}>
                  {canEditMasterData && <DialogTrigger asChild>
                    <Button size="sm" className="gap-2" onClick={() => { setEditing(null); setAssetForm({ name: "", type: "vessel", project_id: "all" }); }} data-testid="button-add-asset"><PlusCircle className="w-4 h-4" />Add</Button>
                  </DialogTrigger>}
                  <DialogContent>
                    <DialogHeader><DialogTitle>{editing?.type === "asset" ? "Edit Vessel / Equipment / Location" : "Add Vessel / Equipment / Location"}</DialogTitle></DialogHeader>
                    <div className="space-y-3 mt-2">
                      <Input placeholder="Name *" value={assetForm.name} onChange={e => setAssetForm(f => ({ ...f, name: e.target.value }))} data-testid="input-asset-name" />
                      <Select value={assetForm.type} onValueChange={v => setAssetForm(f => ({ ...f, type: v }))}>
                        <SelectTrigger data-testid="select-asset-type"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="vessel">Vessel</SelectItem>
                          <SelectItem value="equipment">Equipment</SelectItem>
                          <SelectItem value="location">Location</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={assetForm.project_id} onValueChange={v => setAssetForm(f => ({ ...f, project_id: v }))}>
                        <SelectTrigger data-testid="select-asset-project"><SelectValue placeholder="Restrict to a project (optional)" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All projects</SelectItem>
                          {projects?.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">Leave the project blank to make it available on every project.</p>
                      <Button className="w-full" disabled={createAsset.isPending || updateAsset.isPending} onClick={() => {
                        if (!assetForm.name) return;
                        const data = { name: assetForm.name, type: assetForm.type, project_id: assetForm.project_id === "all" ? null : Number(assetForm.project_id) };
                        const onSuccess = () => { queryClient.invalidateQueries({ queryKey: getListAssetsQueryKey() }); setOpenDialog(null); setEditing(null); setAssetForm({ name: "", type: "vessel", project_id: "all" }); toast({ title: editing?.type === "asset" ? "Updated" : "Added" }); };
                        if (editing?.type === "asset") updateAsset.mutate({ id: editing.id, data }, { onSuccess });
                        else createAsset.mutate({ data }, { onSuccess });
                      }} data-testid="button-confirm-asset">{editing?.type === "asset" ? "Save Changes" : "Add"}</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Project</TableHead>{canEditMasterData && <TableHead className="w-20">Actions</TableHead>}</TableRow></TableHeader>
                <TableBody>
                  {assetLoading ? <TableRow><TableCell colSpan={canEditMasterData ? 4 : 3}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                    : !assets?.length ? <TableRow><TableCell colSpan={canEditMasterData ? 4 : 3} className="text-center text-muted-foreground py-8">Nothing added yet.</TableCell></TableRow>
                    : assets.map(a => (
                      <TableRow key={a.id} data-testid={`row-asset-${a.id}`}>
                        <TableCell className="font-medium">{a.name}</TableCell>
                        <TableCell>{a.type ? <Badge variant="outline" className="text-xs capitalize">{a.type}</Badge> : "—"}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{projects?.find(p => p.id === a.project_id)?.name ?? "All projects"}</TableCell>
                        {canEditMasterData && <TableCell className="whitespace-nowrap">
                          <Button variant="ghost" size="icon" title="Edit item" aria-label={`Edit ${a.name}`} onClick={() => { setAssetForm({ name: a.name, type: a.type ?? "vessel", project_id: a.project_id ? String(a.project_id) : "all" }); setEditing({ type: "asset", id: a.id }); setOpenDialog("asset"); }} data-testid={`button-edit-asset-${a.id}`}><Pencil className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" title="Delete item" aria-label={`Delete ${a.name}`} className="text-muted-foreground hover:text-destructive" onClick={() => deleteAsset.mutate({ id: a.id }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListAssetsQueryKey() }); toast({ title: "Removed" }); } })} data-testid={`button-delete-asset-${a.id}`}><Trash2 className="w-4 h-4" /></Button>
                        </TableCell>}
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Holidays */}
        <TabsContent value="holidays" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm">Company Holidays</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">Purchase team daily status updates skip weekends and these dates automatically.</p>
                </div>
                <Dialog open={openDialog === "holiday"} onOpenChange={(v) => { setOpenDialog(v ? "holiday" : null); if (!v) setEditing(null); }}>
                  {canEditMasterData && <DialogTrigger asChild>
                    <Button size="sm" className="gap-2" onClick={() => { setEditing(null); setHolidayForm({ date: "", name: "" }); }} data-testid="button-add-holiday"><PlusCircle className="w-4 h-4" />Add Holiday</Button>
                  </DialogTrigger>}
                  <DialogContent>
                    <DialogHeader><DialogTitle>{editing?.type === "holiday" ? "Edit Holiday" : "Add Holiday"}</DialogTitle></DialogHeader>
                    <div className="space-y-3 mt-2">
                      <Input type="date" value={holidayForm.date} onChange={e => setHolidayForm(f => ({ ...f, date: e.target.value }))} data-testid="input-holiday-date" />
                      <Input placeholder="Holiday Name *" value={holidayForm.name} onChange={e => setHolidayForm(f => ({ ...f, name: e.target.value }))} data-testid="input-holiday-name" />
                      <Button className="w-full" disabled={createHoliday.isPending || updateHoliday.isPending} onClick={() => {
                        if (!holidayForm.date || !holidayForm.name) return;
                        const data = { date: holidayForm.date, name: holidayForm.name };
                        const onSuccess = () => { queryClient.invalidateQueries({ queryKey: getListHolidaysQueryKey() }); setOpenDialog(null); setEditing(null); setHolidayForm({ date: "", name: "" }); toast({ title: editing?.type === "holiday" ? "Holiday updated" : "Holiday added" }); };
                        const onError = () => toast({ title: "Error", description: "A holiday may already be set for that date.", variant: "destructive" });
                        if (editing?.type === "holiday") updateHoliday.mutate({ id: editing.id, data }, { onSuccess, onError });
                        else createHoliday.mutate({ data }, { onSuccess, onError });
                      }} data-testid="button-confirm-holiday">{editing?.type === "holiday" ? "Save Changes" : "Add"}</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Name</TableHead>{canEditMasterData && <TableHead className="w-20">Actions</TableHead>}</TableRow></TableHeader>
                <TableBody>
                  {holidayLoading ? <TableRow><TableCell colSpan={canEditMasterData ? 3 : 2}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                    : !sortedHolidays.length ? <TableRow><TableCell colSpan={canEditMasterData ? 3 : 2} className="text-center text-muted-foreground py-8">No holidays added yet.</TableCell></TableRow>
                    : sortedHolidays.map(h => (
                      <TableRow key={h.id} data-testid={`row-holiday-${h.id}`}>
                        <TableCell className="font-mono text-sm">{h.date}</TableCell>
                        <TableCell className="font-medium">{h.name}</TableCell>
                        {canEditMasterData && <TableCell className="whitespace-nowrap">
                          <Button variant="ghost" size="icon" title="Edit holiday" aria-label={`Edit ${h.name}`} onClick={() => { setHolidayForm({ date: h.date, name: h.name }); setEditing({ type: "holiday", id: h.id }); setOpenDialog("holiday"); }} data-testid={`button-edit-holiday-${h.id}`}><Pencil className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" title="Delete holiday" aria-label={`Delete ${h.name}`} className="text-muted-foreground hover:text-destructive" onClick={() => deleteHoliday.mutate({ id: h.id }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListHolidaysQueryKey() }); toast({ title: "Holiday removed" }); } })} data-testid={`button-delete-holiday-${h.id}`}><Trash2 className="w-4 h-4" /></Button>
                        </TableCell>}
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
