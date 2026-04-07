import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useListEmployees, useCreateEmployee, useUpdateEmployee, useDeleteEmployee, useImportEmployees } from "@workspace/api-client-react";
import type { Employee } from "@workspace/api-client-react/src/generated/api.schemas";
import { Users, Plus, Edit2, Trash2, Search, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { ExcelImport } from "@/components/excel-import";
import { Link } from "wouter";

const formSchema = z.object({
  firstName: z.string().min(2, "Prénom requis"),
  lastName: z.string().min(2, "Nom requis"),
  role: z.string().optional(),
  department: z.string().optional(),
  employeeNumber: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Email invalide").optional().or(z.literal('')),
  status: z.enum(["active", "inactive"]),
});

export default function EmployeesPage() {
  const { data: employees, isLoading } = useListEmployees();
  const [search, setSearch] = useState("");
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createMutation = useCreateEmployee();
  const updateMutation = useUpdateEmployee();
  const deleteMutation = useDeleteEmployee();
  const importMutation = useImportEmployees();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "", lastName: "", role: "Signaleur", department: "", employeeNumber: "", phone: "", email: "", status: "active",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      if (editingEmployee) {
        await updateMutation.mutateAsync({ id: editingEmployee.id, data: values });
        toast({ title: "Employé mis à jour" });
      } else {
        await createMutation.mutateAsync({ data: values });
        toast({ title: "Employé créé" });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      setIsDialogOpen(false);
      form.reset();
      setEditingEmployee(null);
    } catch (e) {
      toast({ title: "Erreur", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer cet employé ?")) {
      try {
        await deleteMutation.mutateAsync({ id });
        queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
        setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
        toast({ title: "Employé supprimé" });
      } catch (e) {
        toast({ title: "Erreur", variant: "destructive" });
      }
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Êtes-vous sûr de vouloir supprimer ${selectedIds.size} employé${selectedIds.size > 1 ? 's' : ''} ?`)) return;
    setIsBulkDeleting(true);
    let deleted = 0;
    for (const id of selectedIds) {
      try {
        await deleteMutation.mutateAsync({ id });
        deleted++;
      } catch {}
    }
    queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
    setSelectedIds(new Set());
    setIsBulkDeleting(false);
    toast({ title: `${deleted} employé${deleted > 1 ? 's' : ''} supprimé${deleted > 1 ? 's' : ''}` });
  };

  const handleImport = async (data: any[]) => {
    const result = await importMutation.mutateAsync({ data: { employees: data } });
    queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
    toast({
      title: "Importation terminée",
      description: `${result.imported} ajoutés, ${result.skipped} ignorés. ${result.errors.length > 0 ? 'Quelques erreurs.' : ''}`
    });
  };

  const openEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    form.reset({
      firstName: employee.firstName,
      lastName: employee.lastName,
      role: employee.role || "",
      department: employee.department || "",
      employeeNumber: employee.employeeNumber || "",
      phone: employee.phone || "",
      email: employee.email || "",
      status: employee.status as "active" | "inactive",
    });
    setIsDialogOpen(true);
  };

  const sq = search.toLowerCase().trim();
  const filteredEmployees = !sq
    ? employees
    : employees?.filter(e =>
        `${e.firstName} ${e.lastName}`.toLowerCase().includes(sq) ||
        (e.role && e.role.toLowerCase().includes(sq)) ||
        (e.employeeNumber && e.employeeNumber.toLowerCase().includes(sq))
      );

  const allIds = filteredEmployees?.map(e => e.id!).filter(Boolean) ?? [];
  const allSelected = allIds.length > 0 && allIds.every(id => selectedIds.has(id));
  const someSelected = allIds.some(id => selectedIds.has(id));

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(prev => { const n = new Set(prev); allIds.forEach(id => n.delete(id)); return n; });
    } else {
      setSelectedIds(prev => { const n = new Set(prev); allIds.forEach(id => n.add(id)); return n; });
    }
  };

  const toggleOne = (id: number) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-card p-6 rounded-2xl border border-border shadow-sm">
          <div>
            <h1 className="text-2xl font-display font-bold flex items-center gap-2">
              <Users className="text-primary" /> Personnel
            </h1>
            <p className="text-muted-foreground mt-1">Gérez votre base de données d'employés.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher (nom, rôle, matricule...)"
                className="pl-9 bg-muted/50 border-transparent focus:bg-background rounded-xl"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <ExcelImport type="employees" onImport={handleImport} buttonLabel="Importer" />

            <Dialog open={isDialogOpen} onOpenChange={(val) => {
              setIsDialogOpen(val);
              if (!val) { form.reset(); setEditingEmployee(null); }
            }}>
              <DialogTrigger asChild>
                <Button className="rounded-xl shadow-lg shadow-primary/20 gap-2 shrink-0">
                  <Plus className="h-4 w-4" /> Ajouter
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>{editingEmployee ? 'Modifier employé' : 'Nouvel employé'}</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="firstName" render={({ field }) => (
                        <FormItem><FormLabel>Prénom *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="lastName" render={({ field }) => (
                        <FormItem><FormLabel>Nom *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="role" render={({ field }) => (
                        <FormItem><FormLabel>Rôle</FormLabel><FormControl><Input {...field} placeholder="ex: Signaleur" /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="employeeNumber" render={({ field }) => (
                        <FormItem><FormLabel>Matricule</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="phone" render={({ field }) => (
                        <FormItem><FormLabel>Téléphone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="email" render={({ field }) => (
                        <FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} type="email" /></FormControl><FormMessage /></FormItem>
                      )} />
                    </div>
                    <FormField control={form.control} name="status" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Statut</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Sélectionnez" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="active">Actif</SelectItem>
                            <SelectItem value="inactive">Inactif</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <DialogFooter className="pt-4">
                      <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                        {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Enregistrer
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 bg-destructive/5 border border-destructive/20 rounded-xl px-4 py-3">
            <span className="text-sm font-medium text-destructive">
              {selectedIds.size} employé{selectedIds.size > 1 ? 's' : ''} sélectionné{selectedIds.size > 1 ? 's' : ''}
            </span>
            <Button
              size="sm"
              variant="destructive"
              className="gap-2 ml-auto"
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
            >
              {isBulkDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Supprimer la sélection
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())} disabled={isBulkDeleting}>
              Annuler
            </Button>
          </div>
        )}

        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground flex flex-col items-center">
              <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary" />
              Chargement du personnel...
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-10 py-4">
                    <Checkbox
                      checked={allSelected}
                      data-state={someSelected && !allSelected ? "indeterminate" : undefined}
                      onCheckedChange={toggleAll}
                      aria-label="Tout sélectionner"
                    />
                  </TableHead>
                  <TableHead className="py-4">Employé</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees?.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucun employé trouvé.</TableCell></TableRow>
                ) : (
                  filteredEmployees?.map(emp => (
                    <TableRow key={emp.id} className={`hover:bg-muted/30 ${selectedIds.has(emp.id!) ? 'bg-primary/5' : ''}`}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(emp.id!)}
                          onCheckedChange={() => toggleOne(emp.id!)}
                          aria-label={`Sélectionner ${emp.firstName} ${emp.lastName}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Link href={`/personnel/${emp.id}`} className="flex items-center gap-3 group">
                          <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-semibold text-sm group-hover:bg-primary/10 group-hover:text-primary transition-colors shrink-0">
                            {emp.firstName.charAt(0)}{emp.lastName.charAt(0)}
                          </div>
                          <div>
                            <div className="font-medium text-foreground group-hover:text-primary transition-colors">{emp.firstName} {emp.lastName}</div>
                            <div className="text-xs text-muted-foreground">{emp.employeeNumber || 'Sans matricule'}</div>
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell>{emp.role || '-'}</TableCell>
                      <TableCell>
                        <div className="text-sm">{emp.phone || '-'}</div>
                        <div className="text-xs text-muted-foreground">{emp.email || ''}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={emp.status === 'active' ? 'default' : 'secondary'} className={emp.status === 'active' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 shadow-none' : ''}>
                          {emp.status === 'active' ? 'Actif' : 'Inactif'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(emp)} className="h-8 w-8 text-slate-500 hover:text-primary">
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(emp.id!)} className="h-8 w-8 text-slate-500 hover:text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </Layout>
  );
}
