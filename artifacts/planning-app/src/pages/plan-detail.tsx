import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, useDraggable, useDroppable, pointerWithin } from "@dnd-kit/core";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useGetPlan, useListEmployees, useListPickups, useSavePlanAssignments, useUpdatePlan } from "@workspace/api-client-react";
import { Printer, Save, Check, User, Truck, GripVertical, CalendarDays, Building2, MapPin, X } from "lucide-react";
import type { Employee, Pickup } from "@workspace/api-client-react/src/generated/api.schemas";

// --- DND Components ---

function DraggableEmployee({ employee }: { employee: Employee }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `emp-${employee.id}`,
    data: { type: 'employee', item: employee }
  });

  return (
    <div 
      ref={setNodeRef} 
      {...listeners} 
      {...attributes}
      className={`p-3 bg-white border border-slate-200 rounded-xl shadow-sm flex items-center gap-3 cursor-grab hover:border-primary/50 transition-colors ${isDragging ? 'opacity-50 ring-2 ring-primary' : ''}`}
    >
      <div className="bg-blue-50 p-2 rounded-lg text-blue-600"><User className="h-4 w-4" /></div>
      <div>
        <div className="font-semibold text-sm">{employee.firstName} {employee.lastName}</div>
        <div className="text-xs text-muted-foreground">{employee.role || 'Signaleur'}</div>
      </div>
      <GripVertical className="h-4 w-4 text-slate-300 ml-auto" />
    </div>
  );
}

function DraggablePickup({ pickup }: { pickup: Pickup }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `pic-${pickup.id}`,
    data: { type: 'pickup', item: pickup }
  });

  return (
    <div 
      ref={setNodeRef} 
      {...listeners} 
      {...attributes}
      className={`p-3 bg-white border border-slate-200 rounded-xl shadow-sm flex items-center gap-3 cursor-grab hover:border-primary/50 transition-colors ${isDragging ? 'opacity-50 ring-2 ring-primary' : ''}`}
    >
      <div className="bg-amber-50 p-2 rounded-lg text-amber-600"><Truck className="h-4 w-4" /></div>
      <div>
        <div className="font-mono font-bold text-sm bg-slate-100 px-1 rounded inline-block">{pickup.plateNumber}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{pickup.model || 'Véhicule'} • {pickup.capacity}pl.</div>
      </div>
      <GripVertical className="h-4 w-4 text-slate-300 ml-auto" />
    </div>
  );
}

function DroppableSlot({ position, assignment, employees, pickups, onRemove, clientName }: any) {
  const { isOver, setNodeRef } = useDroppable({
    id: `slot-${position}`,
    data: { position }
  });

  const emp = assignment?.employeeId ? employees?.find((e: any) => e.id === assignment.employeeId) : null;
  const pic = assignment?.pickupId ? pickups?.find((p: any) => p.id === assignment.pickupId) : null;

  return (
    <div 
      ref={setNodeRef}
      className={`flex items-stretch min-h-[80px] bg-white border rounded-xl overflow-hidden transition-all ${isOver ? 'border-primary ring-2 ring-primary/20 bg-primary/5' : 'border-slate-200 shadow-sm'}`}
    >
      {/* Client indicator */}
      <div className="w-36 bg-slate-50 border-r border-slate-100 flex items-center justify-center px-3 text-center">
        <span className="text-xs font-semibold text-primary leading-tight">{clientName}</span>
      </div>

      {/* Employee Drop Zone */}
      <div className="flex-1 p-3 border-r border-slate-100 border-dashed relative group flex items-center">
        {emp ? (
          <div className="flex items-center gap-3 w-full bg-blue-50/50 p-2 rounded-lg border border-blue-100">
            <div className="bg-blue-100 p-2 rounded-md text-blue-700"><User className="h-4 w-4" /></div>
            <div>
              <div className="font-semibold text-sm text-blue-900">{emp.firstName} {emp.lastName}</div>
              <div className="text-xs text-blue-700/70">{emp.role || 'Signaleur'}</div>
            </div>
            <button onClick={() => onRemove(position, 'employee')} className="ml-auto text-blue-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="text-sm text-slate-400 text-center w-full italic">
            Glissez un employé ici
          </div>
        )}
      </div>

      {/* Pickup Drop Zone */}
      <div className="flex-1 p-3 relative group flex items-center">
        {pic ? (
           <div className="flex items-center gap-3 w-full bg-amber-50/50 p-2 rounded-lg border border-amber-100">
             <div className="bg-amber-100 p-2 rounded-md text-amber-700"><Truck className="h-4 w-4" /></div>
             <div>
               <div className="font-mono font-bold text-sm bg-white border border-amber-200 text-amber-900 px-1 rounded">{pic.plateNumber}</div>
               <div className="text-xs text-amber-700/70 mt-0.5">{pic.model}</div>
             </div>
             <button onClick={() => onRemove(position, 'pickup')} className="ml-auto text-amber-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1">
               <X className="h-4 w-4" />
             </button>
           </div>
        ) : (
          <div className="text-sm text-slate-400 text-center w-full italic">
            Glissez un véhicule ici
          </div>
        )}
      </div>
    </div>
  );
}

