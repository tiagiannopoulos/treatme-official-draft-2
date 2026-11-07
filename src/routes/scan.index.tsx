import { createFileRoute, Navigate } from "@tanstack/react-router";

/** All consumer scan entry points use the same three-photo Muse journey. */
export const Route = createFileRoute("/scan/")({
  component: () => <Navigate to="/muse/scan" search={{ mode: "general" }} replace />,
});
