import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const url = new URL(req.url);
  const courtGroupId = url.searchParams.get("court");

  // Redirect target — set via `supabase secrets set` in production
  const appUrl =
    Deno.env.get("APP_URL") || "http://localhost:5173";

  if (!courtGroupId) {
    return Response.redirect(`${appUrl}/join`, 302);
  }

  // Validate UUID format before querying
  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(courtGroupId)) {
    return Response.redirect(`${appUrl}/join`, 302);
  }

  // Verify the court group exists (optional — could skip for speed)
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data } = await supabase
    .from("court_groups")
    .select("id")
    .eq("id", courtGroupId)
    .single();

  if (!data) {
    // Court doesn't exist — redirect to join page without court context
    return Response.redirect(`${appUrl}/join`, 302);
  }

  return Response.redirect(`${appUrl}/join?court=${courtGroupId}`, 302);
});
