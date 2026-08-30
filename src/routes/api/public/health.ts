import { createFileRoute } from "@tanstack/react-router";

/**
 * presence-only environment check. reports booleans, never values, so it is
 * safe to call on a published deployment. use it to confirm a self hosted
 * deploy (vercel) has the server side variables the app needs.
 */
function present(name: string) {
  const value = process.env[name];
  return typeof value === "string" && value.length > 0;
}

export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () => {
        const env = {
          LOVABLE_API_KEY: present("LOVABLE_API_KEY"),
          SUPABASE_URL: present("SUPABASE_URL"),
          SUPABASE_PUBLISHABLE_KEY: present("SUPABASE_PUBLISHABLE_KEY"),
          SUPABASE_SERVICE_ROLE_KEY: present("SUPABASE_SERVICE_ROLE_KEY"),
          SUPABASE_PROJECT_ID: present("SUPABASE_PROJECT_ID"),
          GOOGLE_MAPS_API_KEY: present("GOOGLE_MAPS_API_KEY"),
          VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY: present(
            "VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY",
          ),
          RESEND_API_KEY: present("RESEND_API_KEY"),
        };

        const required = [
          "LOVABLE_API_KEY",
          "SUPABASE_URL",
          "SUPABASE_PUBLISHABLE_KEY",
          "SUPABASE_SERVICE_ROLE_KEY",
        ] as const;
        const missing = required.filter((name) => !env[name]);

        return Response.json(
          { ok: missing.length === 0, missing, env },
          { headers: { "cache-control": "no-store" } },
        );
      },
    },
  },
});
