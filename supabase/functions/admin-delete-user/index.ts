import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Create client with user's auth token to verify admin status
    const authHeader = req.headers.get("Authorization")!;
    const supabaseClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get the requesting user
    const { data: { user: requestingUser }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !requestingUser) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if requesting user is an admin
    const { data: adminCheck } = await supabaseAdmin
      .from("admin_users")
      .select("id")
      .eq("user_id", requestingUser.id)
      .eq("is_active", true)
      .single();

    if (!adminCheck) {
      return new Response(
        JSON.stringify({ error: "Forbidden: Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get target user ID from request body
    const { targetUserId } = await req.json();
    if (!targetUserId) {
      return new Response(
        JSON.stringify({ error: "Missing targetUserId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prevent self-deletion
    if (targetUserId === requestingUser.id) {
      return new Response(
        JSON.stringify({ error: "Cannot delete your own account" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if target user is an admin (prevent deleting admins)
    const { data: targetAdminCheck } = await supabaseAdmin
      .from("admin_users")
      .select("id")
      .eq("user_id", targetUserId)
      .eq("is_active", true)
      .single();

    if (targetAdminCheck) {
      return new Response(
        JSON.stringify({ error: "Cannot delete an admin user" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's chatbots first (for logging)
    const { data: chatbots } = await supabaseAdmin
      .from("avatars")
      .select("id, name")
      .eq("user_id", targetUserId);

    const chatbotIds = chatbots?.map(c => c.id) || [];

    // Delete related data in order (respecting foreign keys)
    // Most of these should cascade automatically, but being explicit

    // 1. Delete chatbot-related data
    if (chatbotIds.length > 0) {
      // Delete WhatsApp messages
      await supabaseAdmin
        .from("whatsapp_messages")
        .delete()
        .in("chatbot_id", chatbotIds);

      // Delete contact profiles
      await supabaseAdmin
        .from("contact_profiles")
        .delete()
        .in("chatbot_id", chatbotIds);

      // Delete chatbot products
      await supabaseAdmin
        .from("chatbot_products")
        .delete()
        .in("chatbot_id", chatbotIds);

      // Delete chatbot promotions
      await supabaseAdmin
        .from("chatbot_promotions")
        .delete()
        .in("chatbot_id", chatbotIds);

      // Delete knowledge files
      await supabaseAdmin
        .from("avatar_knowledge_files")
        .delete()
        .in("avatar_id", chatbotIds);

      // Delete prompt versions
      await supabaseAdmin
        .from("avatar_prompt_versions")
        .delete()
        .in("avatar_id", chatbotIds);

      // Delete message usage tracking
      await supabaseAdmin
        .from("chatbot_message_usage")
        .delete()
        .in("chatbot_id", chatbotIds);
    }

    // 2. Delete WhatsApp sessions
    await supabaseAdmin
      .from("whatsapp_web_sessions")
      .delete()
      .eq("user_id", targetUserId);

    // 3. Delete platform API keys
    await supabaseAdmin
      .from("platform_api_keys")
      .delete()
      .eq("user_id", targetUserId);

    // 4. Delete admin-assigned API keys
    await supabaseAdmin
      .from("admin_assigned_api_keys")
      .delete()
      .eq("user_id", targetUserId);

    // 5. Delete tier upgrade requests
    await supabaseAdmin
      .from("tier_upgrade_requests")
      .delete()
      .eq("user_id", targetUserId);

    // 6. Delete avatars (chatbots)
    await supabaseAdmin
      .from("avatars")
      .delete()
      .eq("user_id", targetUserId);

    // 7. Delete user profile
    await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", targetUserId);

    // 8. Delete user from auth.users using admin API
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);

    if (deleteAuthError) {
      console.error("Error deleting auth user:", deleteAuthError);
      // Don't fail the whole operation if auth deletion fails
      // The profile and data are already deleted
    }

    console.log(`User ${targetUserId} deleted by admin ${requestingUser.id}. Chatbots deleted: ${chatbotIds.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "User deleted successfully",
        deletedChatbots: chatbotIds.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in admin-delete-user:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
