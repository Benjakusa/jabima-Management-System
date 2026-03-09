import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization")!;
    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) throw new Error("Unauthorized");

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) throw new Error("Only admins can manage users");

    const { action, ...params } = await req.json();

    switch (action) {
      case "update": {
        const { user_id, email, phone, full_name, role, password, branch_id } = params;
        if (!user_id) throw new Error("user_id required");

        // Update auth email/password if provided
        const authUpdates: any = {};
        if (email) authUpdates.email = email;
        if (password) authUpdates.password = password;
        if (Object.keys(authUpdates).length > 0) {
          const { error } = await adminClient.auth.admin.updateUserById(user_id, authUpdates);
          if (error) throw error;
        }

        // Update profile
        const profileUpdates: any = {};
        if (full_name) profileUpdates.full_name = full_name;
        if (phone !== undefined) profileUpdates.phone = phone;
        if (email) profileUpdates.email = email;
        if (branch_id !== undefined) profileUpdates.branch_id = branch_id;
        if (Object.keys(profileUpdates).length > 0) {
          await adminClient.from("profiles").update(profileUpdates).eq("user_id", user_id);
        }

        // Update role if provided
        if (role) {
          await adminClient.from("user_roles").delete().eq("user_id", user_id);
          await adminClient.from("user_roles").insert({ user_id, role });
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "mute": {
        const { user_id, is_muted } = params;
        if (!user_id) throw new Error("user_id required");

        // Ban/unban in auth
        await adminClient.auth.admin.updateUserById(user_id, {
          ban_duration: is_muted ? "876000h" : "none",
        });

        // Update profile flag
        await adminClient.from("profiles").update({ is_muted }).eq("user_id", user_id);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "delete": {
        const { user_id } = params;
        if (!user_id) throw new Error("user_id required");

        // Delete from auth (cascades to profiles, roles, wallets via FK)
        const { error } = await adminClient.auth.admin.deleteUser(user_id);
        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
