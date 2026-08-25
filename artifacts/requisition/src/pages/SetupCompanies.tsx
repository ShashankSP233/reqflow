import { useState } from "react";
import {
  useListSites, useCreateSite, getListSitesQueryKey,
  useListProjects, useCreateProject, getListProjectsQueryKey,
  useListHolidays, useCreateHoliday, useDeleteHoliday, getListHolidaysQueryKey,
  useListAssets, useCreateAsset, useDeleteAsset, getListAssetsQueryKey,
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
import { PlusCircle, MapPin, Folder, CalendarDays, Trash2, Ship } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function SetupCompanies() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: sites, isLoading: siteLoading } = useListSites();
  const { data: projects, isLoading: projLoading } = useListProjects();
  const { data: holidays, isLoading: holidayLoading } = useListHolidays();
  const { data: assets, isLoading: assetLoading } = useListAssets();

  const createSite = useCreateSite();
  const createProject = useCreateProject();
  const createHoliday = useCreateHoliday();
  const deleteHoliday = useDeleteHoliday();
  const createAsset = useCreateAsset();
  const deleteAsset = useDeleteAsset();

  const [siteForm, setSiteForm] = useState({ name: "", location: "" });
  const [projectForm, setProjectForm] = useState({ name: "", code: "" });
  const [holidayForm, setHolidayForm] = useState({ date: "", name: "" });
  const [assetForm, setAssetForm] = useState({ name: "", type: "vessel", project_id: "" });
  const [openDialog, setOpenDialog] = useState<"site" | "project" | "holiday" | "asset" | null>(null);
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
                <Dialog open={openDialog === "site"} onOpenChange={(v) => setOpenDialog(v ? "site" : null)}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-2" data-testid="button-add-site"><PlusCircle className="w-4 h-4" />Add Site</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Add Site</DialogTitle></DialogHeader>
                    <div className="space-y-3 mt-2">
                      <Input placeholder="Site Name *" value={siteForm.name} onChange={e => setSiteForm(f => ({ ...f, name: e.target.value }))} data-testid="input-site-name" />
                      <Input placeholder="Location" value={siteForm.location} onChange={e => setSiteForm(f => ({ ...f, location: e.target.value }))} data-testid="input-site-location" />
                      <Button className="w-full" onClick={() => {
                        if (!siteForm.name) return;
                        createSite.mutate({ data: { name: siteForm.name, location: siteForm.location || undefined } }, {
                          onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListSitesQueryKey() }); setOpenDialog(null); setSiteForm({ name: "", location: "" }); toast({ title: "Site added" }); },
                        });
                      }} data-testid="button-confirm-site">Add</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Location</TableHead></TableRow></TableHeader>
                <TableBody>
                  {siteLoading ? <TableRow><TableCell colSpan={2}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                    : sites?.map(s => <TableRow key={s.id}><TableCell className="font-medium">{s.name}</TableCell><TableCell className="text-muted-foreground text-sm">{s.location ?? "—"}</TableCell></TableRow>)}
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
                <Dialog open={openDialog === "project"} onOpenChange={(v) => setOpenDialog(v ? "project" : null)}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-2" data-testid="button-add-project"><PlusCircle className="w-4 h-4" />Add Project</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Add Project</DialogTitle></DialogHeader>
                    <div className="space-y-3 mt-2">
                      <Input placeholder="Project Name *" value={projectForm.name} onChange={e => setProjectForm(f => ({ ...f, name: e.target.value }))} data-testid="input-project-name" />
                      <Input placeholder="Project Code" value={projectForm.code} onChange={e => setProjectForm(f => ({ ...f, code: e.target.value }))} data-testid="input-project-code" />
                      <Button className="w-full" onClick={() => {
                        if (!projectForm.name) return;
                        createProject.mutate({ data: { name: projectForm.name, code: projectForm.code || undefined } }, {
                          onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() }); setOpenDialog(null); setProjectForm({ name: "", code: "" }); toast({ title: "Project added" }); },
                        });
                      }} data-testid="button-confirm-project">Add</Button>
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
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Code</TableHead></TableRow></TableHeader>
                <TableBody>
                  {projLoading ? <TableRow><TableCell colSpan={2}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                    : projects?.map(p => <TableRow key={p.id}><TableCell className="font-medium">{p.name}</TableCell><TableCell className="font-mono text-sm text-muted-foreground">{p.code ?? "—"}</TableCell></TableRow>)}
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
                <Dialog open={openDialog === "asset"} onOpenChange={(v) => setOpenDialog(v ? "asset" : null)}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-2" data-testid="button-add-asset"><PlusCircle className="w-4 h-4" />Add</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Add Vessel / Equipment / Location</DialogTitle></DialogHeader>
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
                        <SelectContent>{projects?.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">Leave the project blank to make it available on every project.</p>
                      <Button className="w-full" disabled={createAsset.isPending} onClick={() => {
                        if (!assetForm.name) return;
                        createAsset.mutate({ data: { name: assetForm.name, type: assetForm.type, project_id: assetForm.project_id ? Number(assetForm.project_id) : null } }, {
                          onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListAssetsQueryKey() }); setOpenDialog(null); setAssetForm({ name: "", type: "vessel", project_id: "" }); toast({ title: "Added" }); },
                        });
                      }} data-testid="button-confirm-asset">Add</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Project</TableHead><TableHead className="w-10"></TableHead></TableRow></TableHeader>
                <TableBody>
                  {assetLoading ? <TableRow><TableCell colSpan={4}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                    : !assets?.length ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nothing added yet.</TableCell></TableRow>
                    : assets.map(a => (
                      <TableRow key={a.id} data-testid={`row-asset-${a.id}`}>
                        <TableCell className="font-medium">{a.name}</TableCell>
                        <TableCell>{a.type ? <Badge variant="outline" className="text-xs capitalize">{a.type}</Badge> : "—"}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{projects?.find(p => p.id === a.project_id)?.name ?? "All projects"}</TableCell>
                        <TableCell>
                          <button type="button" className="text-muted-foreground hover:text-destructive transition-colors" onClick={() => deleteAsset.mutate({ id: a.id }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListAssetsQueryKey() }); toast({ title: "Removed" }); } })} data-testid={`button-delete-asset-${a.id}`}>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </TableCell>
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
                <Dialog open={openDialog === "holiday"} onOpenChange={(v) => setOpenDialog(v ? "holiday" : null)}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-2" data-testid="button-add-holiday"><PlusCircle className="w-4 h-4" />Add Holiday</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Add Holiday</DialogTitle></DialogHeader>
                    <div className="space-y-3 mt-2">
                      <Input type="date" value={holidayForm.date} onChange={e => setHolidayForm(f => ({ ...f, date: e.target.value }))} data-testid="input-holiday-date" />
                      <Input placeholder="Holiday Name *" value={holidayForm.name} onChange={e => setHolidayForm(f => ({ ...f, name: e.target.value }))} data-testid="input-holiday-name" />
                      <Button className="w-full" disabled={createHoliday.isPending} onClick={() => {
                        if (!holidayForm.date || !holidayForm.name) return;
                        createHoliday.mutate({ data: { date: holidayForm.date, name: holidayForm.name } }, {
                          onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListHolidaysQueryKey() }); setOpenDialog(null); setHolidayForm({ date: "", name: "" }); toast({ title: "Holiday added" }); },
                          onError: () => toast({ title: "Error", description: "A holiday may already be set for that date.", variant: "destructive" }),
                        });
                      }} data-testid="button-confirm-holiday">Add</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Name</TableHead><TableHead className="w-10"></TableHead></TableRow></TableHeader>
                <TableBody>
                  {holidayLoading ? <TableRow><TableCell colSpan={3}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                    : !sortedHolidays.length ? <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">No holidays added yet.</TableCell></TableRow>
                    : sortedHolidays.map(h => (
                      <TableRow key={h.id} data-testid={`row-holiday-${h.id}`}>
                        <TableCell className="font-mono text-sm">{h.date}</TableCell>
                        <TableCell className="font-medium">{h.name}</TableCell>
                        <TableCell>
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-destructive transition-colors"
                            onClick={() => deleteHoliday.mutate({ id: h.id }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListHolidaysQueryKey() }); toast({ title: "Holiday removed" }); } })}
                            data-testid={`button-delete-holiday-${h.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </TableCell>
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
