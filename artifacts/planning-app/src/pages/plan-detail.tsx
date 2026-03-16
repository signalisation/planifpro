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
import { Printer, Save, Check, User, Truck, GripVertical, CalendarDays, Building2, X, Plus } from "lucide-react";
import type { Employee, Pickup } from "@workspace/api-client-react/src/generated/api.schemas";

// --- Draggable Employee Card ---
function DraggableEmployee({ employee }: { employee: Employee }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `emp-${employee.id}`,
    data: { type: 'employee', item: employee }
  });
  return (
    <div
      ref={setNodeRef} {...listeners} {...attributes}
      className={`p-3 bg-white border border-slate-200 rounded-xl shadow-sm flex items-center gap-3 cursor-grab hover:border-primary/50 transition-colors ${isDragging ? 'opacity-50 ring-2 ring-primary' : ''}`}
    >
      <div className="bg-blue-50 p-2 rounded-lg text-blue-600"><User className="h-4 w-4" /></div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm truncate">{employee.firstName} {employee.lastName}</div>
        <div className="text-xs text-muted-foreground">{employee.role || 'Signaleur'}</div>
      </div>
      <GripVertical className="h-4 w-4 text-slate-300 shrink-0" />
    </div>
  );
}

// --- Draggable Pickup Card ---
function DraggablePickup({ pickup }: { pickup: Pickup }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `pic-${pickup.id}`,
    data: { type: 'pickup', item: pickup }
  });
  return (
    <div
      ref={setNodeRef} {...listeners} {...attributes}
      className={`p-3 bg-white border border-slate-200 rounded-xl shadow-sm flex items-center gap-3 cursor-grab hover:border-primary/50 transition-colors ${isDragging ? 'opacity-50 ring-2 ring-primary' : ''}`}
    >
      <div className="bg-amber-50 p-2 rounded-lg text-amber-600"><Truck className="h-4 w-4" /></div>
      <div className="flex-1 min-w-0">
        <div className="font-mono font-bold text-sm bg-slate-100 px-1 rounded inline-block">{pickup.plateNumber}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{pickup.model || 'Véhicule'}</div>
      </div>
      <GripVertical className="h-4 w-4 text-slate-300 shrink-0" />
    </div>
  );
}

