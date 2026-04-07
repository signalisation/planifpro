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

export function ExcelImport({ type, onImport, buttonLabel }: ExcelImportProps) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
        const parsedData = utils.sheet_to_json(ws);
        
        if (parsedData.length === 0) {
          throw new Error("Le fichier est vide.");
        }

        // Map data based on type
        const mappedData = parsedData.map((row: any) => {
          if (type === "employees") {
            return {
              firstName: row["Prénom"] || row["Prenom"] || row["First Name"] || "Inconnu",
              lastName: row["Nom"] || row["Last Name"] || "Inconnu",
              role: row["Rôle"] || row["Role"] || row["Fonction"] || "Signaleur",
              department: row["Département"] || row["Department"] || "",
              phone: row["Téléphone"] || row["Telephone"] || row["Phone"] ? String(row["Téléphone"] || row["Telephone"] || row["Phone"]) : undefined,
              email: row["Email"] || row["Courriel"] || undefined,
              employeeNumber: row["Matricule"] || row["Numéro"] ? String(row["Matricule"] || row["Numéro"]) : undefined,
              status: "active"
            };
          } else {
            return {
              unitNumber: row["Unit"] || row["Unité"] || row["Numéro"] || row["unitNumber"] ? String(row["Unit"] || row["Unité"] || row["Numéro"] || row["unitNumber"]) : undefined,
              plateNumber: row["Plaque"] || row["Immatriculation"] || row["Plate"] ? String(row["Plaque"] || row["Immatriculation"] || row["Plate"]) : undefined,
              model: row["Modèle"] || row["Model"] || undefined,
              brand: row["Marque"] || row["Brand"] || undefined,
              year: row["Année"] || row["Year"] ? parseInt(row["Année"] || row["Year"]) : undefined,
              capacity: row["Capacité"] || row["Capacity"] ? parseInt(row["Capacité"] || row["Capacity"]) : 2,
              status: "available",
              color: row["Couleur"] || row["Color"] || undefined
            };
          }
        });

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
    <Dialog open={open} onOpenChange={(val) => {
      setOpen(val);
      if (!val) resetState();
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 bg-white hover:bg-slate-50">
          <FileSpreadsheet className="h-4 w-4 text-green-600" />
          {buttonLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Importation Excel</DialogTitle>
          <DialogDescription>
            Téléchargez un fichier Excel (.xlsx, .csv) contenant les données à importer.
            {type === "employees" ? " (Colonnes attendues: Prénom, Nom, Rôle, Téléphone...)" : " (Colonnes attendues: Unit, Plaque, Marque, Modèle, Année...)"}
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
                <Check className="h-5 w-5" />
                <span className="font-medium">{data.length} enregistrements trouvés prêts à être importés.</span>
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
                          <TableHead>Téléphone</TableHead>
                        </>
                      ) : (
                        <>
                          <TableHead>Unité</TableHead>
                          <TableHead>Plaque</TableHead>
                          <TableHead>Marque</TableHead>
                          <TableHead>Modèle</TableHead>
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
                            <TableCell>{row.phone}</TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell className="font-medium font-mono">{row.unitNumber ?? "—"}</TableCell>
                            <TableCell className="font-mono text-sm text-muted-foreground">{row.plateNumber ?? "—"}</TableCell>
                            <TableCell>{row.brand}</TableCell>
                            <TableCell>{row.model}</TableCell>
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
