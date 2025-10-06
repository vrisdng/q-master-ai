import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_GUEST_DOCUMENTS = 2;

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type Role = "guest" | "user" | "admin";

const getRole = async (client: ReturnType<typeof createClient>, userId: string): Promise<Role> => {
  const { data, error } = await client
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ role: Role }>();

  if (error) {
    console.error("Role lookup failed", error);
    return "user";
  }

  return (data?.role ?? "user") as Role;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const accessToken = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!accessToken) {
    return json(401, { error: "Unauthorized" });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch (_) {
    return json(400, { error: "Invalid JSON" });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const sourceType = typeof body.sourceType === "string" ? body.sourceType.trim() : "";
  const content = typeof body.content === "string" ? body.content : "";
  const sourceUrl = typeof body.sourceUrl === "string" && body.sourceUrl.trim().length > 0 ? body.sourceUrl.trim() : null;
  const folderId = typeof body.folderId === "string" && body.folderId.trim().length > 0 ? body.folderId.trim() : null;

  if (!title || !sourceType || !content) {
    return json(400, { error: "title, sourceType, and content are required" });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing Supabase environment variables");
      return json(500, { error: "Server misconfigured" });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      return json(401, { error: "Unauthorized" });
    }

    const role = await getRole(supabase, user.id);

    if (role === "guest") {
      const { count, error: countError } = await supabase
        .from("documents")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", user.id);

      if (countError) {
        console.error("Guest quota count failed", countError);
        return json(500, { error: "Unable to check quota" });
      }

      if ((count ?? 0) >= MAX_GUEST_DOCUMENTS) {
        return json(403, {
          error: "Guest quota reached",
          reason: "documents_quota",
          max: MAX_GUEST_DOCUMENTS,
        });
      }
    }

    const { data, error } = await supabase
      .from("documents")
      .insert({
        title,
        source_type: sourceType,
        source_url: sourceUrl,
        owner_id: user.id,
        status: "ready",
        metadata: { content },
        folder_id: folderId,
      })
      .select("id")
      .maybeSingle<{ id: string }>();

    if (error || !data) {
      console.error("Document insert failed", error);
      return json(500, { error: "Failed to create document" });
    }

    return json(200, { id: data.id, role });
  } catch (error) {
    console.error("Create document error", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return json(500, { error: message });
  }
});
