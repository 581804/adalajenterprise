import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { adminGetProduct } from "@/integrations/mongodb/product.functions";
import { ProductEditor } from "@/components/admin/product-editor";

export const Route = createFileRoute("/_authenticated/admin/products/$id")({
  component: EditProduct,
});

function EditProduct() {
  const { id } = Route.useParams();
  const isNew = id === "new";

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "product", id],
    enabled: !isNew,
    queryFn: () => adminGetProduct({ data: { id } }),
  });

  if (!isNew && isLoading) return <p>Loading…</p>;
  if (!isNew && !data) return <p>Not found</p>;

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-4">{isNew ? "New product" : "Edit product"}</h1>
      <ProductEditor initial={isNew ? undefined : (data as any)} />
    </div>
  );
}