// --- Client Block (the main grouped drop target) ---
function ClientBlock({
  clientName,
  assignedEmployeeIds,
  assignedPickupIds,
  employees,
  pickups,
  onRemoveEmployee,
  onRemovePickup,
}: {
  clientName: string;
  assignedEmployeeIds: number[];
  assignedPickupIds: number[];
  employees: Employee[];
  pickups: Pickup[];
  onRemoveEmployee: (id: number) => void;
  onRemovePickup: (id: number) => void;
}) {
  const { isOver: isOverEmp, setNodeRef: setEmpRef } = useDroppable({ id: 'drop-employees', data: { zone: 'employees' } });
  const { isOver: isOverPic, setNodeRef: setPicRef } = useDroppable({ id: 'drop-pickups', data: { zone: 'pickups' } });

  const assignedEmps = assignedEmployeeIds.map(id => employees.find(e => e.id === id)).filter(Boolean) as Employee[];
  const assignedPics = assignedPickupIds.map(id => pickups.find(p => p.id === id)).filter(Boolean) as Pickup[];

  return (
    <div className="bg-white border border-border rounded-2xl shadow-sm overflow-hidden">
      {/* Client header */}
      <div className="bg-primary/5 border-b border-border px-6 py-4 flex items-center gap-3">
        <div className="bg-primary/10 p-2 rounded-lg text-primary">
          <Building2 className="h-5 w-5" />
        </div>
        <div>
          <div className="font-display font-bold text-lg text-foreground">{clientName}</div>
          <div className="text-xs text-muted-foreground">Bloc d'affectation — glissez les ressources ci-dessous</div>
        </div>
      </div>

      <div className="grid grid-cols-2 divide-x divide-border min-h-[280px]">
        {/* Employees Drop Zone */}
        <div
          ref={setEmpRef}
          className={`p-5 flex flex-col gap-3 transition-colors ${isOverEmp ? 'bg-blue-50/60' : 'bg-slate-50/30'}`}
        >
          <div className="flex items-center gap-2 mb-1">
            <User className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-semibold text-foreground">Signaleurs / Employés</span>
            <span className="ml-auto text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{assignedEmps.length}</span>
          </div>

          {assignedEmps.map(emp => (
            <div key={emp.id} className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-xl p-3 group">
              <div className="bg-blue-100 p-2 rounded-md text-blue-700 shrink-0"><User className="h-4 w-4" /></div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-blue-900 truncate">{emp.firstName} {emp.lastName}</div>
                <div className="text-xs text-blue-700/70">{emp.role || 'Signaleur'}</div>
              </div>
              <button onClick={() => onRemoveEmployee(emp.id)} className="text-blue-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1 shrink-0">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}

          <div className={`flex-1 min-h-[80px] flex flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors ${isOverEmp ? 'border-blue-400 bg-blue-100/50' : 'border-slate-200'}`}>
            <Plus className={`h-5 w-5 mb-1 ${isOverEmp ? 'text-blue-500' : 'text-slate-300'}`} />
            <span className={`text-xs ${isOverEmp ? 'text-blue-600 font-semibold' : 'text-slate-400 italic'}`}>
              {isOverEmp ? 'Déposez ici' : 'Glissez un employé ici'}
            </span>
          </div>
        </div>

        {/* Pickups Drop Zone */}
        <div
          ref={setPicRef}
          className={`p-5 flex flex-col gap-3 transition-colors ${isOverPic ? 'bg-amber-50/60' : 'bg-slate-50/10'}`}
        >
          <div className="flex items-center gap-2 mb-1">
            <Truck className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-semibold text-foreground">Véhicules / Pick-ups</span>
            <span className="ml-auto text-xs font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{assignedPics.length}</span>
          </div>

          {assignedPics.map(pic => (
            <div key={pic.id} className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-xl p-3 group">
              <div className="bg-amber-100 p-2 rounded-md text-amber-700 shrink-0"><Truck className="h-4 w-4" /></div>
              <div className="flex-1 min-w-0">
                <div className="font-mono font-bold text-sm bg-white border border-amber-200 text-amber-900 px-1 rounded inline-block">{pic.plateNumber}</div>
                <div className="text-xs text-amber-700/70 mt-0.5">{pic.model || pic.brand}</div>
              </div>
              <button onClick={() => onRemovePickup(pic.id)} className="text-amber-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1 shrink-0">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}

          <div className={`flex-1 min-h-[80px] flex flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors ${isOverPic ? 'border-amber-400 bg-amber-100/50' : 'border-slate-200'}`}>
            <Plus className={`h-5 w-5 mb-1 ${isOverPic ? 'text-amber-500' : 'text-slate-300'}`} />
            <span className={`text-xs ${isOverPic ? 'text-amber-600 font-semibold' : 'text-slate-400 italic'}`}>
              {isOverPic ? 'Déposez ici' : 'Glissez un véhicule ici'}
            </span>
          </div>
        </div>
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

  // Flat lists of assigned IDs
  const [assignedEmployeeIds, setAssignedEmployeeIds] = useState<number[]>([]);
  const [assignedPickupIds, setAssignedPickupIds] = useState<number[]>([]);
  const [isSaved, setIsSaved] = useState(true);

  // Load from DB on mount
  useEffect(() => {
    if (plan?.assignments) {
      const empIds: number[] = [];
      const picIds: number[] = [];
      plan.assignments.forEach(a => {
        if (a.employeeId) empIds.push(a.employeeId);
        if (a.pickupId) picIds.push(a.pickupId);
      });
      setAssignedEmployeeIds(empIds);
      setAssignedPickupIds(picIds);
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
    if (!over) return;

    const type = active.data.current?.type;
    const itemId = active.data.current?.item?.id;
    const zone = over.data.current?.zone;

    if (!type || !itemId) return;

    if (type === 'employee' && zone === 'employees') {
      if (!assignedEmployeeIds.includes(itemId)) {
        setAssignedEmployeeIds(prev => [...prev, itemId]);
        setIsSaved(false);
      }
    } else if (type === 'pickup' && zone === 'pickups') {
      if (!assignedPickupIds.includes(itemId)) {
        setAssignedPickupIds(prev => [...prev, itemId]);
        setIsSaved(false);
      }
    }
  };

  const handleRemoveEmployee = (id: number) => {
    setAssignedEmployeeIds(prev => prev.filter(x => x !== id));
    setIsSaved(false);
  };

  const handleRemovePickup = (id: number) => {
    setAssignedPickupIds(prev => prev.filter(x => x !== id));
    setIsSaved(false);
  };

  const handleSave = async () => {
    try {
      // Store employees at positions 1..N, pickups at 101..100+M
      const assignments: any[] = [
        ...assignedEmployeeIds.map((id, i) => ({ position: i + 1, employeeId: id })),
        ...assignedPickupIds.map((id, i) => ({ position: 101 + i, pickupId: id })),
      ];
      await saveMutation.mutateAsync({ id: planId, data: { assignments } });
      setIsSaved(true);
      toast({ title: "Plan sauvegardé avec succès" });
    } catch {
      toast({ title: "Erreur lors de la sauvegarde", variant: "destructive" });
    }
  };

  const handleConfirmPlan = async () => {
    if (!isSaved) await handleSave();
    await updateMutation.mutateAsync({ id: planId, data: { status: 'confirmed' } });
    toast({ title: "Plan confirmé" });
  };

  if (loadingPlan) {
    return <Layout><div className="flex h-[50vh] items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div></div></Layout>;
  }
  if (!plan) return <Layout><div>Plan introuvable</div></Layout>;

  const availableEmployees = employees?.filter(e => e.status === 'active' && !assignedEmployeeIds.includes(e.id!)) || [];
  const availablePickups = pickups?.filter(p => p.status === 'available' && !assignedPickupIds.includes(p.id!)) || [];

  // For printing: pair employees + pickups side by side
  const assignedEmps = assignedEmployeeIds.map(id => employees?.find(e => e.id === id)).filter(Boolean) as Employee[];
  const assignedPics = assignedPickupIds.map(id => pickups?.find(p => p.id === id)).filter(Boolean) as Pickup[];
  const printRowCount = Math.max(assignedEmps.length, assignedPics.length, 1);

  return (
    <>
      <Layout>
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
                  <span className="flex items-center gap-1.5"><Building2 className="h-4 w-4" />{plan.clientName}</span>
                  <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4" />{format(new Date(plan.date), 'EEEE d MMMM yyyy', { locale: fr })}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={() => window.print()} className="gap-2 bg-white">
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

              {/* Left Sidebar */}
              <div className="w-72 bg-card rounded-2xl border border-border shadow-sm flex flex-col overflow-hidden shrink-0">
                <div className="p-4 border-b border-border bg-slate-50/50">
                  <h3 className="font-semibold text-foreground">Ressources disponibles</h3>
                  <p className="text-xs text-muted-foreground mt-1">Glissez vers le bloc client</p>
                </div>
                <Tabs defaultValue="employees" className="flex-1 flex flex-col overflow-hidden">
                  <TabsList className="w-full justify-start rounded-none border-b border-border h-12 bg-transparent p-0">
                    <TabsTrigger value="employees" className="flex-1 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none">
                      <User className="h-4 w-4 mr-1" /> Personnel ({availableEmployees.length})
                    </TabsTrigger>
                    <TabsTrigger value="pickups" className="flex-1 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none">
                      <Truck className="h-4 w-4 mr-1" /> Véhicules ({availablePickups.length})
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="employees" className="flex-1 overflow-auto p-4 m-0 space-y-3 bg-slate-50/30">
                    {availableEmployees.map(emp => <DraggableEmployee key={emp.id} employee={emp} />)}
                    {availableEmployees.length === 0 && <p className="text-center text-muted-foreground text-sm py-6 italic">Tous les employés actifs sont assignés.</p>}
                  </TabsContent>
                  <TabsContent value="pickups" className="flex-1 overflow-auto p-4 m-0 space-y-3 bg-slate-50/30">
                    {availablePickups.map(pic => <DraggablePickup key={pic.id} pickup={pic} />)}
                    {availablePickups.length === 0 && <p className="text-center text-muted-foreground text-sm py-6 italic">Tous les véhicules dispo sont assignés.</p>}
                  </TabsContent>
                </Tabs>
              </div>

              {/* Right: Client Block */}
              <div className="flex-1 overflow-auto">
                <ClientBlock
                  clientName={plan.clientName || ''}
                  assignedEmployeeIds={assignedEmployeeIds}
                  assignedPickupIds={assignedPickupIds}
                  employees={employees || []}
                  pickups={pickups || []}
                  onRemoveEmployee={handleRemoveEmployee}
                  onRemovePickup={handleRemovePickup}
                />
              </div>
            </div>

            <DragOverlay>
              {activeId?.startsWith('emp-') && activeItem ? (
                <div className="p-3 bg-white border border-primary ring-4 ring-primary/20 rounded-xl shadow-xl flex items-center gap-3 w-60 opacity-90">
                  <div className="bg-blue-50 p-2 rounded-lg text-blue-600"><User className="h-4 w-4" /></div>
                  <div><div className="font-semibold text-sm">{activeItem.firstName} {activeItem.lastName}</div><div className="text-xs text-muted-foreground">{activeItem.role}</div></div>
                </div>
              ) : activeId?.startsWith('pic-') && activeItem ? (
                <div className="p-3 bg-white border border-primary ring-4 ring-primary/20 rounded-xl shadow-xl flex items-center gap-3 w-60 opacity-90">
                  <div className="bg-amber-50 p-2 rounded-lg text-amber-600"><Truck className="h-4 w-4" /></div>
                  <div><div className="font-mono font-bold text-sm bg-slate-100 px-1 rounded">{activeItem.plateNumber}</div><div className="text-xs text-muted-foreground mt-0.5">{activeItem.model}</div></div>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </Layout>

      {/* --- Printable Plan --- */}
      <div className="print-only bg-white text-black p-8 font-sans">
        <div className="flex justify-between items-end border-b-2 border-black pb-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold uppercase mb-2">PLAN DE TRAVAIL</h1>
            <h2 className="text-xl font-semibold">{plan.name}</h2>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold mb-1">Client : {plan.clientName}</div>
            <div className="text-md">Date : {format(new Date(plan.date), 'dd/MM/yyyy')}</div>
            <div className="text-sm text-gray-500 mt-1">Statut : {plan.status === 'confirmed' ? 'Confirmé' : 'Brouillon'}</div>
          </div>
        </div>

        <table className="w-full border-collapse border border-black text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-black p-3 text-left w-40">Client</th>
              <th className="border border-black p-3 text-left">Signaleurs / Employés</th>
              <th className="border border-black p-3 text-left">Véhicules / Pick-ups</th>
              <th className="border border-black p-3 text-left w-40">Signature</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: printRowCount }).map((_, i) => {
              const emp = assignedEmps[i];
              const pic = assignedPics[i];
              return (
                <tr key={i} className="h-14">
                  {i === 0 ? (
                    <td className="border border-black p-3 font-bold align-middle" rowSpan={printRowCount}>
                      {plan.clientName}
                    </td>
                  ) : null}
                  <td className="border border-black p-3">
                    {emp ? (
                      <span className="font-semibold">{emp.firstName} {emp.lastName} <span className="font-normal text-gray-500">({emp.role || 'Signaleur'})</span></span>
                    ) : <span className="text-gray-300 italic">—</span>}
                  </td>
                  <td className="border border-black p-3">
                    {pic ? (
                      <span><span className="font-mono font-bold border border-gray-400 px-1 rounded mr-2">{pic.plateNumber}</span>{pic.model || pic.brand}</span>
                    ) : <span className="text-gray-300 italic">—</span>}
                  </td>
                  <td className="border border-black p-3"></td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="mt-12 pt-6 border-t border-gray-300 flex justify-between text-xs text-gray-500">
          <div>Généré par PlanifPro le {format(new Date(), 'dd/MM/yyyy HH:mm')}</div>
          <div>Page 1/1</div>
        </div>
      </div>
    </>
  );
}
