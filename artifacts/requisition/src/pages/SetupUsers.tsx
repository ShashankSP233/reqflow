import { useState } from "react";
import { useListUsers, useCreateUser, useUpdateUser, useDeleteUser, getListUsersQueryKey, useListProjects } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { PlusCircle, Trash2, KeyRound, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const ROLES = [
  { value: "site_user", label: "Site User" },
  { value: "checker", label: "Checker" },
  { value: "approver", label: "Approver" },
  { value: "purchase_head", label: "Purchase Head" },
  { value: "purchase_member", label: "Purchase Member" },
];

const ROLE_COLORS: Record<string, string> = {
  site_user: "bg-blue-50 text-blue-700 border-blue-200",
  checker: "bg-amber-50 text-amber-700 border-amber-200",
  approver: "bg-purple-50 text-purple-700 border-purple-200",
  purchase_head: "bg-emerald-50 text-emerald-700 border-emerald-200",
  purchase_member: "bg-sky-50 text-sky-700 border-sky-200",
};

type EditableUser = { id: number; name: string; role: string; site_name?: string | null; project_ids?: number[] };

export default function SetupUsers() {
  const { data: users, isLoading } = useListUsers();
  const { data: projects } = useListProjects();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", role: "site_user", site_name: "", password: "", project_ids: [] as number[] });
  const [resetForId, setResetForId] = useState<number | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [editingUser, setEditingUser] = useState<EditableUser | null>(null);
  const [editForm, setEditForm] = useState({ name: "", role: "", site_name: "", project_ids: [] as number[] });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
  }

  function toggleProject(list: number[], setList: (ids: number[]) => void, projectId: number) {
    setList(list.includes(projectId) ? list.filter(id => id !== projectId) : [...list, projectId]);
  }

  function handleCreate() {
    if (!form.name || !form.role) return;
    createUser.mutate(
      { data: { name: form.name, email: form.email || undefined, role: form.role, site_name: form.site_name || undefined, password: form.password || undefined, project_ids: form.project_ids } },
      {
        onSuccess: () => {
          invalidate();
          setOpen(false);
          setForm({ name: "", email: "", role: "site_user", site_name: "", password: "", project_ids: [] });
          toast({ title: "User created" });
        },
        onError: () => toast({ title: "Error", description: "A user with that name may already exist.", variant: "destructive" }),
      }
    );
  }

  function handleDelete(id: number) {
    deleteUser.mutate({ id }, {
      onSuccess: () => { invalidate(); toast({ title: "User deleted" }); },
    });
  }

  function handleResetPassword() {
    if (!resetForId || !resetPassword) return;
    updateUser.mutate({ id: resetForId, data: { password: resetPassword } }, {
      onSuccess: () => {
        invalidate();
        setResetForId(null);
        setResetPassword("");
        toast({ title: "Password updated" });
      },
    });
  }

  function startEdit(u: EditableUser) {
    setEditingUser(u);
    setEditForm({ name: u.name, role: u.role, site_name: u.site_name ?? "", project_ids: u.project_ids ?? [] });
  }

  function handleSaveEdit() {
    if (!editingUser || !editForm.name || !editForm.role) return;
    updateUser.mutate({ id: editingUser.id, data: { name: editForm.name, role: editForm.role, site_name: editForm.site_name || undefined, project_ids: editForm.project_ids } }, {
      onSuccess: () => {
        invalidate();
        setEditingUser(null);
        toast({ title: "User updated" });
      },
      onError: () => toast({ title: "Error", description: "A user with that name may already exist.", variant: "destructive" }),
    });
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Manage team members, their roles, login access, and project assignments</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2" data-testid="button-add-user"><PlusCircle className="w-4 h-4" />Add User</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add New User</DialogTitle></DialogHeader>
            <div className="space-y-3 mt-2">
              <Input placeholder="Full Name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} data-testid="input-user-name" />
              <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                <SelectTrigger data-testid="select-user-role"><SelectValue /></SelectTrigger>
                <SelectContent>{ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
              </Select>
              <Input placeholder="Site / Location" value={form.site_name} onChange={e => setForm(f => ({ ...f, site_name: e.target.value }))} data-testid="input-user-site" />
              <div>
                <label className="text-sm font-medium">Projects</label>
                <div className="flex flex-wrap gap-2 mt-1.5">
                  {!projects?.length && <p className="text-xs text-muted-foreground">Add a project under Setup → Projects first.</p>}
                  {projects?.map(p => (
                    <button key={p.id} type="button"
                      onClick={() => toggleProject(form.project_ids, (ids) => setForm(f => ({ ...f, project_ids: ids })), p.id)}
                      className={`px-3 py-1 rounded-full border text-sm transition-colors ${form.project_ids.includes(p.id) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"}`}
                      data-testid={`chip-new-user-project-${p.id}`}
                    >{p.name}</button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Only assigned projects' requisitions will be visible to this person (Purchase Head sees everything regardless).</p>
              </div>
              <div>
                <Input
                  type="password"
                  placeholder="Password (optional)"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  data-testid="input-user-password"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Leave blank if this person won't log in themselves.
                </p>
              </div>
              <Button className="w-full" onClick={handleCreate} disabled={createUser.isPending} data-testid="button-confirm-user">Create User</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Site</TableHead>
                <TableHead>Projects</TableHead>
                <TableHead>Login</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>{Array.from({ length: 6 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
              )) : users?.map(u => (
                <TableRow key={u.id} data-testid={`row-user-${u.id}`}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-xs ${ROLE_COLORS[u.role] ?? ""}`}>{ROLES.find(r => r.value === u.role)?.label ?? u.role}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{u.site_name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {u.role === "purchase_head" ? "All (Purchase Head)" : (u.project_ids && u.project_ids.length > 0 ? u.project_ids.map(pid => projects?.find(p => p.id === pid)?.name ?? "?").join(", ") : "—")}
                  </TableCell>
                  <TableCell>
                    {u.has_password ? (
                      <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">Can log in</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs bg-slate-50 text-slate-600 border-slate-200">No password set</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <button onClick={() => startEdit(u)} className="text-muted-foreground hover:text-foreground transition-colors" title="Edit" data-testid={`button-edit-user-${u.id}`}>
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => { setResetForId(u.id); setResetPassword(""); }}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        title={u.has_password ? "Reset password" : "Set password"}
                        data-testid={`button-reset-password-${u.id}`}
                      >
                        <KeyRound className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(u.id)} className="text-muted-foreground hover:text-destructive transition-colors" data-testid={`button-delete-user-${u.id}`}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={resetForId !== null} onOpenChange={(v) => { if (!v) { setResetForId(null); setResetPassword(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Set Password</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <Input
              type="password"
              placeholder="New password"
              value={resetPassword}
              onChange={e => setResetPassword(e.target.value)}
              autoFocus
              data-testid="input-reset-password"
            />
            <Button className="w-full" onClick={handleResetPassword} disabled={updateUser.isPending || !resetPassword} data-testid="button-confirm-reset-password">
              Save Password
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editingUser !== null} onOpenChange={(v) => { if (!v) setEditingUser(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit User</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <Input placeholder="Full Name *" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} data-testid="input-edit-user-name" />
            <Select value={editForm.role} onValueChange={v => setEditForm(f => ({ ...f, role: v }))}>
              <SelectTrigger data-testid="select-edit-user-role"><SelectValue /></SelectTrigger>
              <SelectContent>{ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
            </Select>
            <Input placeholder="Site / Location" value={editForm.site_name} onChange={e => setEditForm(f => ({ ...f, site_name: e.target.value }))} data-testid="input-edit-user-site" />
            <div>
              <label className="text-sm font-medium">Projects</label>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {projects?.map(p => (
                  <button key={p.id} type="button"
                    onClick={() => toggleProject(editForm.project_ids, (ids) => setEditForm(f => ({ ...f, project_ids: ids })), p.id)}
                    className={`px-3 py-1 rounded-full border text-sm transition-colors ${editForm.project_ids.includes(p.id) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"}`}
                    data-testid={`chip-edit-user-project-${p.id}`}
                  >{p.name}</button>
                ))}
              </div>
            </div>
            <Button className="w-full" onClick={handleSaveEdit} disabled={updateUser.isPending} data-testid="button-confirm-edit-user">Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