// --- Main Page ---

export default function PlanDetailPage() {
  const [, params] = useRoute("/plans/:id");
  const planId = parseInt(params?.id || "0", 10);
  const { toast } = useToast();

  const { data: plan, isLoading: loadingPlan } = useGetPlan(planId);
  const { data: employees } = useListEmployees();
  const { data: pickups } = useListPickups();
  
  const saveMutation = useSavePlanAssignments();
  const updateMutation = useUpdatePlan();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeItem, setActiveItem] = useState<any>(null);
  
  // Format: { [position]: { employeeId, pickupId } }
  const [assignments, setAssignments] = useState<Record<number, any>>({});
  const [isSaved, setIsSaved] = useState(true);

  // Initialize assignments from DB
  useEffect(() => {
    if (plan?.assignments) {
      const initial: Record<number, any> = {};
      plan.assignments.forEach(a => {
        initial[a.position] = { employeeId: a.employeeId, pickupId: a.pickupId };
      });
      setAssignments(initial);
      setIsSaved(true);
    }
  }, [plan]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setActiveItem(event.active.data.current?.item);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    setActiveItem(null);
    const { active, over } = event;

    if (over && over.id.toString().startsWith('slot-')) {
      const position = over.data.current?.position;
      const type = active.data.current?.type;
      const itemId = active.data.current?.item.id;

      if (position && type && itemId) {
        setAssignments(prev => ({
          ...prev,
          [position]: {
            ...prev[position],
            [type === 'employee' ? 'employeeId' : 'pickupId']: itemId
          }
        }));
        setIsSaved(false);
      }
    }
  };

  const handleRemove = (position: number, type: 'employee' | 'pickup') => {
    setAssignments(prev => ({
      ...prev,
      [position]: {
        ...prev[position],
        [type === 'employee' ? 'employeeId' : 'pickupId']: null
      }
    }));
    setIsSaved(false);
  };

  const handleSave = async () => {
    try {
      const arr = Object.keys(assignments).map(posStr => {
        const pos = parseInt(posStr);
        const data = assignments[pos];
        if (!data.employeeId && !data.pickupId) return null;
        return {
          position: pos,
          employeeId: data.employeeId || undefined,
          pickupId: data.pickupId || undefined,
        };
      }).filter(Boolean) as any[];

      await saveMutation.mutateAsync({ id: planId, data: { assignments: arr } });
      setIsSaved(true);
      toast({ title: "Plan sauvegardé avec succès" });
    } catch (e) {
      toast({ title: "Erreur lors de la sauvegarde", variant: "destructive" });
    }
  };

  const handleConfirmPlan = async () => {
    if (!isSaved) await handleSave();
    await updateMutation.mutateAsync({ id: planId, data: { status: 'confirmed' } });
    toast({ title: "Plan confirmé" });
  };

  const handlePrint = () => {
    window.print();
  };

  if (loadingPlan) {
    return <Layout><div className="flex h-[50vh] items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div></div></Layout>;
  }

  if (!plan) return <Layout><div>Plan introuvable</div></Layout>;

  // Filter out already assigned items for the sidebar
  const assignedEmployeeIds = Object.values(assignments).map(a => a?.employeeId).filter(Boolean);
  const assignedPickupIds = Object.values(assignments).map(a => a?.pickupId).filter(Boolean);
  
  const availableEmployees = employees?.filter(e => e.status === 'active' && !assignedEmployeeIds.includes(e.id)) || [];
  const availablePickups = pickups?.filter(p => p.status === 'available' && !assignedPickupIds.includes(p.id)) || [];

  return (
    <>
      <Layout>
        {/* --- DND Builder Interface (Hidden on Print) --- */}
        <div className="no-print h-[calc(100vh-8rem)] flex flex-col space-y-4">
          
          {/* Header */}
          <div className="bg-card rounded-2xl p-6 border border-border shadow-sm shrink-0">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-2xl font-display font-bold text-foreground">{plan.name}</h1>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${plan.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {plan.status === 'confirmed' ? 'Confirmé' : 'Brouillon'}
                  </span>
                </div>
                <div className="flex items-center gap-6 text-sm text-muted-foreground font-medium">
                  <span className="flex items-center gap-1.5"><Building2 className="h-4 w-4" /> {plan.clientName}</span>
                  <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4" /> {format(new Date(plan.date), 'EEEE d MMMM yyyy', { locale: fr })}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={handlePrint} className="gap-2 bg-white">
                  <Printer className="h-4 w-4" /> Imprimer / Export
                </Button>
                <Button 
                  onClick={handleSave} 
                  disabled={isSaved || saveMutation.isPending}
                  className={`gap-2 ${isSaved ? 'bg-slate-100 text-slate-500 hover:bg-slate-100' : 'shadow-lg shadow-primary/20'}`}
                >
                  {saveMutation.isPending ? <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> : <Save className="h-4 w-4" />}
                  {isSaved ? 'Sauvegardé' : 'Enregistrer'}
                </Button>
                {plan.status === 'draft' && (
                  <Button onClick={handleConfirmPlan} variant="secondary" className="gap-2 bg-emerald-100 text-emerald-800 hover:bg-emerald-200">
                    <Check className="h-4 w-4" /> Confirmer
                  </Button>
                )}
              </div>
            </div>
          </div>

          <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd} collisionDetection={pointerWithin}>
            <div className="flex flex-1 gap-6 min-h-0 overflow-hidden">
              
              {/* Left Sidebar - Resources */}
              <div className="w-80 bg-card rounded-2xl border border-border shadow-sm flex flex-col overflow-hidden shrink-0">
                <div className="p-4 border-b border-border bg-slate-50/50">
                  <h3 className="font-semibold text-foreground">Ressources disponibles</h3>
                </div>
                
                <Tabs defaultValue="employees" className="flex-1 flex flex-col overflow-hidden">
                  <TabsList className="w-full justify-start rounded-none border-b border-border h-12 bg-transparent p-0">
                    <TabsTrigger value="employees" className="flex-1 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none">
                      <User className="h-4 w-4 mr-2" /> Personnel ({availableEmployees.length})
                    </TabsTrigger>
                    <TabsTrigger value="pickups" className="flex-1 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none">
                      <Truck className="h-4 w-4 mr-2" /> Véhicules ({availablePickups.length})
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="employees" className="flex-1 overflow-auto p-4 m-0 space-y-3 bg-slate-50/30">
                    {availableEmployees.map(emp => (
                      <DraggableEmployee key={emp.id} employee={emp} />
                    ))}
                    {availableEmployees.length === 0 && <p className="text-center text-muted-foreground text-sm py-4">Tous les employés actifs sont assignés.</p>}
                  </TabsContent>
                  
                  <TabsContent value="pickups" className="flex-1 overflow-auto p-4 m-0 space-y-3 bg-slate-50/30">
                    {availablePickups.map(pic => (
                      <DraggablePickup key={pic.id} pickup={pic} />
                    ))}
                     {availablePickups.length === 0 && <p className="text-center text-muted-foreground text-sm py-4">Tous les véhicules dispo sont assignés.</p>}
                  </TabsContent>
                </Tabs>
              </div>

              {/* Right Area - Grid */}
              <div className="flex-1 bg-slate-50/50 rounded-2xl border border-border shadow-inner p-6 overflow-auto">
                <div className="max-w-4xl mx-auto space-y-3">
                  <div className="flex text-sm font-semibold text-muted-foreground mb-4 px-2">
                    <div className="w-36 text-center">Client</div>
                    <div className="flex-1 px-4">Employé (Signaleur)</div>
                    <div className="flex-1 px-4">Véhicule (Pick-up)</div>
                  </div>
                  
                  {Array.from({ length: 15 }).map((_, i) => (
                    <DroppableSlot 
                      key={i+1} 
                      position={i+1} 
                      assignment={assignments[i+1]} 
                      employees={employees}
                      pickups={pickups}
                      onRemove={handleRemove}
                      clientName={plan.clientName}
                    />
                  ))}
                </div>
              </div>
            </div>

            <DragOverlay>
              {activeId?.toString().startsWith('emp-') && activeItem ? (
                <div className="p-3 bg-white border border-primary ring-4 ring-primary/20 rounded-xl shadow-xl flex items-center gap-3 w-64 opacity-90 scale-105">
                  <div className="bg-blue-50 p-2 rounded-lg text-blue-600"><User className="h-4 w-4" /></div>
                  <div>
                    <div className="font-semibold text-sm">{activeItem.firstName} {activeItem.lastName}</div>
                    <div className="text-xs text-muted-foreground">{activeItem.role}</div>
                  </div>
                </div>
              ) : activeId?.toString().startsWith('pic-') && activeItem ? (
                 <div className="p-3 bg-white border border-primary ring-4 ring-primary/20 rounded-xl shadow-xl flex items-center gap-3 w-64 opacity-90 scale-105">
                  <div className="bg-amber-50 p-2 rounded-lg text-amber-600"><Truck className="h-4 w-4" /></div>
                  <div>
                    <div className="font-mono font-bold text-sm bg-slate-100 px-1 rounded">{activeItem.plateNumber}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{activeItem.model}</div>
                  </div>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </Layout>

      {/* --- Printable Visual Plan Render (Only visible when printing) --- */}
      <div className="print-only bg-white text-black p-8 font-sans">
        <div className="flex justify-between items-end border-b-2 border-black pb-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold uppercase mb-2">PLAN DE TRAVAIL</h1>
            <h2 className="text-xl font-semibold">{plan.name}</h2>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold mb-1">Client: {plan.clientName}</div>
            <div className="text-md">Date: {format(new Date(plan.date), 'dd/MM/yyyy')}</div>
            <div className="text-sm text-gray-500 mt-2">Statut: {plan.status}</div>
          </div>
        </div>

        <table className="w-full border-collapse border border-black text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-black p-3 text-left w-40">Client</th>
              <th className="border border-black p-3 text-left w-1/2">Signaleurs / Employés</th>
              <th className="border border-black p-3 text-left w-1/2">Véhicules / Pick-ups</th>
              <th className="border border-black p-3 text-left w-48">Signature / Note</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 15 }).map((_, i) => {
              const pos = i + 1;
              const a = assignments[pos];
              const emp = a?.employeeId ? employees?.find(e => e.id === a.employeeId) : null;
              const pic = a?.pickupId ? pickups?.find(p => p.id === a.pickupId) : null;
              
              if (!emp && !pic && pos > 5) return null; // Don't print empty rows beyond 5
              
              return (
                <tr key={pos} className="h-16">
                  <td className="border border-black p-2 font-semibold text-sm">{plan.clientName}</td>
                  <td className="border border-black p-2">
                    {emp ? (
                      <div className="font-semibold text-base">{emp.firstName} {emp.lastName} <span className="text-gray-500 text-xs font-normal">({emp.role || 'Signaleur'})</span></div>
                    ) : <div className="text-gray-300 italic">Vide</div>}
                  </td>
                  <td className="border border-black p-2">
                    {pic ? (
                      <div>
                        <span className="font-mono font-bold border border-gray-400 px-1 rounded mr-2">{pic.plateNumber}</span>
                        <span>{pic.model || pic.brand}</span>
                      </div>
                    ) : <div className="text-gray-300 italic">Vide</div>}
                  </td>
                  <td className="border border-black p-2"></td>
                </tr>
              )
            })}
          </tbody>
        </table>
        
        <div className="mt-12 pt-8 border-t border-gray-300 flex justify-between text-xs text-gray-500">
          <div>Généré par PlanifPro le {format(new Date(), 'dd/MM/yyyy HH:mm')}</div>
          <div>Page 1/1</div>
        </div>
      </div>
    </>
  );
}
