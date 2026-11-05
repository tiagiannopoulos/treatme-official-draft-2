import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/muse/")({
  component: () => <Navigate to="/muse/scan" replace />,
});
