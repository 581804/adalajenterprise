import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminListCategories, adminCreateCategory, adminUpdateCategory, adminDeleteCategory } from "@/integrations/mongodb/category.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { slugify } from "@/lib/format";
import { Plus, Trash2, Pencil } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/categories")({
  component: AdminCategories,
});

function AdminCategories() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);

  const { data: cats } = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: () => adminListCategories(),
  });

  const save = useMutation({
    mutationFn: async (c: any) => {
      const payload = { ...c, slug: c.slug || slugify(c.name), sort_order: Number(c.sort_order) || 0 };
      if (c.id) await adminUpdateCategory({ data: payload });
      else await adminCreateCategory({ data: payload });
    },
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["admin", "categories"] }); setOpen(false); setEditing(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => adminDeleteCategory({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin", "categories"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Categories</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing({ name: "", slug: "", description: "", image_url: "", sort_order: 0, is_active: true })}>
              <Plus className="h-4 w-4 mr-2" />New category
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing?.id ? "Edit" : "New"} category</DialogTitle></DialogHeader>
            {editing ? (
              <div className="space-y-3">
                <div><Label>Name</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
                <div><Label>Slug</Label><Input value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} placeholder="auto" /></div>
                <div><Label>Description</Label><Textarea value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
                <div><Label>Image URL</Label><Input value={editing.image_url ?? ""} onChange={(e) => setEditing({ ...editing, image_url: e.target.value })} /></div>
                <div><Label>Sort order</Label><Input type="number" value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: e.target.value })} /></div>
              </div>
            ) : null}
            <DialogFooter><Button onClick={() => save.mutate(editing)}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="border rounded-lg divide-y">
        {cats?.map((c) => (
          <div key={c.id} className="flex justify-between items-center p-3">
            <div><div className="font-medium">{c.name}</div><div className="text-xs text-muted-foreground">/{c.slug}</div></div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" onClick={() => { setEditing(c); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => confirm("Delete?") && del.mutate(c.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
        {!cats?.length ? <p className="p-8 text-center text-muted-foreground">No categories yet.</p> : null}
      </div>
    </div>
  );
}
