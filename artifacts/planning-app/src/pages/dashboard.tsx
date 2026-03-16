import { useListClients, useListEmployees, useListPickups, useListPlans } from "@workspace/api-client-react";
import { Building2, Users, Truck, CalendarDays, TrendingUp, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { data: clients, isLoading: loadingClients } = useListClients();
  const { data: employees, isLoading: loadingEmployees } = useListEmployees();
  const { data: pickups, isLoading: loadingPickups } = useListPickups();
  const { data: plans, isLoading: loadingPlans } = useListPlans();

  const activePlans = plans?.filter(p => p.status !== 'completed')?.length || 0;

  const stats = [
    { 
      label: "Plans Actifs", 
      value: loadingPlans ? "-" : activePlans, 
      icon: CalendarDays, 
      color: "bg-blue-500", 
      href: "/plans",
      trend: "+2 depuis hier"
    },
    { 
      label: "Personnel", 
      value: loadingEmployees ? "-" : employees?.length || 0, 
      icon: Users, 
      color: "bg-emerald-500", 
      href: "/employees",
      trend: `${employees?.filter(e => e.status === 'active').length || 0} actifs`
    },
    { 
      label: "Véhicules", 
      value: loadingPickups ? "-" : pickups?.length || 0, 
      icon: Truck, 
      color: "bg-amber-500", 
      href: "/pickups",
      trend: `${pickups?.filter(p => p.status === 'available').length || 0} disponibles`
    },
    { 
      label: "Clients", 
      value: loadingClients ? "-" : clients?.length || 0, 
      icon: Building2, 
      color: "bg-purple-500", 
      href: "/clients",
      trend: "Tous les comptes"
    },
  ];

  const recentPlans = plans?.slice(0, 5) || [];

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Bonjour, <span className="text-primary">Admin</span></h1>
            <p className="text-muted-foreground mt-1 text-lg">Voici un résumé de vos activités aujourd'hui.</p>
          </div>
          <Button asChild className="shadow-lg shadow-primary/25 rounded-xl px-6">
            <Link href="/plans">Nouveau Plan</Link>
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, i) => (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              key={stat.label}
            >
              <Link href={stat.href}>
                <div className="bg-card p-6 rounded-2xl border border-border shadow-sm hover:shadow-md hover:border-primary/20 transition-all cursor-pointer group h-full flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-3 rounded-xl text-white ${stat.color} shadow-inner`}>
                      <stat.icon className="h-6 w-6" />
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                  </div>
                  <div className="mt-auto">
                    <h3 className="text-3xl font-display font-bold text-foreground">{stat.value}</h3>
                    <p className="text-muted-foreground font-medium">{stat.label}</p>
                    <div className="flex items-center gap-1.5 mt-4 text-sm text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md w-fit font-medium">
                      <TrendingUp className="h-3.5 w-3.5" />
                      {stat.trend}
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-card rounded-2xl border border-border shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-display font-bold">Plans Récents</h2>
              <Button variant="ghost" asChild className="text-primary">
                <Link href="/plans">Voir tout</Link>
              </Button>
            </div>
            
            {loadingPlans ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground">Chargement...</div>
            ) : recentPlans.length > 0 ? (
              <div className="space-y-4">
                {recentPlans.map(plan => (
                  <div key={plan.id} className="flex items-center justify-between p-4 rounded-xl border border-border bg-slate-50/50 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {plan.clientName?.charAt(0) || 'C'}
                      </div>
                      <div>
                        <h4 className="font-semibold text-foreground">{plan.name}</h4>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{plan.clientName}</span>
                          <span>•</span>
                          <span>{new Date(plan.date).toLocaleDateString('fr-CA')}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        plan.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                        plan.status === 'completed' ? 'bg-slate-100 text-slate-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {plan.status === 'confirmed' ? 'Confirmé' : plan.status === 'completed' ? 'Terminé' : 'Brouillon'}
                      </span>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/plans/${plan.id}`}>Ouvrir</Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-48 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-xl">
                <CalendarDays className="h-8 w-8 mb-2 opacity-20" />
                <p>Aucun plan récent</p>
              </div>
            )}
          </div>

          <div className="bg-gradient-to-br from-slate-900 to-primary rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <CalendarDays className="w-32 h-32" />
            </div>
            <h2 className="text-xl font-display font-bold mb-2 relative z-10">Créer un nouveau plan</h2>
            <p className="text-slate-300 text-sm mb-6 relative z-10 leading-relaxed">
              Associez votre personnel et vos véhicules aux chantiers clients en quelques clics grâce à notre interface glisser-déposer.
            </p>
            <Button className="w-full bg-white text-primary hover:bg-slate-100 font-bold shadow-lg mt-auto relative z-10" asChild>
              <Link href="/plans">Démarrer</Link>
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
