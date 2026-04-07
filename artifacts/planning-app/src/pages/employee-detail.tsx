import { useRoute, Link } from "wouter";
import { Layout } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useListEmployees } from "@workspace/api-client-react";
import {
  User, Phone, Mail, Hash, Building2, Briefcase,
  ArrowLeft, CheckCircle2, XCircle, Loader2
} from "lucide-react";

export default function EmployeeDetailPage() {
  const [, params] = useRoute("/personnel/:id");
  const empId = parseInt(params?.id || "0", 10);
  const { data: employees, isLoading } = useListEmployees();

  const emp = employees?.find(e => e.id === empId);

  if (isLoading) {
    return (
      <Layout>
        <div className="flex h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!emp) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto mt-12 text-center">
          <p className="text-muted-foreground text-lg">Employé introuvable.</p>
          <Button asChild variant="outline" className="mt-4 gap-2">
            <Link href="/employees"><ArrowLeft className="h-4 w-4" /> Retour au personnel</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  const initials = `${emp.firstName.charAt(0)}${emp.lastName.charAt(0)}`.toUpperCase();
  const isActive = emp.status === 'active';

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Back */}
        <div>
          <Button asChild variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground -ml-2">
            <Link href="/employees"><ArrowLeft className="h-4 w-4" /> Retour au personnel</Link>
          </Button>
        </div>

        {/* Header card */}
        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
          <div className="h-24 bg-gradient-to-r from-blue-500 to-blue-600" />
          <div className="px-8 pb-8">
            <div className="flex items-end gap-5 -mt-10 mb-6">
              <div className="h-20 w-20 rounded-2xl bg-white border-4 border-white shadow-lg flex items-center justify-center text-blue-600 font-bold text-2xl shrink-0">
                {initials}
              </div>
              <div className="pb-1">
                <h1 className="text-2xl font-display font-bold text-foreground">
                  {emp.firstName} {emp.lastName}
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-muted-foreground text-sm">{emp.role || 'Signaleur'}</span>
                  <Badge
                    className={`text-xs shadow-none ${isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}
                  >
                    {isActive ? (
                      <><CheckCircle2 className="h-3 w-3 mr-1" /> Actif</>
                    ) : (
                      <><XCircle className="h-3 w-3 mr-1" /> Inactif</>
                    )}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {emp.employeeNumber && (
                <InfoRow icon={<Hash className="h-4 w-4 text-slate-500" />} label="Matricule" value={emp.employeeNumber} />
              )}
              {emp.department && (
                <InfoRow icon={<Building2 className="h-4 w-4 text-slate-500" />} label="Département" value={emp.department} />
              )}
              {emp.role && (
                <InfoRow icon={<Briefcase className="h-4 w-4 text-slate-500" />} label="Rôle" value={emp.role} />
              )}
              {emp.phone && (
                <InfoRow icon={<Phone className="h-4 w-4 text-slate-500" />} label="Téléphone" value={emp.phone} mono />
              )}
              {emp.email && (
                <InfoRow icon={<Mail className="h-4 w-4 text-slate-500" />} label="Courriel" value={emp.email} />
              )}
            </div>

            {!emp.employeeNumber && !emp.department && !emp.phone && !emp.email && (
              <p className="text-muted-foreground text-sm italic mt-2">Aucune information supplémentaire renseignée.</p>
            )}
          </div>
        </div>

        {/* Status banner */}
        <div className={`rounded-xl px-5 py-4 border flex items-center gap-3 ${isActive ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-200'}`}>
          {isActive
            ? <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            : <XCircle className="h-5 w-5 text-slate-400 shrink-0" />
          }
          <div>
            <p className={`font-semibold text-sm ${isActive ? 'text-emerald-800' : 'text-slate-600'}`}>
              {isActive ? 'Employé actif' : 'Employé inactif'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isActive
                ? 'Disponible pour être assigné à des plans d\'intervention.'
                : 'Non disponible pour les plans. Modifiez son statut dans la liste du personnel.'}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button asChild variant="outline" className="gap-2">
            <Link href="/employees">
              <User className="h-4 w-4" /> Gérer le personnel
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
