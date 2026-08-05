import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Papa from "papaparse";
import { toast } from "sonner";
import {
  adminImportPincodeBatch,
  adminPincodeStats,
  adminDeleteAllPincodes,
  adminExportPincodePage,
} from "@/integrations/mongodb/pincode.functions";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, Download, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/pincodes")({
  component: AdminPincodes,
});

const BATCH_SIZE = 2000;
const EXPORT_PAGE_SIZE = 5000;

function AdminPincodes() {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importTotal, setImportTotal] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const { data: stats } = useQuery({
    queryKey: ["admin", "pincode-stats"],
    queryFn: () => adminPincodeStats(),
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    importFile(file);
    e.target.value = ""; // allow re-selecting the same file later
  };

  const importFile = (file: File) => {
    setImporting(true);
    setImportProgress(0);
    setImportTotal(0);

    let batch: any[] = [];
    let processedRows = 0;
    let upsertedTotal = 0;
    let hadError = false;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      // Streams row-by-row rather than loading the whole parsed result into
      // memory at once — matters at 165k+ rows, especially on a phone or
      // lower-memory machine running the admin panel.
      chunk: async (results, parser) => {
        parser.pause();
        batch.push(...(results.data as any[]));
        if (batch.length >= BATCH_SIZE) {
          const toSend = batch.splice(0, BATCH_SIZE);
          try {
            const result = await adminImportPincodeBatch({ data: { rows: toSend } });
            upsertedTotal += result.upserted + result.modified;
          } catch (err: any) {
            hadError = true;
            toast.error(`Import batch failed: ${err.message}`);
            parser.abort();
            return;
          }
        }
        processedRows += (results.data as any[]).length;
        setImportProgress(processedRows);
        parser.resume();
      },
      complete: async () => {
        if (!hadError && batch.length > 0) {
          try {
            const result = await adminImportPincodeBatch({ data: { rows: batch } });
            upsertedTotal += result.upserted + result.modified;
          } catch (err: any) {
            hadError = true;
            toast.error(`Final batch failed: ${err.message}`);
          }
        }
        setImporting(false);
        if (!hadError) {
          toast.success(`Import complete — ${upsertedTotal} offices created/updated`);
          qc.invalidateQueries({ queryKey: ["admin", "pincode-stats"] });
        }
      },
      error: (err) => {
        setImporting(false);
        toast.error(`CSV parse error: ${err.message}`);
      },
    });
  };

  const handleExport = async () => {
    setExporting(true);
    setExportProgress(0);
    try {
      const allRows: any[] = [];
      let skip = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const page = await adminExportPincodePage({ data: { skip, limit: EXPORT_PAGE_SIZE } });
        if (page.length === 0) break;
        allRows.push(...page);
        skip += EXPORT_PAGE_SIZE;
        setExportProgress(allRows.length);
        if (page.length < EXPORT_PAGE_SIZE) break;
      }
      const csv = Papa.unparse(allRows);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pincode-export-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${allRows.length} offices`);
    } catch (err: any) {
      toast.error(`Export failed: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm(`Delete all ${stats?.totalOffices ?? 0} pincode office records? This can't be undone — re-import the CSV to restore.`)) return;
    try {
      const result = await adminDeleteAllPincodes();
      toast.success(`Deleted ${result.deleted} records`);
      qc.invalidateQueries({ queryKey: ["admin", "pincode-stats"] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Pincode data</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Powers pincode-based address autofill at checkout and in the account address book.
          Import the India Post office dataset (data.gov.in format) as a CSV.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Office records</div>
          <div className="text-2xl font-bold mt-1">{stats?.totalOffices?.toLocaleString() ?? "—"}</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Distinct pincodes</div>
          <div className="text-2xl font-bold mt-1">{stats?.distinctPincodes?.toLocaleString() ?? "—"}</div>
        </div>
      </div>

      <div className="border rounded-lg p-4 space-y-3">
        <h2 className="font-semibold">Import</h2>
        <p className="text-xs text-muted-foreground">
          Expected columns: circlename, regionname, divisionname, officename, pincode, officetype,
          delivery, district, statename, latitude, longitude. Existing offices (matched by pincode +
          office name) are updated in place — safe to re-run with a refreshed dataset.
        </p>
        <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileSelect} />
        <Button onClick={() => fileInputRef.current?.click()} disabled={importing}>
          <Upload className="h-4 w-4 mr-2" />
          {importing ? "Importing…" : "Choose CSV file"}
        </Button>
        {importing ? (
          <div className="space-y-1">
            <Progress value={importTotal ? (importProgress / importTotal) * 100 : undefined} />
            <p className="text-xs text-muted-foreground">{importProgress.toLocaleString()} rows processed…</p>
          </div>
        ) : null}
      </div>

      <div className="border rounded-lg p-4 space-y-3">
        <h2 className="font-semibold">Export</h2>
        <p className="text-xs text-muted-foreground">Downloads the current pincode data as a CSV in the same format it was imported in.</p>
        <Button variant="outline" onClick={handleExport} disabled={exporting || !stats?.totalOffices}>
          <Download className="h-4 w-4 mr-2" />
          {exporting ? `Exporting… (${exportProgress.toLocaleString()})` : "Export to CSV"}
        </Button>
      </div>

      <div className="border rounded-lg p-4 space-y-3 border-destructive/30">
        <h2 className="font-semibold text-destructive">Danger zone</h2>
        <Button variant="destructive" size="sm" onClick={handleDeleteAll} disabled={!stats?.totalOffices}>
          <Trash2 className="h-4 w-4 mr-2" />Delete all pincode data
        </Button>
      </div>
    </div>
  );
}
