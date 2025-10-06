import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type ProfileRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
};

type DocumentRow = {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  source_type: string;
  storage_path: string | null;
  status: string;
  page_count: number | null;
  content_sha: string | null;
  metadata: Json;
  folder_id: string | null;
  created_at: string;
  updated_at: string;
};

type FolderRow = {
  id: string;
  owner_id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

type StudySetRow = {
  id: string;
  owner_id: string | null;
  title: string;
  created_at: string;
  source_type: string;
  source_url: string | null;
  text: string;
  topics: string[] | null;
  config: Json;
  source_document_id: string | null;
  folder_id: string | null;
  label_text: string | null;
  label_color: string | null;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const accessToken = authHeader.replace("Bearer ", "").trim();

  if (!accessToken) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing Supabase environment variables");
      return new Response(
        JSON.stringify({ error: "Server misconfiguration" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      console.error("Failed to validate user", userError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const userId = user.id;

    const { data: roleRecord, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ role: "guest" | "user" | "admin" }>();

    if (roleError) {
      console.error("Role lookup error", roleError);
      throw roleError;
    }

    const role = roleRecord?.role ?? "user";

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, metadata, created_at, updated_at")
      .eq("id", userId)
      .maybeSingle<ProfileRow>();

    if (profileError) {
      console.error("Profile fetch error", profileError);
      throw profileError;
    }

    if (!profile) {
      return new Response(
        JSON.stringify({ error: "Profile not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: documents, error: documentsError } = await supabase
      .from("documents")
      .select(
        [
          "id",
          "owner_id",
          "title",
          "description",
          "source_type",
          "storage_path",
          "status",
          "page_count",
          "content_sha",
          "metadata",
          "folder_id",
          "created_at",
          "updated_at",
        ].join(","),
      )
      .eq("owner_id", userId)
      .order("created_at", { ascending: false })
      .returns<DocumentRow[]>();

    if (documentsError) {
      console.error("Documents fetch error", documentsError);
      throw documentsError;
    }

    const { data: studySets, error: studySetsError } = await supabase
      .from("study_sets")
      .select(
        [
          "id",
          "owner_id",
          "title",
          "created_at",
          "source_type",
          "source_url",
          "text",
          "topics",
          "config",
          "source_document_id",
          "folder_id",
          "label_text",
          "label_color",
        ].join(","),
      )
      .eq("owner_id", userId)
      .order("created_at", { ascending: false })
      .returns<StudySetRow[]>();

    if (studySetsError) {
      console.error("Study sets fetch error", studySetsError);
      throw studySetsError;
    }

    let folders: FolderRow[] = [];
    const { data: foldersData, error: foldersError } = await supabase
      .from("folders")
      .select("id, owner_id, name, created_at, updated_at")
      .eq("owner_id", userId)
      .order("created_at", { ascending: true })
      .returns<FolderRow[]>();

    if (foldersError) {
      // If the folders table has not been created yet, surface a warning but allow the rest of the
      // profile payload to load so the UI continues to function.
      const errorMessage = typeof foldersError.message === "string" ? foldersError.message : "";
      if (errorMessage.includes("relation") && errorMessage.includes("folders")) {
        console.warn("Folders table unavailable; returning empty folders list.", foldersError);
      } else {
        console.error("Folders fetch error", foldersError);
        throw foldersError;
      }
    } else if (foldersData) {
      folders = foldersData;
    }

    const responsePayload = {
      profile: {
        id: profile.id,
        username: profile.username,
        displayName: profile.display_name,
        avatarUrl: profile.avatar_url,
        metadata: profile.metadata,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at,
        role,
      },
      documents: (documents ?? []).map((doc) => ({
        id: doc.id,
        ownerId: doc.owner_id,
        title: doc.title,
        description: doc.description,
        sourceType: doc.source_type,
        storagePath: doc.storage_path,
        status: doc.status,
        pageCount: doc.page_count,
        contentSha: doc.content_sha,
        metadata: doc.metadata,
        folderId: doc.folder_id,
        createdAt: doc.created_at,
        updatedAt: doc.updated_at,
      })),
      folders: folders.map((folder) => ({
        id: folder.id,
        ownerId: folder.owner_id,
        name: folder.name,
        createdAt: folder.created_at,
        updatedAt: folder.updated_at,
      })),
      studySets: (studySets ?? []).map((set) => ({
        id: set.id,
        ownerId: set.owner_id,
        title: set.title,
        createdAt: set.created_at,
        sourceType: set.source_type,
        sourceUrl: set.source_url,
        text: set.text,
        topics: set.topics,
        config: set.config,
        sourceDocumentId: set.source_document_id,
        folderId: set.folder_id,
        labelText: set.label_text,
        labelColor: set.label_color,
      })),
      capabilities: {
        role,
        canUseStudyModes: role !== "guest",
        quotas: role === "guest" ? { documents: 2, studySets: 2 } : null,
      },
    };

    return new Response(
      JSON.stringify(responsePayload),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Get profile error", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
