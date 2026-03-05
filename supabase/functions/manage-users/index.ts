import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface CreateUserRequest {
  action: "create" | "delete" | "list" | "cleanup" | "update-password";
  email?: string;
  password?: string;
  role?: "admin" | "user";
  userId?: string;
  keepEmail?: string;
  inviterEmail?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    const body: CreateUserRequest = await req.json();
    const { action, email, password, role, userId, keepEmail, inviterEmail } = body;

    // Get caller info from auth header
    const authHeader = req.headers.get("Authorization");
    let callerId: string | null = null;
    
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user: callerUser } } = await supabaseClient.auth.getUser(token);
      callerId = callerUser?.id || null;
      
      // Verify caller is admin (except for cleanup which is a one-time operation)
      if (callerId && action !== "cleanup") {
        const { data: callerRole } = await supabaseClient
          .from("user_roles")
          .select("role")
          .eq("user_id", callerId)
          .single();

        if (callerRole?.role !== "admin") {
          return new Response(
            JSON.stringify({ error: "Only admins can manage users" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    if (action === "list") {
      const { data: users, error } = await supabaseClient.auth.admin.listUsers();
      if (error) {
        throw error;
      }
      return new Response(
        JSON.stringify({ users: users.users.map(u => ({ id: u.id, email: u.email })) }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "cleanup") {
      // Delete all users except the one specified by keepEmail
      const { data: users, error: listError } = await supabaseClient.auth.admin.listUsers();
      if (listError) {
        throw listError;
      }

      const deletedUsers: string[] = [];
      for (const user of users.users) {
        if (user.email?.toLowerCase() !== keepEmail?.toLowerCase()) {
          const { error: deleteError } = await supabaseClient.auth.admin.deleteUser(user.id);
          if (!deleteError) {
            deletedUsers.push(user.email || user.id);
            // Clean up related tables
            await supabaseClient.from("user_roles").delete().eq("user_id", user.id);
            await supabaseClient.from("user_permissions").delete().eq("user_id", user.id);
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true, deletedUsers }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "create") {
      if (!email || !password || !role) {
        return new Response(
          JSON.stringify({ error: "Email, password, and role are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if user already exists
      const { data: existingUsers } = await supabaseClient.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());

      if (existingUser) {
        return new Response(
          JSON.stringify({ error: "User with this email already exists" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create user with provided password
      const { data: newUser, error: createError } = await supabaseClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Auto-confirm since admin is creating
      });

      if (createError) {
        return new Response(
          JSON.stringify({ error: createError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Insert the user role
      await supabaseClient.from("user_roles").insert({
        user_id: newUser.user.id,
        role: role,
      });

      // Create user_accounts entry
      await supabaseClient.from("user_accounts").insert({
        user_id: newUser.user.id,
        user_email: email,
      });

      // Log activity
      if (callerId) {
        await supabaseClient.from("activity_logs").insert({
          user_id: callerId,
          user_email: inviterEmail || "admin",
          user_role: "admin",
          action: "user_created",
          details: { created_email: email, role },
        });
      }

      return new Response(
        JSON.stringify({ success: true, userId: newUser.user.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "delete") {
      if (!userId) {
        return new Response(
          JSON.stringify({ error: "User ID is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Don't allow deleting yourself
      if (userId === callerId) {
        return new Response(
          JSON.stringify({ error: "Cannot delete your own account" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: deleteError } = await supabaseClient.auth.admin.deleteUser(userId);
      if (deleteError) {
        return new Response(
          JSON.stringify({ error: deleteError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Clean up related tables
      await supabaseClient.from("user_roles").delete().eq("user_id", userId);
      await supabaseClient.from("user_permissions").delete().eq("user_id", userId);

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "update-password") {
      if (!userId || !password) {
        return new Response(
          JSON.stringify({ error: "User ID and password are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: updateError } = await supabaseClient.auth.admin.updateUserById(userId, {
        password: password,
      });

      if (updateError) {
        return new Response(
          JSON.stringify({ error: updateError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in manage-users function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
