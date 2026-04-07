import { useRoute, Link } from "wouter";
import { Layout } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useListPickups } from "@workspace/api-client-react";
import {
  Truck, Hash, CalendarDays, Users, Palette,
  ArrowLeft, CheckCircle2, AlertCircle, Wrench, Loader2, Briefcase
} from "lucide-react";

export default function PickupDetailPage() {
  const [, params] = useRoute("/vehicules/:id");
  const picId = parseInt(params?.id || "0", 10);
  const { data: pickups, isLoading } = useListPickups();

  const pickup = pickups?.find(p => p.id === picId);

  if (isLoading) {
    return (
      <Layout>
        <div className="flex h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!pickup) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto mt-12 text-center">
          <p className="text-muted-foreground text-lg">Véhicule introuvable.</p>
          <Button asChild variant="outline" className="mt-4 gap-2">
            <Link href="/pickups"><ArrowLeft className="h-4 w-4" /> Retour à la flotte</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  const statusConfig = {
    available:   { label: 'Disponible',    color: 'bg-emerald-100 text-emerald-700', banner: 'bg-emerald-50 border-emerald-100', icon: <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />, desc: "Ce véhicule peut être assigné à des plans d'intervention." },
    in_use:      { label: 'En service',    color: 'bg-blue-100 text-blue-700',       banner: 'bg-blue-50 border-blue-100',       icon: <Truck className="h-5 w-5 text-blue-600 shrink-0" />,        desc: 'Ce véhicule est actuellement en service.' },
    maintenance: { label: 'Maintenance',   color: 'bg-red-100 text-red-700',         banner: 'bg-red-50 border-red-100',         icon: <Wrench className="h-5 w-5 text-red-500 shrink-0" />,        desc: "Ce véhicule est en maintenance et n'est pas disponible." },
  }[pickup.status] ?? {
    label: pickup.status, color: 'bg-slate-100 text-slate-600',
    banner: 'bg-slate-50 border-slate-200',
    icon: <AlertCircle className="h-5 w-5 text-slate-400 shrink-0" />,
    desc: ''
  };

  const displayName = pickup.unitNumber || pickup.plateNumber || `#${pickup.id}`;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Back */}
        <div>
          <Button asChild variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground -ml-2">
            <Link href="/pickups"><ArrowLeft className="h-4 w-4" /> Retour à la flotte</Link>
          </Button>
        </div>

        {/* Header card */}
        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
          <div className="h-24 bg-gradient-to-r from-amber-400 to-amber-500" />
          <div className="px-8 pb-8">
            <div className="flex items-end gap-5 -mt-10 mb-6">
              <div className="h-20 w-20 rounded-2xl bg-white border-4 border-white shadow-lg flex items-center justify-center text-amber-600 shrink-0">
                <Truck className="h-9 w-9" />
              </div>
              <div className="pb-1">
                <div className="font-mono font-bold text-2xl text-foreground bg-slate-100 px-3 py-1 rounded-lg border border-slate-200 inline-block tracking-wider">
                  {displayName}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-muted-foreground text-sm">{pickup.brand || ''} {pickup.model || 'Véhicule'}</span>
                  <Badge className={`text-xs shadow-none ${statusConfig.color}`}>
                    {statusConfig.label}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {pickup.unitNumber && (
                <InfoRow icon={<Hash className="h-4 w-4 text-slate-500" />} label="Numéro d'unité" value={pickup.unitNumber} mono />
              )}
              {pickup.plateNumber && (
                <InfoRow icon={<Hash className="h-4 w-4 text-slate-500" />} label="Plaque d'immatriculation" value={pickup.plateNumber} mono />
              )}
              {pickup.brand && (
                <InfoRow icon={<Truck className="h-4 w-4 text-slate-500" />} label="Marque" value={pickup.brand} />
              )}
              {pickup.model && (
                <InfoRow icon={<Truck className="h-4 w-4 text-slate-500" />} label="Modèle" value={pickup.model} />
              )}
              {pickup.year && (
                <InfoRow icon={<CalendarDays className="h-4 w-4 text-slate-500" />} label="Année" value={String(pickup.year)} />
              )}
              {pickup.capacity && (
                <InfoRow icon={<Users className="h-4 w-4 text-slate-500" />} label="Capacité" value={`${pickup.capacity} place${pickup.capacity > 1 ? 's' : ''}`} />
              )}
              {pickup.color && (
                <InfoRow icon={<Palette className="h-4 w-4 text-slate-500" />} label="Couleur" value={pickup.color} />
              )}
              <InfoRow icon={<Hash className="h-4 w-4 text-slate-500" />} label="Identifiant système" value={`#${pickup.id}`} mono />
            </div>
          </div>
        </div>

        {/* Status banner */}
        <div className={`rounded-xl px-5 py-4 border flex items-center gap-3 ${statusConfig.banner}`}>
          {statusConfig.icon}
          <div>
            <p className="font-semibold text-sm text-foreground">{statusConfig.label}</p>
            {statusConfig.desc && (
              <p className="text-xs text-muted-foreground mt-0.5">{statusConfig.desc}</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button asChild variant="outline" className="gap-2">
            <Link href="/pickups">
              <Truck className="h-4 w-4" /> Gérer la flotte
            </Link>
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <Link href="/plans">
              <Briefcase className="h-4 w-4" /> Voir les plans
            </Link>
          </Button>
        </div>
      </div>
    </Layout>
  );
}

function InfoRow({ icon, label, value, mono }: { icon: React.ReactNode; label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-3 bg-slate-50 rounded-xl px-4 py-3">
      <div className="shrink-0 mt-0.5">{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground font-medium mb-0.5">{label}</p>
        <p className={`text-sm font-semibold text-foreground ${mono ? 'font-mono' : ''}`}>{value}</p>
      </div>
    </div>
  );
}
