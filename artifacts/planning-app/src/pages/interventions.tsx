import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  BarChart2,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Truck,
  Users,
  XCircle,
} from "lucide-react";

interface ClientStat {
  clientId: number | null;
  clientName: string;
  totalPlans: number;
  confirmedPlans: number;
  draftPlans: number;
  completedPlans: number;
  uniqueEmployees: number;
  uniquePickups: number;
  lastPlanDate: string | null;
  recentPlans: Array<{ id: number; name: string; date: string; status: string }>;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "confirmed")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
        <CheckCircle2 className="h-3 w-3" /> Confirmé
      </span>
    );
  if (status === "completed")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
        <CheckCircle2 className="h-3 w-3" /> Terminé
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
      <Clock className="h-3 w-3" /> Brouillon
    </span>
  );
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr + "T12:00:00").toLocaleDateString("fr-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function InterventionsPage() {
  const { data, isLoading } = useQuery<ClientStat[]>({
    queryKey: ["/api/stats/interventions"],
    queryFn: async () => {
      const res = await fetch("/api/stats/interventions");
      if (!res.ok) throw new Error("Erreur lors du chargement des statistiques");
      return res.json();
    },
  });

  const totalPlans = data?.reduce((s, c) => s + c.totalPlans, 0) ?? 0;
  const totalConfirmed = data?.reduce((s, c) => s + c.confirmedPlans, 0) ?? 0;
  const totalCompleted = data?.reduce((s, c) => s + c.completedPlans, 0) ?? 0;
  const totalClients = data?.filter((c) => c.clientId !== null).length ?? 0;

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
              <BarChart2 className="h-8 w-8 text-primary" />
              Interventions par Client
            </h1>
            <p className="text-muted-foreground mt-1 text-lg">
              Historique des plans et utilisation des ressources par chantier.
            </p>
          </div>
          <Button asChild className="shadow-lg shadow-primary/25 rounded-xl px-6">
            <Link href="/plans">Nouveau Plan</Link>
          </Button>
        </div>

        {/* Summary tiles */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Clients actifs", value: totalClients, icon: Building2, color: "bg-purple-500" },
            { label: "Plans au total", value: totalPlans, icon: FileText, color: "bg-blue-500" },
            { label: "Plans confirmés", value: totalConfirmed, icon: CheckCircle2, color: "bg-emerald-500" },
            { label: "Plans terminés", value: totalCompleted, icon: XCircle, color: "bg-slate-500" },
          ].map((tile, i) => (
            <motion.div
              key={tile.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className="bg-card border border-border rounded-2xl p-5 shadow-sm flex items-center gap-4"
            >
              <div className={`p-3 rounded-xl text-white ${tile.color} shadow-inner`}>
                <tile.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-display font-bold text-foreground">
                  {isLoading ? "—" : tile.value}
                </div>
                <div className="text-sm text-muted-foreground font-medium">{tile.label}</div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Per-client cards */}
        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground">
            Chargement des statistiques…
          </div>
        ) : !data || data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-border rounded-2xl text-muted-foreground">
            <BarChart2 className="h-10 w-10 mb-2 opacity-20" />
            <p>Aucune intervention enregistrée.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {data.map((client, idx) => (
              <motion.div
                key={client.clientId ?? "no-client"}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden"
              >
                {/* Client header */}
                <div className="flex items-center justify-between px-6 py-4 bg-slate-50/60 border-b border-border">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                      {client.clientName.charAt(0)}
                    </div>
                    <div>
                      <h2 className="font-display font-bold text-foreground text-lg leading-tight">
                        {client.clientName}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        Dernier plan : {formatDate(client.lastPlanDate)}
                      </p>
                    </div>
                  </div>
                  {client.clientId && (
                    <Button variant="outline" size="sm" asChild className="gap-1">
                      <Link href={`/clients`}>
                        Voir client <ChevronRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  )}
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x divide-border border-b border-border">
                  {[
                    { label: "Plans total", value: client.totalPlans, icon: FileText },
                    { label: "Confirmés", value: client.confirmedPlans, icon: CheckCircle2 },
                    { label: "Brouillons", value: client.draftPlans, icon: Clock },
                    { label: "Employés", value: client.uniqueEmployees, icon: Users },
                    { label: "Véhicules", value: client.uniquePickups, icon: Truck },
                  ].map((stat) => (
                    <div key={stat.label} className="flex flex-col items-center py-4 px-2 gap-1">
                      <stat.icon className="h-4 w-4 text-muted-foreground mb-1" />
                      <span className="text-2xl font-display font-bold text-foreground">{stat.value}</span>
                      <span className="text-xs text-muted-foreground font-medium">{stat.label}</span>
                    </div>
                  ))}
                </div>

                {/* Recent plans list */}
                <div className="divide-y divide-border">
                  {client.recentPlans.length === 0 ? (
                    <div className="px-6 py-4 text-sm text-muted-foreground">Aucun plan associé.</div>
                  ) : (
                    client.recentPlans.map((plan) => (
                      <div
                        key={plan.id}
                        className="flex items-center justify-between px-6 py-3 hover:bg-slate-50/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div>
                            <span className="font-medium text-foreground text-sm">{plan.name}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              {formatDate(plan.date)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <StatusBadge status={plan.status} />
                          <Button variant="ghost" size="sm" asChild className="h-7 px-3 text-xs">
                            <Link href={`/plans/${plan.id}`}>Ouvrir</Link>
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Bar chart: confirmed vs draft vs completed */}
                {client.totalPlans > 0 && (
                  <div className="px-6 py-3 bg-slate-50/40 border-t border-border">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-muted-foreground font-medium">Répartition des plans</span>
                    </div>
                    <div className="flex h-2.5 rounded-full overflow-hidden gap-0.5">
                      {client.confirmedPlans > 0 && (
                        <div
                          className="bg-emerald-400 rounded-full transition-all"
                          style={{ flex: client.confirmedPlans }}
                          title={`Confirmés: ${client.confirmedPlans}`}
                        />
                      )}
                      {client.draftPlans > 0 && (
                        <div
                          className="bg-amber-400 rounded-full transition-all"
                          style={{ flex: client.draftPlans }}
                          title={`Brouillons: ${client.draftPlans}`}
                        />
                      )}
                      {client.completedPlans > 0 && (
                        <div
                          className="bg-slate-300 rounded-full transition-all"
                          style={{ flex: client.completedPlans }}
                          title={`Terminés: ${client.completedPlans}`}
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1.5">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" /> Confirmés
                      </span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span className="inline-block w-2 h-2 rounded-full bg-amber-400" /> Brouillons
                      </span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span className="inline-block w-2 h-2 rounded-full bg-slate-300" /> Terminés
                      </span>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
