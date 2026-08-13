import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminListPages, adminCreatePage, adminUpdatePage, adminDeletePage } from "@/integrations/mongodb/page.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { slugify } from "@/lib/format";
import { SanitizedHtml } from "@/components/sanitized-html";
import { Plus, Trash2, Pencil } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/pages")({
  component: AdminPages,
});

function AdminPages() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ["admin", "pages"],
    queryFn: () => adminListPages(),
  });
  const save = useMutation({
    mutationFn: async (p: any) => {
      const payload = { ...p, slug: p.slug || slugify(p.title) };
      if (p.id) await adminUpdatePage({ data: payload });
      else await adminCreatePage({ data: payload });
    },
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["admin", "pages"] }); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => adminDeletePage({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin", "pages"] }); },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Pages</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button onClick={() => setEditing({ title: "", slug: "", body: "", is_published: true })}><Plus className="h-4 w-4 mr-2" />New page</Button></DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>{editing?.id ? "Edit" : "New"} page</DialogTitle></DialogHeader>
            {editing ? (
              <div className="space-y-3">
                <div><Label>Title</Label><Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></div>
                <div><Label>Slug</Label><Input value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} placeholder="auto" /></div>
                <div>
                  <Label>Body</Label>
                  <Textarea rows={10} value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} />
                  <p className="text-xs text-muted-foreground mt-1">
                    HTML is supported, including inline styles for colors, spacing, alignment, and
                    borders (e.g. &lt;div style="background-color:#f5f5f5;padding:16px;border-radius:8px"&gt;)
                    — good for callout boxes and custom sections. Scripts and unsafe attributes are
                    stripped automatically. Preview below shows exactly what visitors will see.
                  </p>
                  {editing.body ? (
                    <div className="mt-2 border rounded-md p-4 bg-muted/30">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Preview</p>
                      <div className="prose prose-sm max-w-none bg-background rounded p-3">
                        <SanitizedHtml html={editing.body} variant="page" />
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center gap-2"><Switch checked={editing.is_published} onCheckedChange={(v) => setEditing({ ...editing, is_published: v })} /><Label>Published</Label></div>
              </div>
            ) : null}
            <DialogFooter><Button onClick={() => save.mutate(editing)}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="border rounded-lg divide-y">
        {data?.map((p) => (
          <div key={p.id} className="flex justify-between items-center p-3">
            <div><div className="font-medium">{p.title}</div><div className="text-xs text-muted-foreground">/pages/{p.slug} · {p.is_published ? "published" : "draft"}</div></div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" onClick={() => { setEditing(p); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => confirm("Delete?") && del.mutate(p.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
        {!data?.length ? <p className="p-8 text-center text-muted-foreground">No pages yet.</p> : null}
      </div>
    </div>
  );
}
