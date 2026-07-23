import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/account")({
  component: AccountLayout,
});

function AccountLayout() {
  return <Outlet />;
}
