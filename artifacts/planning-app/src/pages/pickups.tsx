import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useListPickups, useCreatePickup, useUpdatePickup, useDeletePickup, useImportPickups } from "@workspace/api-client-react";
import type { Pickup } from "@workspace/api-client-react/src/generated/api.schemas";
import { Truck, Plus, Edit2, Trash2, Search, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { ExcelImport } from "@/components/excel-import";
import { Link } from "wouter";

const formSchema = z.object({
  unitNumber: z.string().min(1, "Numéro d'unité requis"),
  plateNumber: z.string().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  year: z.coerce.number().optional().or(z.literal('')),
  capacity: z.coerce.number().min(1).default(2),
  color: z.string().optional(),
  status: z.enum(["available", "in_use", "maintenance"]),
});

export default function PickupsPage() {
  const { data: pickups, isLoading } = useListPickups();
  const [search, setSearch] = useState("");
  const [editingPickup, setEditingPickup] = useState<Pickup | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createMutation = useCreatePickup();
  const updateMutation = useUpdatePickup();
  const deleteMutation = useDeletePickup();
  const importMutation = useImportPickups();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      unitNumber: "", plateNumber: "", brand: "", model: "", capacity: 2, color: "", status: "available",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      if (editingPickup) {
        await updateMutation.mutateAsync({ id: editingPickup.id, data: values as any });
        toast({ title: "Véhicule mis à jour" });
      } else {
        await createMutation.mutateAsync({ data: values as any });
        toast({ title: "Véhicule ajouté" });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/pickups"] });
      setIsDialogOpen(false);
      form.reset();
      setEditingPickup(null);
    } catch (e) {
      toast({ title: "Erreur", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer ce véhicule ?")) {
      try {
        await deleteMutation.mutateAsync({ id });
        queryClient.invalidateQueries({ queryKey: ["/api/pickups"] });
        toast({ title: "Véhicule supprimé" });
      } catch (e) {
        toast({ title: "Erreur", variant: "destructive" });
      }
    }
  };

  const handleImport = async (data: any[]) => {
    const result = await importMutation.mutateAsync({ data: { pickups: data } });
    queryClient.invalidateQueries({ queryKey: ["/api/pickups"] });
    toast({ 
      title: "Importation terminée", 
      description: `${result.imported} ajoutés, ${result.skipped} ignorés.`
    });
  };

  const openEdit = (pickup: Pickup) => {
    setEditingPickup(pickup);
    form.reset({
      unitNumber: pickup.unitNumber || "",
      plateNumber: pickup.plateNumber || "",
      brand: pickup.brand || "",
      model: pickup.model || "",
      year: pickup.year || undefined,
      capacity: pickup.capacity || 2,
      color: pickup.color || "",
      status: pickup.status as "available" | "in_use" | "maintenance",
    });
    setIsDialogOpen(true);
  };

  const q = search.toLowerCase();
  const filteredPickups = pickups?.filter(p =>
    (p.unitNumber && p.unitNumber.toLowerCase().includes(q)) ||
    (p.plateNumber && p.plateNumber.toLowerCase().includes(q)) ||
    (p.brand && p.brand.toLowerCase().includes(q)) ||
    (p.model && p.model.toLowerCase().includes(q))
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'available': return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 shadow-none">Disponible</Badge>;
      case 'in_use': return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 shadow-none">En service</Badge>;
      case 'maintenance': return <Badge className="bg-red-100 text-red-700 hover:bg-red-200 shadow-none">Maintenance</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-card p-6 rounded-2xl border border-border shadow-sm">
          <div>
            <h1 className="text-2xl font-display font-bold flex items-center gap-2">
              <Truck className="text-primary" /> Flotte de Véhicules
            </h1>
            <p className="text-muted-foreground mt-1">Gérez vos pick-ups et véhicules.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Rechercher (unité, plaque, marque...)" 
                className="pl-9 bg-muted/50 border-transparent focus:bg-background rounded-xl"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            
            <ExcelImport type="pickups" onImport={handleImport} buttonLabel="Importer" />

            <Dialog open={isDialogOpen} onOpenChange={(val) => {
              setIsDialogOpen(val);
              if (!val) { form.reset(); setEditingPickup(null); }
            }}>
              <DialogTrigger asChild>
                <Button className="rounded-xl shadow-lg shadow-primary/20 gap-2 shrink-0">
                  <Plus className="h-4 w-4" /> Ajouter
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>{editingPickup ? 'Modifier véhicule' : 'Nouveau véhicule'}</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="unitNumber" render={({ field }) => (
                        <FormItem>
                          <FormLabel>N° d'unité *</FormLabel>
                          <FormControl><Input {...field} className="font-mono" placeholder="09-462" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="plateNumber" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Plaque (optionnel)</FormLabel>
                          <FormControl><Input {...field} className="font-mono uppercase" placeholder="ABC 123" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="brand" render={({ field }) => (
                        <FormItem><FormLabel>Marque</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="model" render={({ field }) => (
                        <FormItem><FormLabel>Modèle</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="year" render={({ field }) => (
                        <FormItem><FormLabel>Année</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="capacity" render={({ field }) => (
                        <FormItem><FormLabel>Capacité (places)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                    </div>
                    <FormField control={form.control} name="status" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Statut</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Sélectionnez" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="available">Disponible</SelectItem>
                            <SelectItem value="in_use">En service</SelectItem>
                            <SelectItem value="maintenance">En maintenance</SelectItem>
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

        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground flex flex-col items-center">
              <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary" />
              Chargement des véhicules...
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="py-4">Unité</TableHead>
                  <TableHead>Véhicule</TableHead>
                  <TableHead>Année / Capacité</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPickups?.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Aucun véhicule trouvé.</TableCell></TableRow>
                ) : (
                  filteredPickups?.map(pickup => (
                    <TableRow key={pickup.id} className="hover:bg-muted/30">
                      <TableCell>
                        <Link href={`/vehicules/${pickup.id}`} className="group">
                          <div className="font-mono font-bold bg-slate-100 text-slate-800 px-3 py-1 rounded border border-slate-200 inline-block group-hover:border-primary/40 group-hover:bg-primary/5 transition-colors">
                            {pickup.unitNumber || pickup.plateNumber || `#${pickup.id}`}
                          </div>
                          {pickup.unitNumber && pickup.plateNumber && (
                            <div className="text-xs text-muted-foreground font-mono mt-0.5">{pickup.plateNumber}</div>
                          )}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{pickup.brand || 'Inconnue'} {pickup.model}</div>
                        {pickup.color && <div className="text-xs text-muted-foreground mt-0.5">Couleur: {pickup.color}</div>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {pickup.year || '-'} • {pickup.capacity} pl.
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(pickup.status)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(pickup)} className="h-8 w-8 text-slate-500 hover:text-primary">
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(pickup.id)} className="h-8 w-8 text-slate-500 hover:text-destructive hover:bg-destructive/10">
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
