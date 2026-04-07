import { useState, useEffect, useRef } from "react";
import { useRoute, Link } from "wouter";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  useDraggable, useDroppable, pointerWithin
} from "@dnd-kit/core";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent,
  DropdownMenuSubTrigger, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import {
  useGetPlan, useListEmployees, useListPickups, useListClients,
  useSavePlanAssignments, useUpdatePlan
} from "@workspace/api-client-react";
import {
  Printer, Save, Check, User, Truck, GripVertical,
  CalendarDays, Building2, X, Plus, Trash2, MoreHorizontal,
  ArrowRight, ExternalLink, Clock, Pencil
} from "lucide-react";
import type { Employee, Pickup, Client } from "@workspace/api-client-react/src/generated/api.schemas";

// ---- Types ----
interface ClientBlock {
  uid: string;
  clientId: number;
  clientName: string;
  empIds: number[];
  picIds: number[];
  startDate?: string;  // "YYYY-MM-DD"
  startTime?: string;  // "HH:mm"
  endDate?: string;
  endTime?: string;
}

// ---- Draggable Cards ----
function DraggableEmployee({ employee }: { employee: Employee }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `emp-${employee.id}`,
    data: { type: 'employee', item: employee }
  });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes}
      className={`px-2.5 py-2 bg-white border border-slate-200 rounded-lg shadow-sm flex items-center gap-2 cursor-grab hover:border-primary/50 transition-colors ${isDragging ? 'opacity-40 ring-2 ring-primary' : ''}`}>
      <div className="bg-blue-50 p-1.5 rounded-md text-blue-600 shrink-0"><User className="h-3.5 w-3.5" /></div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-xs truncate">{employee.firstName} {employee.lastName}</div>
        <div className="text-[10px] text-muted-foreground">{employee.role || 'Signaleur'}</div>
      </div>
      <GripVertical className="h-3.5 w-3.5 text-slate-300 shrink-0" />
    </div>
  );
}

function DraggablePickup({ pickup }: { pickup: Pickup }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `pic-${pickup.id}`,
    data: { type: 'pickup', item: pickup }
  });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes}
      className={`px-2.5 py-2 bg-white border border-slate-200 rounded-lg shadow-sm flex items-center gap-2 cursor-grab hover:border-primary/50 transition-colors ${isDragging ? 'opacity-40 ring-2 ring-primary' : ''}`}>
      <div className="bg-amber-50 p-1.5 rounded-md text-amber-600 shrink-0"><Truck className="h-3.5 w-3.5" /></div>
      <div className="flex-1 min-w-0">
        <div className="font-mono font-bold text-xs bg-slate-100 px-1 rounded inline-block">{pickup.unitNumber || pickup.plateNumber}</div>
        <div className="text-[10px] text-muted-foreground mt-0.5">{pickup.model || 'Véhicule'}</div>
      </div>
      <GripVertical className="h-3.5 w-3.5 text-slate-300 shrink-0" />
    </div>
  );
}

