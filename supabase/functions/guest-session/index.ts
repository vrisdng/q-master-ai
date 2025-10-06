import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GUEST_EMAIL_DOMAIN = "guest.qmaster.local";
const GUEST_QUOTAS = { documents: 2, studySets: 2 } as const;
const GUEST_TTL_DAYS = 7;

const json = (status: number, body: Record<string, unknown>, extraHeaders: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extraHeaders },
  });

const generateSecret = () => {
  const raw = crypto.randomUUID().replace(/-/g, "");
  return raw.slice(0, 24);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing Supabase configuration for guest session");
      return json(500, { error: "Server misconfigured" });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const secret = generateSecret();
    const email = `guest-${crypto.randomUUID()}@${GUEST_EMAIL_DOMAIN}`;

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password: secret,
      email_confirm: true,
      user_metadata: {
        isGuest: true,
      },
      app_metadata: {
        provider: "guest",
      },
    });

    if (createError || !created?.user) {
      console.error("Failed to create guest user", createError);
      return json(500, { error: "Unable to create guest session" });
    }

    const guestUser = created.user;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + GUEST_TTL_DAYS * 24 * 60 * 60 * 1000);

    const metadataPayload = {
      role: "guest",
      guest: {
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        quota: GUEST_QUOTAS,
      },
    };

    const { error: profileError } = await admin.from("profiles").upsert({
      id: guestUser.id,
      username: null,
      display_name: "Guest",
      avatar_url: null,
      metadata: metadataPayload,
    });

    if (profileError) {
      console.error("Failed to upsert guest profile", profileError);
      await admin.auth.admin.deleteUser(guestUser.id);
      return json(500, { error: "Unable to prepare guest profile" });
    }

    const { error: roleError } = await admin.from("user_roles").insert({
      user_id: guestUser.id,
      role: "guest",
    });

    if (roleError) {
      console.error("Failed to assign guest role", roleError);
      await admin.auth.admin.deleteUser(guestUser.id);
      return json(500, { error: "Unable to assign guest role" });
    }

    return json(200, {
      userId: guestUser.id,
      email,
      secret,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      quotas: GUEST_QUOTAS,
    });
  } catch (error) {
    console.error("Guest session error", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return json(500, { error: message });
  }
});
