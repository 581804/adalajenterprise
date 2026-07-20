import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ProductEditor } from "@/components/admin/product-editor";

export const Route = createFileRoute("/_authenticated/admin/products/$id")({
  component: EditProduct,
});

function EditProduct() {
  const { id } = Route.useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "product", id],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("*, product_variants(*)").eq("id", id).maybeSingle();
      return data;
    },
  });

  if (isLoading) return <p>Loading…</p>;
  if (!data) return <p>Not found</p>;

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-4">Edit product</h1>
      <ProductEditor initial={data as any} />
    </div>
  );
}