// ---- Draggable cards INSIDE a block (for drag-out) ----
function DraggableAssignedEmployee({ employee, blockUid, onRemove, onEditDates, otherBlocks, onMove }: {
  employee: Employee; blockUid: string;
  onRemove: () => void; onEditDates: () => void;
  otherBlocks: ClientBlock[]; onMove: (toUid: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `bloc-emp-${blockUid}-${employee.id}`,
    data: { type: 'employee', item: employee, source: 'block', fromBlockUid: blockUid }
  });
  return (
    <div ref={setNodeRef} className={`flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-2 group transition-opacity ${isDragging ? 'opacity-30' : ''}`}>
      <div {...listeners} {...attributes} className="text-blue-300 hover:text-blue-500 cursor-grab shrink-0 touch-none">
        <GripVertical className="h-3.5 w-3.5" />
      </div>
      <div className="bg-blue-100 p-1 rounded text-blue-700 shrink-0"><User className="h-3.5 w-3.5" /></div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-xs text-blue-900 truncate">{employee.firstName} {employee.lastName}</div>
        <div className="text-[10px] text-blue-700/70">{employee.role || 'Signaleur'}</div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="text-blue-300 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 p-0.5 rounded hover:bg-blue-100">
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem asChild>
            <Link href={`/personnel/${employee.id}`} className="flex items-center gap-2 cursor-pointer">
              <ExternalLink className="h-3.5 w-3.5" /> Voir la fiche
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onEditDates} className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5" /> Modifier les dates
          </DropdownMenuItem>
          {otherBlocks.length > 0 && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="flex items-center gap-2">
                <ArrowRight className="h-3.5 w-3.5" /> Déplacer vers
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {otherBlocks.map(b => (
                  <DropdownMenuItem key={b.uid} onClick={() => onMove(b.uid)}>
                    <Building2 className="h-3.5 w-3.5 mr-2 text-primary" />{b.clientName}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onRemove} className="text-red-600 focus:text-red-600">
            <X className="h-3.5 w-3.5 mr-2" /> Retirer du bloc
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function DraggableAssignedPickup({ pickup, blockUid, onRemove, onEditDates, otherBlocks, onMove }: {
  pickup: Pickup; blockUid: string;
  onRemove: () => void; onEditDates: () => void;
  otherBlocks: ClientBlock[]; onMove: (toUid: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `bloc-pic-${blockUid}-${pickup.id}`,
    data: { type: 'pickup', item: pickup, source: 'block', fromBlockUid: blockUid }
  });
  return (
    <div ref={setNodeRef} className={`flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-2 group transition-opacity ${isDragging ? 'opacity-30' : ''}`}>
      <div {...listeners} {...attributes} className="text-amber-300 hover:text-amber-500 cursor-grab shrink-0 touch-none">
        <GripVertical className="h-3.5 w-3.5" />
      </div>
      <div className="bg-amber-100 p-1 rounded text-amber-700 shrink-0"><Truck className="h-3.5 w-3.5" /></div>
      <div className="flex-1 min-w-0">
        <div className="font-mono font-bold text-xs bg-white border border-amber-200 text-amber-900 px-1 rounded inline-block">{pickup.unitNumber || pickup.plateNumber}</div>
        <div className="text-[10px] text-amber-700/70 mt-0.5">{pickup.model || pickup.brand}</div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="text-amber-300 hover:text-amber-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 p-0.5 rounded hover:bg-amber-100">
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem asChild>
            <Link href={`/vehicules/${pickup.id}`} className="flex items-center gap-2 cursor-pointer">
              <ExternalLink className="h-3.5 w-3.5" /> Voir la fiche
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onEditDates} className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5" /> Modifier les dates
          </DropdownMenuItem>
          {otherBlocks.length > 0 && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="flex items-center gap-2">
                <ArrowRight className="h-3.5 w-3.5" /> Déplacer vers
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {otherBlocks.map(b => (
                  <DropdownMenuItem key={b.uid} onClick={() => onMove(b.uid)}>
                    <Building2 className="h-3.5 w-3.5 mr-2 text-primary" />{b.clientName}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onRemove} className="text-red-600 focus:text-red-600">
            <X className="h-3.5 w-3.5 mr-2" /> Retirer du bloc
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ---- Remove drop zone (appears in sidebar when dragging from a block) ----
function RemoveZone({ visible }: { visible: boolean }) {
  const { isOver, setNodeRef } = useDroppable({ id: 'remove-zone' });
  if (!visible) return null;
  return (
    <div ref={setNodeRef}
      className={`mx-3 my-2 border-2 border-dashed rounded-xl flex items-center justify-center gap-2 py-4 transition-all ${isOver ? 'border-red-500 bg-red-50 text-red-600 scale-[1.02]' : 'border-slate-300 text-slate-400'}`}>
      <X className={`h-4 w-4 ${isOver ? 'text-red-500' : 'text-slate-400'}`} />
      <span className="text-xs font-medium">{isOver ? 'Relâcher pour retirer' : 'Déposer ici pour retirer'}</span>
    </div>
  );
}

// ---- Single Client Block ----
function ClientBlockCard({
  block, employees, pickups, allBlocks,
  onRemoveEmployee, onRemovePickup, onRemoveBlock,
  onMoveEmployee, onMovePickup, onEditDates,
}: {
  block: ClientBlock;
  employees: Employee[];
  pickups: Pickup[];
  allBlocks: ClientBlock[];
  onRemoveEmployee: (uid: string, id: number) => void;
  onRemovePickup: (uid: string, id: number) => void;
  onRemoveBlock: (uid: string) => void;
  onMoveEmployee: (fromUid: string, toUid: string, id: number) => void;
  onMovePickup: (fromUid: string, toUid: string, id: number) => void;
  onEditDates: (uid: string) => void;
}) {
  const empZoneId = `drop-emp-${block.uid}`;
  const picZoneId = `drop-pic-${block.uid}`;
  const { isOver: isOverEmp, setNodeRef: setEmpRef } = useDroppable({ id: empZoneId, data: { zone: 'employees', uid: block.uid } });
  const { isOver: isOverPic, setNodeRef: setPicRef } = useDroppable({ id: picZoneId, data: { zone: 'pickups', uid: block.uid } });

  const assignedEmps = block.empIds.map(id => employees.find(e => e.id === id)).filter(Boolean) as Employee[];
  const assignedPics = block.picIds.map(id => pickups.find(p => p.id === id)).filter(Boolean) as Pickup[];
  const otherBlocks = allBlocks.filter(b => b.uid !== block.uid);

  return (
    <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
      {/* Column headers */}
      <div className="grid grid-cols-[160px_1fr_1fr] divide-x divide-border border-b border-border bg-slate-50/60">
        <div className="px-3 py-2 flex items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="text-xs font-semibold text-foreground">Client</span>
        </div>
        <div className="px-3 py-2 flex items-center gap-1.5">
          <User className="h-3.5 w-3.5 text-blue-600 shrink-0" />
          <span className="text-xs font-semibold text-foreground">Signaleurs</span>
        </div>
        <div className="px-3 py-2 flex items-center gap-1.5">
          <Truck className="h-3.5 w-3.5 text-amber-600 shrink-0" />
          <span className="text-xs font-semibold text-foreground">Véhicules</span>
          <button onClick={() => onRemoveBlock(block.uid)} className="ml-auto text-slate-300 hover:text-red-500 transition-colors p-0.5 rounded" title="Supprimer ce bloc">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[160px_1fr_1fr] divide-x divide-border min-h-[160px]">
        {/* Client Column */}
        <div className="p-3 flex flex-col items-start bg-primary/3">
          <div className="bg-primary/10 p-1.5 rounded-lg text-primary mb-2">
            <Building2 className="h-4 w-4" />
          </div>
          <div className="font-display font-bold text-sm text-foreground leading-tight">{block.clientName}</div>
          {/* Date/time info */}
          <div className="mt-2 w-full">
            {(block.startDate || block.endDate) ? (
              <div className="text-[10px] text-slate-600 space-y-0.5">
                {block.startDate && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-2.5 w-2.5 text-green-600 shrink-0" />
                    <span className="font-semibold text-green-700">Début :</span>
                    <span>{new Date(block.startDate + 'T00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}{block.startTime ? ` ${block.startTime}` : ''}</span>
                  </div>
                )}
                {block.endDate && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-2.5 w-2.5 text-red-500 shrink-0" />
                    <span className="font-semibold text-red-600">Fin :</span>
                    <span>{new Date(block.endDate + 'T00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}{block.endTime ? ` ${block.endTime}` : ''}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-[10px] text-slate-400 italic">Aucune date fixée</div>
            )}
            <button onClick={() => onEditDates(block.uid)} className="mt-1.5 flex items-center gap-1 text-[10px] text-primary/70 hover:text-primary transition-colors">
              <Pencil className="h-2.5 w-2.5" /> Modifier les dates
            </button>
          </div>
          <div className="mt-2 flex flex-col gap-1 w-full">
            <div className="flex items-center gap-1.5 text-[10px] text-blue-700 bg-blue-50 rounded px-2 py-1">
              <User className="h-3 w-3 shrink-0" />
              <span className="font-semibold">{assignedEmps.length} signaleur{assignedEmps.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-amber-700 bg-amber-50 rounded px-2 py-1">
              <Truck className="h-3 w-3 shrink-0" />
              <span className="font-semibold">{assignedPics.length} véhicule{assignedPics.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>

        <div className="contents">
          {/* Employees Drop Zone */}
          <div ref={setEmpRef} className={`p-3 flex flex-col gap-2 transition-colors ${isOverEmp ? 'bg-blue-50/60' : 'bg-slate-50/30'}`}>
            {assignedEmps.map(emp => (
              <DraggableAssignedEmployee
                key={emp.id}
                employee={emp}
                blockUid={block.uid}
                onRemove={() => onRemoveEmployee(block.uid, emp.id!)}
                onEditDates={() => onEditDates(block.uid)}
                otherBlocks={otherBlocks}
                onMove={(toUid) => onMoveEmployee(block.uid, toUid, emp.id!)}
              />
            ))}
            <div className={`flex-1 min-h-[56px] flex flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors ${isOverEmp ? 'border-blue-400 bg-blue-100/50' : 'border-slate-200'}`}>
              <Plus className={`h-4 w-4 mb-0.5 ${isOverEmp ? 'text-blue-500' : 'text-slate-300'}`} />
              <span className={`text-[10px] ${isOverEmp ? 'text-blue-600 font-semibold' : 'text-slate-400 italic'}`}>
                {isOverEmp ? 'Déposez ici' : 'Glissez un signaleur ici'}
              </span>
            </div>
          </div>

          {/* Pickups Drop Zone */}
          <div ref={setPicRef} className={`p-3 flex flex-col gap-2 transition-colors ${isOverPic ? 'bg-amber-50/60' : 'bg-slate-50/10'}`}>
            {assignedPics.map(pic => (
              <DraggableAssignedPickup
                key={pic.id}
                pickup={pic}
                blockUid={block.uid}
                onRemove={() => onRemovePickup(block.uid, pic.id!)}
                onEditDates={() => onEditDates(block.uid)}
                otherBlocks={otherBlocks}
                onMove={(toUid) => onMovePickup(block.uid, toUid, pic.id!)}
              />
            ))}
            <div className={`flex-1 min-h-[56px] flex flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors ${isOverPic ? 'border-amber-400 bg-amber-100/50' : 'border-slate-200'}`}>
              <Plus className={`h-4 w-4 mb-0.5 ${isOverPic ? 'text-amber-500' : 'text-slate-300'}`} />
              <span className={`text-[10px] ${isOverPic ? 'text-amber-600 font-semibold' : 'text-slate-400 italic'}`}>
                {isOverPic ? 'Déposez ici' : 'Glissez un véhicule ici'}
              </span>
            </div>
          </div>
        </div>{/* end contents */}
      </div>{/* end grid */}
    </div>
  );
}

// ---- Add Client Picker ----
function AddClientPicker({ clients, usedClientIds, onAdd }: {
  clients: Client[];
  usedClientIds: number[];
  onAdd: (client: Client) => void;
}) {
  const [open, setOpen] = useState(false);
  const available = clients.filter(c => !usedClientIds.includes(c.id!));

  if (available.length === 0) return null;

  return (
    <div className="relative">
      <Button variant="outline" onClick={() => setOpen(v => !v)} className="gap-2 border-dashed border-primary/50 text-primary hover:bg-primary/5">
        <Plus className="h-4 w-4" /> Ajouter un client
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-2 z-20 bg-white border border-border rounded-xl shadow-xl min-w-[220px] overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border bg-slate-50 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Choisir un client
            </div>
            {available.map(c => (
              <button
                key={c.id}
                onClick={() => { onAdd(c); setOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
              >
                <div className="bg-primary/10 p-1.5 rounded-lg text-primary shrink-0"><Building2 className="h-4 w-4" /></div>
                <span className="font-semibold text-sm text-foreground">{c.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---- Main Page ----
let _uidCounter = 0;
const genUid = () => `block-${++_uidCounter}`;

export default function PlanDetailPage() {
  const [, params] = useRoute("/plans/:id");
  const planId = parseInt(params?.id || "0", 10);
  const { toast } = useToast();

  const { data: plan, isLoading: loadingPlan } = useGetPlan(planId);
  const { data: employees } = useListEmployees();
  const { data: pickups } = useListPickups();
  const { data: clients } = useListClients();

  const saveMutation = useSavePlanAssignments();
  const updateMutation = useUpdatePlan();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeItem, setActiveItem] = useState<any>(null);
  const [clientBlocks, setClientBlocks] = useState<ClientBlock[]>([]);
  const [isSaved, setIsSaved] = useState(true);
  const hasLoadedRef = useRef(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1-second ticker → forces isBlockActive to re-evaluate every second
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Per-block date/time editing dialog
  const [dateDialogOpen, setDateDialogOpen] = useState(false);
  const [editingBlockUid, setEditingBlockUid] = useState<string | null>(null);
  const [editStartDate, setEditStartDate] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editEndTime, setEditEndTime] = useState('');

  // Busy resources from other plans on the same date
  const { data: busyResources, refetch: refetchBusy } = useQuery<{ busyEmpIds: number[]; busyPicIds: number[] }>({
    queryKey: ['/api/plans/busy-resources', plan?.date, planId],
    queryFn: async () => {
      if (!plan?.date) return { busyEmpIds: [], busyPicIds: [] };
      // Send current local date+time so server comparison is timezone-aware
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const clientNow = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
      const r = await fetch(`/api/plans/busy-resources?date=${plan.date}&excludePlanId=${planId}&clientNow=${encodeURIComponent(clientNow)}`);
      return r.json();
    },
    enabled: !!plan?.date,
    refetchInterval: 30_000,
  });

  // Load assignments from DB on mount
  useEffect(() => {
    if (!plan || !clients) return;

    if (plan.assignments && plan.assignments.length > 0) {
      // Sort by position to maintain block order
      const sorted = [...plan.assignments].sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0));
      // Group by block index (bi = Math.floor(position / 200))
      const blocksByIdx = new Map<number, ClientBlock>();
      sorted.forEach((a: any) => {
        const pos: number = a.position ?? 0;
        const bi = Math.floor(pos / 200);
        const localPos = pos % 200;
        const cid: number = a.clientId ?? plan.clientId;
        if (!blocksByIdx.has(bi)) {
          const clientName = clients?.find((c: any) => c.id === cid)?.name ?? plan.clientName ?? '';
          blocksByIdx.set(bi, { uid: genUid(), clientId: cid, clientName, empIds: [], picIds: [] });
        }
        const blk = blocksByIdx.get(bi)!;
        // position 0 in block = metadata (dates stored in notes as JSON)
        if (localPos === 0 && a.notes) {
          try {
            const meta = JSON.parse(a.notes);
            blk.startDate = meta.sd ?? '';
            blk.startTime = meta.st ?? '';
            blk.endDate = meta.ed ?? '';
            blk.endTime = meta.et ?? '';
          } catch {}
        } else {
          if (a.employeeId) blk.empIds.push(a.employeeId);
          if (a.pickupId) blk.picIds.push(a.pickupId);
        }
      });
      setClientBlocks(Array.from(blocksByIdx.values()));
    } else {
      // No assignments yet — start with empty blocks
      setClientBlocks([]);
    }
    hasLoadedRef.current = true;
    setIsSaved(true);
  }, [plan?.id, clients]);

  // Auto-save: debounce 1.5s after clientBlocks change, but only after initial DB load
  useEffect(() => {
    if (!hasLoadedRef.current || isSaved) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        const assignments: any[] = [];
        clientBlocks.forEach((blk, bi) => {
          const meta = { sd: blk.startDate ?? '', st: blk.startTime ?? '', ed: blk.endDate ?? '', et: blk.endTime ?? '' };
          assignments.push({ clientId: blk.clientId, position: bi * 200, notes: JSON.stringify(meta) });
          blk.empIds.forEach((id, i) => assignments.push({ clientId: blk.clientId, position: bi * 200 + i + 1, employeeId: id }));
          blk.picIds.forEach((id, i) => assignments.push({ clientId: blk.clientId, position: bi * 200 + 101 + i, pickupId: id }));
        });
        await saveMutation.mutateAsync({ id: planId, data: { assignments } });
        setIsSaved(true);
      } catch {
        // silent — user can still save manually
      }
    }, 1500);
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, [clientBlocks, isSaved]);

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
    const source = active.data.current?.source as string | undefined;
    const fromBlockUid = active.data.current?.fromBlockUid as string | undefined;
    const zone = over.data.current?.zone as string | undefined;
    const uid = over.data.current?.uid as string | undefined;
    if (!type || !itemId) return;

    // Drop on remove zone → remove from block
    if (over.id === 'remove-zone' && source === 'block' && fromBlockUid) {
      if (type === 'employee') handleRemoveEmployee(fromBlockUid, itemId);
      if (type === 'pickup') handleRemovePickup(fromBlockUid, itemId);
      return;
    }

    if (!uid || !zone) return;

    // Dragging FROM a block → move between blocks (not same block)
    if (source === 'block' && fromBlockUid && fromBlockUid !== uid) {
      if (type === 'employee') handleMoveEmployee(fromBlockUid, uid, itemId);
      if (type === 'pickup') handleMovePickup(fromBlockUid, uid, itemId);
      return;
    }

    // Dragging FROM sidebar → add to block
    if (source !== 'block') {
      setClientBlocks(prev => prev.map(blk => {
        if (blk.uid !== uid) return blk;
        if (type === 'employee' && zone === 'employees' && !blk.empIds.includes(itemId))
          return { ...blk, empIds: [...blk.empIds, itemId] };
        if (type === 'pickup' && zone === 'pickups' && !blk.picIds.includes(itemId))
          return { ...blk, picIds: [...blk.picIds, itemId] };
        return blk;
      }));
      setIsSaved(false);
    }
  };

  const handleRemoveEmployee = (uid: string, id: number) => {
    setClientBlocks(prev => prev.map(blk => blk.uid === uid ? { ...blk, empIds: blk.empIds.filter(x => x !== id) } : blk));
    setIsSaved(false);
  };

  const handleRemovePickup = (uid: string, id: number) => {
    setClientBlocks(prev => prev.map(blk => blk.uid === uid ? { ...blk, picIds: blk.picIds.filter(x => x !== id) } : blk));
    setIsSaved(false);
  };

  const handleRemoveBlock = (uid: string) => {
    setClientBlocks(prev => prev.filter(blk => blk.uid !== uid));
    setIsSaved(false);
  };

  const handleMoveEmployee = (fromUid: string, toUid: string, id: number) => {
    setClientBlocks(prev => prev.map(blk => {
      if (blk.uid === fromUid) return { ...blk, empIds: blk.empIds.filter(x => x !== id) };
      if (blk.uid === toUid && !blk.empIds.includes(id)) return { ...blk, empIds: [...blk.empIds, id] };
      return blk;
    }));
    setIsSaved(false);
  };

  const handleMovePickup = (fromUid: string, toUid: string, id: number) => {
    setClientBlocks(prev => prev.map(blk => {
      if (blk.uid === fromUid) return { ...blk, picIds: blk.picIds.filter(x => x !== id) };
      if (blk.uid === toUid && !blk.picIds.includes(id)) return { ...blk, picIds: [...blk.picIds, id] };
      return blk;
    }));
    setIsSaved(false);
  };

  const handleAddClient = (client: Client) => {
    setClientBlocks(prev => [...prev, { uid: genUid(), clientId: client.id!, clientName: client.name, empIds: [], picIds: [] }]);
    setIsSaved(false);
  };

  const handleOpenBlockDateDialog = (uid: string) => {
    const blk = clientBlocks.find(b => b.uid === uid);
    if (!blk) return;
    setEditingBlockUid(uid);
    setEditStartDate(blk.startDate ?? plan?.date ?? '');
    setEditStartTime(blk.startTime ?? '');
    setEditEndDate(blk.endDate ?? plan?.date ?? '');
    setEditEndTime(blk.endTime ?? '');
    setDateDialogOpen(true);
  };

  const handleSaveDates = async () => {
    if (!editingBlockUid) return;
    // Build the updated blocks array with the new dates
    const updatedBlocks = clientBlocks.map(blk =>
      blk.uid === editingBlockUid
        ? { ...blk, startDate: editStartDate, startTime: editStartTime, endDate: editEndDate, endTime: editEndTime }
        : blk
    );
    setClientBlocks(updatedBlocks);
    setDateDialogOpen(false);

    // Immediately persist so busy-resources reflects the new dates right away
    try {
      const assignments: any[] = [];
      updatedBlocks.forEach((blk, bi) => {
        const meta = { sd: blk.startDate ?? '', st: blk.startTime ?? '', ed: blk.endDate ?? '', et: blk.endTime ?? '' };
        assignments.push({ clientId: blk.clientId, position: bi * 200, notes: JSON.stringify(meta) });
        blk.empIds.forEach((id, i) => assignments.push({ clientId: blk.clientId, position: bi * 200 + i + 1, employeeId: id }));
        blk.picIds.forEach((id, i) => assignments.push({ clientId: blk.clientId, position: bi * 200 + 101 + i, pickupId: id }));
      });
      await saveMutation.mutateAsync({ id: planId, data: { assignments } });
      setIsSaved(true);
      toast({ title: "Dates enregistrées" });
      refetchBusy();
    } catch {
      setIsSaved(false);
      toast({ title: "Dates mises à jour — pensez à sauvegarder le plan", variant: "destructive" });
    }
  };

  const handleSave = async () => {
    try {
      const assignments: any[] = [];
      clientBlocks.forEach((blk, bi) => {
        // position bi*200 = block metadata (dates)
        const meta = { sd: blk.startDate ?? '', st: blk.startTime ?? '', ed: blk.endDate ?? '', et: blk.endTime ?? '' };
        assignments.push({ clientId: blk.clientId, position: bi * 200, notes: JSON.stringify(meta) });
        blk.empIds.forEach((id, i) => assignments.push({ clientId: blk.clientId, position: bi * 200 + i + 1, employeeId: id }));
        blk.picIds.forEach((id, i) => assignments.push({ clientId: blk.clientId, position: bi * 200 + 101 + i, pickupId: id }));
      });
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
    return <Layout><div className="flex h-[50vh] items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div></Layout>;
  }
  if (!plan) return <Layout><div>Plan introuvable</div></Layout>;

  // Determine if a block's time window is still active (not yet expired)
  // Expired blocks release their resources back to the disponibles panel
  const isBlockActive = (blk: ClientBlock): boolean => {
    if (!blk.endDate) return true; // no end date → treat as ongoing
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
    const nowTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    if (blk.endDate > todayStr) return true;  // ends after today → active
    if (blk.endDate < todayStr) return false; // ended before today → expired
    // ends today → compare times (>= because we keep busy through the end minute)
    if (!blk.endTime) return true;
    return blk.endTime >= nowTime;
  };

  // Only count resources from ACTIVE blocks as "used" — expired blocks release their resources
  const activeBlocks = clientBlocks.filter(isBlockActive);
  const allUsedEmpIds = activeBlocks.flatMap(b => b.empIds);
  const allUsedPicIds = activeBlocks.flatMap(b => b.picIds);
  const busyEmpIds = busyResources?.busyEmpIds ?? [];
  const busyPicIds = busyResources?.busyPicIds ?? [];
  const availableEmployees = employees?.filter(e =>
    e.status === 'active' && !allUsedEmpIds.includes(e.id!) && !busyEmpIds.includes(e.id!)
  ) || [];
  const availablePickups = pickups?.filter(p =>
    p.status === 'available' && !allUsedPicIds.includes(p.id!) && !busyPicIds.includes(p.id!)
  ) || [];
  const usedClientIds = clientBlocks.map(b => b.clientId);
  const isDraggingFromBlock = activeId?.startsWith('bloc-') ?? false;
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
                <div className="flex items-center gap-6 text-sm text-muted-foreground font-medium flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="h-4 w-4" />
                    {format(new Date(plan.date + 'T12:00:00'), 'EEEE d MMMM yyyy', { locale: fr })}
                  </span>
                  <span className="text-xs text-slate-400 italic">Les dates d'intervention se définissent par bloc client</span>
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
                  <p className="text-xs text-muted-foreground mt-1">
                    {isDraggingFromBlock ? 'Déposez sur la zone rouge pour retirer' : 'Glissez vers un bloc client'}
                  </p>
                </div>
                <RemoveZone visible={isDraggingFromBlock} />
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

              {/* Right: Client Blocks */}
              <div className="flex-1 overflow-auto space-y-4 pb-4">
                {clientBlocks.map(blk => (
                  <ClientBlockCard
                    key={blk.uid}
                    block={blk}
                    employees={employees || []}
                    pickups={pickups || []}
                    allBlocks={clientBlocks}
                    onRemoveEmployee={handleRemoveEmployee}
                    onRemovePickup={handleRemovePickup}
                    onRemoveBlock={handleRemoveBlock}
                    onMoveEmployee={handleMoveEmployee}
                    onMovePickup={handleMovePickup}
                    onEditDates={handleOpenBlockDateDialog}
                  />
                ))}

                {/* Add Client Button */}
                <div className="flex items-center gap-4 pt-2">
                  <AddClientPicker
                    clients={clients || []}
                    usedClientIds={usedClientIds}
                    onAdd={handleAddClient}
                  />
                  {clientBlocks.length === 0 && (
                    <p className="text-sm text-muted-foreground italic">Aucun bloc client. Ajoutez-en un pour commencer.</p>
                  )}
                </div>
              </div>
            </div>

            <DragOverlay>
              {activeItem && (activeId?.startsWith('emp-') || activeId?.startsWith('bloc-emp-')) ? (
                <div className="p-3 bg-white border border-primary ring-4 ring-primary/20 rounded-xl shadow-xl flex items-center gap-3 w-60 opacity-90">
                  <div className="bg-blue-50 p-2 rounded-lg text-blue-600"><User className="h-4 w-4" /></div>
                  <div><div className="font-semibold text-sm">{activeItem.firstName} {activeItem.lastName}</div><div className="text-xs text-muted-foreground">{activeItem.role}</div></div>
                </div>
              ) : activeItem && (activeId?.startsWith('pic-') || activeId?.startsWith('bloc-pic-')) ? (
                <div className="p-3 bg-white border border-primary ring-4 ring-primary/20 rounded-xl shadow-xl flex items-center gap-3 w-60 opacity-90">
                  <div className="bg-amber-50 p-2 rounded-lg text-amber-600"><Truck className="h-4 w-4" /></div>
                  <div><div className="font-mono font-bold text-sm bg-slate-100 px-1 rounded">{activeItem.unitNumber || activeItem.plateNumber}</div><div className="text-xs text-muted-foreground mt-0.5">{activeItem.model}</div></div>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </Layout>

      {/* ---- Printable Plan ---- */}
      <div className="print-only bg-white text-black p-8 font-sans">
        <div className="flex justify-between items-end border-b-2 border-black pb-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold uppercase mb-2">PLAN DE TRAVAIL</h1>
            <h2 className="text-xl font-semibold">{plan.name}</h2>
          </div>
          <div className="text-right">
            <div className="text-md">Date : {format(new Date(plan.date + 'T12:00:00'), 'dd/MM/yyyy')}</div>
            <div className="text-sm text-gray-500 mt-1">Statut : {plan.status === 'confirmed' ? 'Confirmé' : 'Brouillon'}</div>
          </div>
        </div>

        <table className="w-full border-collapse border border-black text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-black p-3 text-left w-40">Client</th>
              <th className="border border-black p-3 text-left">Signaleurs</th>
              <th className="border border-black p-3 text-left">Véhicules</th>
              <th className="border border-black p-3 text-left w-36">Signature</th>
            </tr>
          </thead>
          <tbody>
            {clientBlocks.map(blk => {
              const emps = blk.empIds.map(id => employees?.find(e => e.id === id)).filter(Boolean) as Employee[];
              const pics = blk.picIds.map(id => pickups?.find(p => p.id === id)).filter(Boolean) as Pickup[];
              const rowCount = Math.max(emps.length, pics.length, 1);
              return Array.from({ length: rowCount }).map((_, i) => (
                <tr key={`${blk.uid}-${i}`} className="h-14">
                  {i === 0 && (
                    <td className="border border-black p-3 align-middle" rowSpan={rowCount}>
                      <div className="font-bold">{blk.clientName}</div>
                      {(blk.startDate || blk.endDate) && (
                        <div className="text-xs text-gray-600 mt-1 space-y-0.5">
                          {blk.startDate && <div>Début : {new Date(blk.startDate + 'T00:00').toLocaleDateString('fr-FR')}{blk.startTime ? ` ${blk.startTime}` : ''}</div>}
                          {blk.endDate && <div>Fin : {new Date(blk.endDate + 'T00:00').toLocaleDateString('fr-FR')}{blk.endTime ? ` ${blk.endTime}` : ''}</div>}
                        </div>
                      )}
                    </td>
                  )}
                  <td className="border border-black p-3">
                    {emps[i] ? (
                      <span className="font-semibold">{emps[i].firstName} {emps[i].lastName} <span className="font-normal text-gray-500">({emps[i].role || 'Signaleur'})</span></span>
                    ) : <span className="text-gray-300 italic">—</span>}
                  </td>
                  <td className="border border-black p-3">
                    {pics[i] ? (
                      <span><span className="font-mono font-bold border border-gray-400 px-1 rounded mr-2">{pics[i].unitNumber || pics[i].plateNumber}</span>{pics[i].model || pics[i].brand}</span>
                    ) : <span className="text-gray-300 italic">—</span>}
                  </td>
                  <td className="border border-black p-3"></td>
                </tr>
              ));
            })}
          </tbody>
        </table>

        <div className="mt-12 pt-6 border-t border-gray-300 flex justify-between text-xs text-gray-500">
          <div>Généré par PlanifPro le {format(new Date(), 'dd/MM/yyyy HH:mm')}</div>
          <div>Page 1/1</div>
        </div>
      </div>

      {/* Per-Block Date/Time Edit Dialog */}
      <Dialog open={dateDialogOpen} onOpenChange={setDateDialogOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Dates d'intervention — {clientBlocks.find(b => b.uid === editingBlockUid)?.clientName ?? ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-2">
            {/* Début */}
            <div className="bg-green-50 border border-green-100 rounded-xl p-4 space-y-3">
              <div className="text-xs font-bold text-green-700 uppercase tracking-wide">Début d'intervention</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Date de début</label>
                  <Input type="date" value={editStartDate} onChange={e => setEditStartDate(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Heure de début</label>
                  <Input type="time" value={editStartTime} onChange={e => setEditStartTime(e.target.value)} placeholder="08:00" />
                </div>
              </div>
            </div>
            {/* Fin */}
            <div className="bg-red-50 border border-red-100 rounded-xl p-4 space-y-3">
              <div className="text-xs font-bold text-red-600 uppercase tracking-wide">Fin d'intervention</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Date de fin</label>
                  <Input type="date" value={editEndDate} onChange={e => setEditEndDate(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Heure de fin</label>
                  <Input type="time" value={editEndTime} onChange={e => setEditEndTime(e.target.value)} placeholder="17:00" />
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Les dates seront enregistrées immédiatement et les ressources de ce bloc seront libérées après l'heure de fin.
            </p>
          </div>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setDateDialogOpen(false)} disabled={saveMutation.isPending}>Annuler</Button>
            <Button onClick={handleSaveDates} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <><div className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full mr-2" />Enregistrement...</> : 'Appliquer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
