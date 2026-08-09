import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Papa from "papaparse";
import { toast } from "sonner";
import {
  adminListShippingZones,
  adminCreateShippingZone,
  adminUpdateShippingZone,
  adminDeleteShippingZone,
  adminZonePincodeStats,
  adminImportZonePincodeBatch,
  adminSearchZonePincodes,
  adminRemoveZonePincode,
  adminClearZonePincodes,
  adminExportZonePincodesPage,
} from "@/integrations/mongodb/shipping-zone.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Pencil, MapPin, Upload, Download, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/shipping")({
  component: AdminShipping,
});

const IMPORT_BATCH_SIZE = 2000;
const EXPORT_PAGE_SIZE = 5000;

function AdminShipping() {
  const qc = useQueryClient();
  const [editingZone, setEditingZone] = useState<any | null>(null);
  const [zoneDialogOpen, setZoneDialogOpen] = useState(false);
  const [managingZone, setManagingZone] = useState<any | null>(null);

  const { data: zones } = useQuery({
    queryKey: ["admin", "zones"],
    queryFn: () => adminListShippingZones(),
  });

  const saveZone = useMutation({
    mutationFn: async (z: any) => {
      const payload = { name: z.name, countries: z.countries ?? [], is_active: z.is_active, rates: z.rates ?? [] };
      if (z.id) await adminUpdateShippingZone({ data: { ...payload, id: z.id } });
      else await adminCreateShippingZone({ data: payload });
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["admin", "zones"] });
      setZoneDialogOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteZone = useMutation({
    mutationFn: (id: string) => adminDeleteShippingZone({ data: { id } }),
    onSuccess: () => {
      toast.success("Zone deleted");
      qc.invalidateQueries({ queryKey: ["admin", "zones"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openNewZone = () => {
    setEditingZone({ name: "", countries: [], is_active: true, rates: [] });
    setZoneDialogOpen(true);
  };
  const openEditZone = (z: any) => {
    setEditingZone(JSON.parse(JSON.stringify(z))); // deep copy so cancel doesn't mutate the list in place
    setZoneDialogOpen(true);
  };

  const addRate = () => {
    setEditingZone((z: any) => ({
      ...z,
      rates: [...z.rates, { name: "", price_cents: 0, min_order_cents: 0, free_over_cents: null, estimated_days: "", is_active: true }],
    }));
  };
  const updateRate = (idx: number, patch: any) => {
    setEditingZone((z: any) => ({ ...z, rates: z.rates.map((r: any, i: number) => (i === idx ? { ...r, ...patch } : r)) }));
  };
  const removeRate = (idx: number) => {
    setEditingZone((z: any) => ({ ...z, rates: z.rates.filter((_: any, i: number) => i !== idx) }));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Shipping zones</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create zones for your own regions, set rates manually, and assign pincodes to each zone.
            Checkout matches by the customer's pincode first, falling back to country if unassigned.
          </p>
        </div>
        <Dialog open={zoneDialogOpen} onOpenChange={setZoneDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNewZone}><Plus className="h-4 w-4 mr-2" />New zone</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingZone?.id ? "Edit" : "New"} zone</DialogTitle></DialogHeader>
            {editingZone ? (
              <div className="space-y-4">
                <div><Label>Zone name</Label><Input value={editingZone.name} onChange={(e) => setEditingZone({ ...editingZone, name: e.target.value })} placeholder="e.g. Local, Gujarat, Rest of India" /></div>
                <div className="flex items-center gap-2">
                  <Switch checked={editingZone.is_active} onCheckedChange={(v) => setEditingZone({ ...editingZone, is_active: v })} />
                  <Label>Active</Label>
                </div>
                <div>
                  <Label>Countries (optional fallback)</Label>
                  <Input
                    value={(editingZone.countries ?? []).join(", ")}
                    onChange={(e) => setEditingZone({ ...editingZone, countries: e.target.value.split(",").map((s: string) => s.trim().toUpperCase()).filter(Boolean) })}
                    placeholder="e.g. IN"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Only used as a fallback for pincodes not yet assigned to any zone. Leave blank if this zone is purely pincode-based.</p>
                </div>

                <div className="border-t pt-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <Label>Shipping rates</Label>
                    <Button size="sm" variant="outline" onClick={addRate}><Plus className="h-3 w-3 mr-1" />Add rate</Button>
                  </div>
                  {editingZone.rates.map((r: any, i: number) => (
                    <div key={i} className="border rounded-md p-3 space-y-2">
                      <div className="flex justify-between items-center">
                        <Input className="flex-1 mr-2" placeholder="Rate name (e.g. Standard)" value={r.name} onChange={(e) => updateRate(i, { name: e.target.value })} />
                        <Button variant="ghost" size="icon" onClick={() => removeRate(i)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label className="text-xs">Price (₹)</Label>
                          <Input type="number" step="0.01" value={(r.price_cents ?? 0) / 100} onChange={(e) => updateRate(i, { price_cents: Math.round(Number(e.target.value) * 100) })} />
                        </div>
                        <div>
                          <Label className="text-xs">Free over (₹, optional)</Label>
                          <Input type="number" step="0.01" value={r.free_over_cents != null ? r.free_over_cents / 100 : ""} onChange={(e) => updateRate(i, { free_over_cents: e.target.value === "" ? null : Math.round(Number(e.target.value) * 100) })} />
                        </div>
                        <div>
                          <Label className="text-xs">Est. days</Label>
                          <Input value={r.estimated_days ?? ""} onChange={(e) => updateRate(i, { estimated_days: e.target.value })} placeholder="e.g. 3-5" />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={r.is_active} onCheckedChange={(v) => updateRate(i, { is_active: v })} />
                        <Label className="text-xs">Rate active</Label>
                      </div>
                    </div>
                  ))}
                  {editingZone.rates.length === 0 ? <p className="text-xs text-muted-foreground">No rates yet — add at least one so this zone can actually be used at checkout.</p> : null}
                </div>
              </div>
            ) : null}
            <DialogFooter><Button onClick={() => saveZone.mutate(editingZone)} disabled={saveZone.isPending}>Save zone</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-lg divide-y">
        {zones?.map((z: any) => (
          <div key={z.id} className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium flex items-center gap-2">
                  {z.name}
                  {!z.is_active ? <span className="text-xs text-muted-foreground">(inactive)</span> : null}
                </div>
                <div className="text-xs text-muted-foreground">
                  {z.shipping_rates.length} rate{z.shipping_rates.length === 1 ? "" : "s"}
                  {z.countries.length ? ` · Fallback countries: ${z.countries.join(", ")}` : ""}
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" onClick={() => setManagingZone(z)}><MapPin className="h-4 w-4 mr-1" />Pincodes</Button>
                <Button variant="ghost" size="icon" onClick={() => openEditZone(z)}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Delete zone "${z.name}"? Pincodes assigned to it will become unassigned.`)) deleteZone.mutate(z.id); }}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          </div>
        ))}
        {!zones?.length ? <p className="p-8 text-center text-muted-foreground">No zones yet. Create your first zone above.</p> : null}
      </div>

      {managingZone ? (
        <ZonePincodeManager zone={managingZone} onClose={() => setManagingZone(null)} />
      ) : null}
    </div>
  );
}

function ZonePincodeManager({ zone, onClose }: { zone: any; onClose: () => void }) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [assignedCount, setAssignedCount] = useState(0);
  const [invalidCount, setInvalidCount] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: stats } = useQuery({
    queryKey: ["admin", "zone-pincode-stats", zone.id],
    queryFn: () => adminZonePincodeStats({ data: { zoneId: zone.id } }),
  });

  const { data: searchResults, isFetching: searching } = useQuery({
    queryKey: ["admin", "zone-pincode-search", zone.id, searchQuery],
    queryFn: () => adminSearchZonePincodes({ data: { zoneId: zone.id, query: searchQuery, limit: 50 } }),
  });

  const removePincode = useMutation({
    mutationFn: (pincode: string) => adminRemoveZonePincode({ data: { pincode } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "zone-pincode-search", zone.id] });
      qc.invalidateQueries({ queryKey: ["admin", "zone-pincode-stats", zone.id] });
    },
  });

  const clearAll = async () => {
    if (!confirm(`Remove all ${stats?.count ?? 0} pincodes from "${zone.name}"? This can't be undone.`)) return;
    const result = await adminClearZonePincodes({ data: { zoneId: zone.id } });
    toast.success(`Removed ${result.deleted} pincodes`);
    qc.invalidateQueries({ queryKey: ["admin", "zone-pincode-search", zone.id] });
    qc.invalidateQueries({ queryKey: ["admin", "zone-pincode-stats", zone.id] });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    importFile(file);
    e.target.value = "";
  };

  const importFile = (file: File) => {
    setImporting(true);
    setImportProgress(0);
    setAssignedCount(0);
    setInvalidCount(0);

    let batch: string[] = [];
    let processed = 0;
    let totalAssigned = 0;
    let totalInvalid = 0;

    // header: false — this CSV format is a bare list of pincodes, one per
    // line, no header row and no other columns (unlike the India Post
    // office dataset, which has 11 named columns).
    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      chunk: async (results, parser) => {
        parser.pause();
        for (const row of results.data as string[][]) {
          if (row[0]) batch.push(row[0]);
        }
        if (batch.length >= IMPORT_BATCH_SIZE) {
          const toSend = batch.splice(0, IMPORT_BATCH_SIZE);
          try {
            const result = await adminImportZonePincodeBatch({ data: { zoneId: zone.id, pincodes: toSend } });
            totalAssigned += result.assigned;
            totalInvalid += result.invalid;
          } catch (err: any) {
            toast.error(`Import batch failed: ${err.message}`);
            parser.abort();
            return;
          }
        }
        processed += (results.data as string[][]).length;
        setImportProgress(processed);
        parser.resume();
      },
      complete: async () => {
        if (batch.length > 0) {
          try {
            const result = await adminImportZonePincodeBatch({ data: { zoneId: zone.id, pincodes: batch } });
            totalAssigned += result.assigned;
            totalInvalid += result.invalid;
          } catch (err: any) {
            toast.error(`Final batch failed: ${err.message}`);
          }
        }
        setImporting(false);
        setAssignedCount(totalAssigned);
        setInvalidCount(totalInvalid);
        toast.success(`${totalAssigned} pincodes assigned to "${zone.name}"${totalInvalid ? ` — ${totalInvalid} invalid lines skipped` : ""}`);
        qc.invalidateQueries({ queryKey: ["admin", "zone-pincode-stats", zone.id] });
        qc.invalidateQueries({ queryKey: ["admin", "zone-pincode-search", zone.id] });
      },
      error: (err) => {
        setImporting(false);
        toast.error(`CSV parse error: ${err.message}`);
      },
    });
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const all: string[] = [];
      let skip = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const page = await adminExportZonePincodesPage({ data: { zoneId: zone.id, skip, limit: EXPORT_PAGE_SIZE } });
        if (page.length === 0) break;
        all.push(...page);
        skip += EXPORT_PAGE_SIZE;
        if (page.length < EXPORT_PAGE_SIZE) break;
      }
      const csv = all.join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${zone.name.replace(/\s+/g, "-").toLowerCase()}-pincodes.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${all.length} pincodes`);
    } catch (err: any) {
      toast.error(`Export failed: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Pincodes — {zone.name}</DialogTitle></DialogHeader>
        <Tabs defaultValue="import">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="import">Import / Export</TabsTrigger>
            <TabsTrigger value="browse">Browse ({stats?.count ?? 0})</TabsTrigger>
          </TabsList>

          <TabsContent value="import" className="space-y-4 pt-2">
            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="font-medium text-sm">Import CSV</h3>
              <p className="text-xs text-muted-foreground">
                One 6-digit pincode per line, no header row. A pincode already assigned to a different
                zone will be moved to this one.
              </p>
              <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileSelect} />
              <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={importing}>
                <Upload className="h-4 w-4 mr-2" />
                {importing ? "Importing…" : "Choose CSV file"}
              </Button>
              {importing ? (
                <div className="space-y-1">
                  <Progress value={undefined} />
                  <p className="text-xs text-muted-foreground">{importProgress.toLocaleString()} lines processed…</p>
                </div>
              ) : null}
              {!importing && (assignedCount > 0 || invalidCount > 0) ? (
                <p className="text-xs text-muted-foreground">
                  Last import: {assignedCount} assigned{invalidCount ? `, ${invalidCount} invalid lines skipped` : ""}.
                </p>
              ) : null}
            </div>

            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="font-medium text-sm">Export</h3>
              <Button size="sm" variant="outline" onClick={handleExport} disabled={exporting || !stats?.count}>
                <Download className="h-4 w-4 mr-2" />{exporting ? "Exporting…" : "Export to CSV"}
              </Button>
            </div>

            <div className="border rounded-lg p-4 border-destructive/30">
              <Button size="sm" variant="destructive" onClick={clearAll} disabled={!stats?.count}>
                <Trash2 className="h-4 w-4 mr-2" />Remove all pincodes from this zone
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="browse" className="space-y-3 pt-2">
            <Input placeholder="Search by pincode prefix…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
              {searching ? (
                <p className="p-4 text-sm text-muted-foreground">Searching…</p>
              ) : searchResults?.length ? (
                searchResults.map((pin) => (
                  <div key={pin} className="flex justify-between items-center px-3 py-2 text-sm">
                    <span>{pin}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removePincode.mutate(pin)}><X className="h-3 w-3" /></Button>
                  </div>
                ))
              ) : (
                <p className="p-4 text-sm text-muted-foreground">{searchQuery ? "No matches." : "No pincodes assigned yet — import a CSV."}</p>
              )}
            </div>
            {searchResults?.length === 50 ? <p className="text-xs text-muted-foreground">Showing first 50 — refine your search to narrow further.</p> : null}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
