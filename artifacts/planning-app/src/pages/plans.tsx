import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useListPlans, useCreatePlan, useListClients, useDeletePlan } from "@workspace/api-client-react";
import { CalendarDays, Plus, Calendar as CalIcon, Search, Loader2, ArrowRight, Trash2, Building2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const formSchema = z.object({
  name: z.string().min(2, "Nom requis"),
  clientId: z.coerce.number().min(1, "Client requis"),
  date: z.string().min(10, "Date requise"),
  notes: z.string().optional(),
});

export default function PlansPage() {
  const [, setLocation] = useLocation();
  const { data: plans, isLoading } = useListPlans();
  const { data: clients } = useListClients();
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createMutation = useCreatePlan();
  const deleteMutation = useDeletePlan();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      clientId: 0,
      date: new Date().toISOString().split('T')[0],
      notes: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const result = await createMutation.mutateAsync({ data: { ...values, status: "draft" } });
      toast({ title: "Plan créé" });
      queryClient.invalidateQueries({ queryKey: ["/api/plans"] });
      setIsDialogOpen(false);
      form.reset();
      setLocation(`/plans/${result.id}`);
    } catch (e) {
      toast({ title: "Erreur", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (confirm("Êtes-vous sûr de vouloir supprimer ce plan ?")) {
      try {
        await deleteMutation.mutateAsync({ id });
        queryClient.invalidateQueries({ queryKey: ["/api/plans"] });
        toast({ title: "Plan supprimé" });
      } catch (e) {
        toast({ title: "Erreur", variant: "destructive" });
      }
    }
  };

  const filteredPlans = plans?.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    (p.clientName && p.clientName.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card p-6 rounded-2xl border border-border shadow-sm">
          <div>
            <h1 className="text-2xl font-display font-bold flex items-center gap-2">
              <CalendarDays className="text-primary" /> Planification
            </h1>
            <p className="text-muted-foreground mt-1">Créez et organisez vos plans de travail.</p>
          </div>

          <div className="flex items-center gap-4 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Rechercher..." 
                className="pl-9 bg-muted/50 border-transparent focus:bg-background rounded-xl"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            
            <Dialog open={isDialogOpen} onOpenChange={(val) => {
              setIsDialogOpen(val);
              if (!val) form.reset();
            }}>
              <DialogTrigger asChild>
                <Button className="rounded-xl shadow-lg shadow-primary/20 gap-2 shrink-0">
                  <Plus className="h-4 w-4" /> Nouveau Plan
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Nouveau Plan de Travail</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                    <FormField control={form.control} name="name" render={({ field }) => (
                      <FormItem><FormLabel>Nom du plan *</FormLabel><FormControl><Input {...field} placeholder="Ex: Chantier Autoroute A4" /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="clientId" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Client *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value ? String(field.value) : undefined}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Sélectionnez un client" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {clients?.map(c => (
                              <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="date" render={({ field }) => (
                      <FormItem><FormLabel>Date d'intervention *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="notes" render={({ field }) => (
                      <FormItem><FormLabel>Notes (Optionnel)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <DialogFooter className="pt-4">
                      <Button type="submit" disabled={createMutation.isPending}>
                        {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Créer & Ouvrir
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPlans?.map(plan => (
              <Link key={plan.id} href={`/plans/${plan.id}`}>
                <div className="bg-card rounded-2xl border border-border shadow-sm p-6 hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group flex flex-col h-full">
                  <div className="flex justify-between items-start mb-4">
                    <div className="bg-primary/10 text-primary p-2 rounded-lg">
                      <CalIcon className="h-5 w-5" />
                    </div>
                    <div className="flex items-center gap-2">
                       <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        plan.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                        plan.status === 'completed' ? 'bg-slate-100 text-slate-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {plan.status === 'confirmed' ? 'Confirmé' : plan.status === 'completed' ? 'Terminé' : 'Brouillon'}
                      </span>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => handleDelete(plan.id, e)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <h3 className="text-xl font-display font-bold text-foreground mb-1 line-clamp-1" title={plan.name}>{plan.name}</h3>
                  <div className="text-muted-foreground flex items-center gap-2 text-sm mb-4">
                    <Building2 className="h-4 w-4" /> {plan.clientName}
                  </div>
                  <div className="mt-auto pt-4 border-t border-border flex items-center justify-between text-sm">
                    <span className="font-medium">{format(new Date(plan.date), 'dd/MM/yyyy')}</span>
                    <span className="text-primary font-semibold flex items-center gap-1 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300">
                      Ouvrir <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}

            {filteredPlans?.length === 0 && (
              <div className="col-span-full py-16 text-center text-muted-foreground border-2 border-dashed border-border rounded-2xl bg-muted/20">
                <CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <h3 className="text-lg font-medium text-foreground mb-1">Aucun plan trouvé</h3>
                <p>Commencez par créer un nouveau plan de travail.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
