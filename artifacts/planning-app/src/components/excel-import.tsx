import { useState, useRef } from "react";
import { read, utils } from "xlsx";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileSpreadsheet, Check, AlertCircle, Loader2 } from "lucide-react";

interface ExcelImportProps {
  type: "employees" | "pickups";
  onImport: (data: any[]) => Promise<void>;
  buttonLabel: string;
}

// Known header keywords for each type (lowercase)
const PICKUP_HEADERS = ['unité', 'unite', 'unit', 'plaque', 'immatriculation', 'plate', 'description', 'marque', 'brand', 'modèle', 'model', 'année', 'year', 'capacité', 'fm', '4x4', '4*4'];
const EMPLOYEE_HEADERS = ['prénom', 'prenom', 'first name', 'nom', 'last name', 'rôle', 'role', 'fonction', 'téléphone', 'telephone', 'phone', 'email', 'courriel', 'matricule', 'numéro', 'statut'];

function normalize(s: any): string {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .trim();
}

function findHeaderRow(rawRows: any[][], type: "employees" | "pickups"): number {
  const knownHeaders = type === 'pickups' ? PICKUP_HEADERS : EMPLOYEE_HEADERS;
  let bestIdx = 0;
  let bestScore = 0;
  for (let i = 0; i < Math.min(rawRows.length, 15); i++) {
    const row = rawRows[i] ?? [];
    const score = row.reduce((acc: number, cell: any) => {
      const n = normalize(cell);
      return acc + (knownHeaders.some(h => n === h || n.includes(h) || h.includes(n)) && n.length > 1 ? 1 : 0);
    }, 0);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function parseDescription(desc: string): { brand?: string; model?: string } {
  if (!desc) return {};
  const knownBrands = ['Chevrolet', 'GMC', 'Dodge', 'Ford', 'Toyota', 'RAM', 'Ram', 'International', 'Jeep', 'Nissan', 'Honda', 'Hyundai', 'Kia', 'Volkswagen', 'Mazda', 'Mitsubishi'];
  for (const brand of knownBrands) {
    if (desc.toLowerCase().startsWith(brand.toLowerCase())) {
      return { brand, model: desc.slice(brand.length).trim() || undefined };
    }
  }
  // fallback: first word = brand, rest = model
  const parts = desc.trim().split(/\s+/);
  if (parts.length === 1) return { model: parts[0] };
  return { brand: parts[0], model: parts.slice(1).join(' ') };
}

function col(row: any, ...keys: string[]): string | undefined {
  for (const key of keys) {
    // Try exact match first
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') return String(row[key]);
    // Try case-insensitive + accent-insensitive match
    const nk = normalize(key);
    for (const k of Object.keys(row)) {
      if (normalize(k) === nk && row[k] !== undefined && row[k] !== null && row[k] !== '') {
        return String(row[k]);
      }
    }
  }
  return undefined;
}

function colNum(row: any, ...keys: string[]): number | undefined {
  const v = col(row, ...keys);
  if (!v) return undefined;
  const n = parseInt(v);
  return isNaN(n) ? undefined : n;
}

function mapPickupRow(row: any) {
  const desc = col(row, 'Description', 'description') ?? '';
  const { brand: parsedBrand, model: parsedModel } = parseDescription(desc);

  const unitNumber = col(row, 'Unité', 'Unite', 'Unit', 'unitNumber', 'Numéro d\'unité', 'No Unite', 'No Unité');
  const plateNumber = col(row, 'Plaque', 'Immatriculation', 'Plate', 'No Plaque', 'Plaque d\'immatriculation');
  const brand = col(row, 'Marque', 'Brand') ?? parsedBrand;
  const model = col(row, 'Modèle', 'Model') ?? parsedModel ?? (desc && !brand ? desc : undefined);
  const year = colNum(row, 'Année', 'Annee', 'Year', 'An');
  const capacity = colNum(row, 'Capacité', 'Capacite', 'Capacity', 'Places', 'Cap');
  const color = col(row, 'Couleur', 'Color');

  return { unitNumber, plateNumber, brand, model, year, capacity: capacity ?? 2, status: 'available' as const, color };
}

function mapEmployeeRow(row: any) {
  const firstName = col(row, 'Prénom', 'Prenom', 'First Name', 'Firstname') ?? 'Inconnu';
  const lastName = col(row, 'Nom', 'Last Name', 'Lastname', 'Nom de famille') ?? 'Inconnu';
  const role = col(row, 'Rôle', 'Role', 'Fonction', 'Titre', 'Poste') ?? 'Signaleur';
  const department = col(row, 'Département', 'Departement', 'Department', 'Dept');
  const phone = col(row, 'Téléphone', 'Telephone', 'Phone', 'Tel', 'Cellulaire');
  const email = col(row, 'Email', 'Courriel', 'Mail');
  const employeeNumber = col(row, 'Matricule', 'No Employé', 'No Employe', 'Employee Number', 'Numéro', 'Numero', 'EMP');
  return { firstName, lastName, role, department, phone, email, employeeNumber, status: 'active' as const };
}

export function ExcelImport({ type, onImport, buttonLabel }: ExcelImportProps) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [headerRowFound, setHeaderRowFound] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];

        // Step 1: Read all rows as raw arrays to find the real header row
        const rawRows = utils.sheet_to_json(ws, { header: 1, defval: null }) as any[][];
        if (rawRows.length === 0) throw new Error("Le fichier est vide.");

        // Step 2: Auto-detect the header row
        const headerIdx = findHeaderRow(rawRows, type);
        setHeaderRowFound(headerIdx);

        // Step 3: Re-parse using detected header row
        const parsedData = utils.sheet_to_json(ws, { range: headerIdx, defval: null });
        if (parsedData.length === 0) throw new Error("Aucune donnée trouvée dans le fichier.");

        // Step 4: Map rows
        const mappedData = (parsedData as any[])
          .filter(row => {
            // Skip rows where all values are null/empty
            return Object.values(row).some(v => v !== null && v !== '' && v !== undefined);
          })
          .map(row => type === 'pickups' ? mapPickupRow(row) : mapEmployeeRow(row));

        if (mappedData.length === 0) throw new Error("Aucune ligne valide trouvée.");
        setData(mappedData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur lors de la lecture du fichier");
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleConfirm = async () => {
    setIsUploading(true);
    try {
      await onImport(data);
      setOpen(false);
      setData([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur d'importation");
    } finally {
      setIsUploading(false);
    }
  };

  const resetState = () => {
    setData([]);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) resetState(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 bg-white hover:bg-slate-50">
          <FileSpreadsheet className="h-4 w-4 text-green-600" />
          {buttonLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[750px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Importation Excel</DialogTitle>
          <DialogDescription>
            Téléchargez un fichier Excel (.xlsx, .csv). La ligne d'en-têtes est détectée automatiquement.
            {type === "employees"
              ? " (Colonnes reconnues: Prénom, Nom, Rôle, Téléphone, Matricule...)"
              : " (Colonnes reconnues: Unité, Plaque, Description, Marque, Modèle, Année...)"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto py-4">
          {!data.length && !isProcessing && (
            <div
              className="border-2 border-dashed border-muted-foreground/25 rounded-2xl p-12 flex flex-col items-center justify-center text-center bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="bg-primary/10 p-4 rounded-full mb-4">
                <Upload className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-1">Cliquez pour parcourir</h3>
              <p className="text-sm text-muted-foreground">ou glissez-déposez un fichier ici</p>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileUpload}
              />
            </div>
          )}

          {isProcessing && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary" />
              <p>Analyse du fichier en cours...</p>
            </div>
          )}

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-xl flex items-start gap-3">
              <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
              <div>
                <h4 className="font-semibold">Erreur</h4>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          )}

          {data.length > 0 && !error && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-lg border border-green-200">
                <Check className="h-5 w-5 shrink-0" />
                <span className="font-medium">
                  {data.length} enregistrements trouvés prêts à être importés.
                  {headerRowFound > 0 && (
                    <span className="ml-1 font-normal text-green-600/80 text-sm">
                      (en-tête détecté à la ligne {headerRowFound + 1})
                    </span>
                  )}
                </span>
              </div>

              <div className="border rounded-xl overflow-hidden max-h-[300px] overflow-y-auto">
                <Table>
                  <TableHeader className="bg-muted sticky top-0">
                    <TableRow>
                      {type === "employees" ? (
                        <>
                          <TableHead>Prénom</TableHead>
                          <TableHead>Nom</TableHead>
                          <TableHead>Rôle</TableHead>
                          <TableHead>Matricule</TableHead>
                          <TableHead>Téléphone</TableHead>
                        </>
                      ) : (
                        <>
                          <TableHead>Unité</TableHead>
                          <TableHead>Plaque</TableHead>
                          <TableHead>Marque</TableHead>
                          <TableHead>Modèle</TableHead>
                          <TableHead>Année</TableHead>
                        </>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.slice(0, 10).map((row, i) => (
                      <TableRow key={i}>
                        {type === "employees" ? (
                          <>
                            <TableCell className="font-medium">{row.firstName}</TableCell>
                            <TableCell>{row.lastName}</TableCell>
                            <TableCell>{row.role}</TableCell>
                            <TableCell className="font-mono text-xs">{row.employeeNumber ?? '—'}</TableCell>
                            <TableCell>{row.phone ?? '—'}</TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell className="font-medium font-mono">{row.unitNumber ?? '—'}</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">{row.plateNumber ?? '—'}</TableCell>
                            <TableCell>{row.brand ?? '—'}</TableCell>
                            <TableCell>{row.model ?? '—'}</TableCell>
                            <TableCell>{row.year ?? '—'}</TableCell>
                          </>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {data.length > 10 && (
                <p className="text-center text-sm text-muted-foreground pt-2">
                  Affichage de 10 résultats sur {data.length}...
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isUploading}>Annuler</Button>
          <Button
            onClick={handleConfirm}
            disabled={data.length === 0 || isUploading}
            className="gap-2 shadow-lg shadow-primary/20"
          >
            {isUploading && <Loader2 className="h-4 w-4 animate-spin" />}
            {!isUploading && <Check className="h-4 w-4" />}
            Confirmer l'importation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
