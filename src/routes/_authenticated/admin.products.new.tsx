import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ProductEditor } from "@/components/admin/product-editor";

export const Route = createFileRoute("/_authenticated/admin/products/new")({
  component: NewProduct,
});

function NewProduct() {
  const navigate = useNavigate();
  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-4">New product</h1>
      <ProductEditor
        initial={null}
        onSaved={(id) => navigate({ to: "/admin/products/$id", params: { id } })}
      />
    </div>
  );
}
