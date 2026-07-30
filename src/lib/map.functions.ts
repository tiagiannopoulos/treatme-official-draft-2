import { createServerFn } from "@tanstack/react-start";

/**
 * hands the browser the mapbox public token, read from a server secret.
 * the token never lands in the client bundle at build time.
 */
export const getMapboxToken = createServerFn({ method: "GET" }).handler(async () => {
  const token =
    process.env.MAPBOX_PUBLIC_TOKEN ??
    process.env.MAPBOX_PUBLISHABLE_TOKEN ??
    process.env.LOVABLE_CONNECTOR_MAPBOX_PUBLIC_TOKEN ??
    null;
  return { token: token && token.startsWith("pk.") ? token : null };
});
