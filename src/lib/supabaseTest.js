
import { supabase, isSupabaseConfigured } from "./supabase.js";

export async function testSupabaseConnection() {
  if (!isSupabaseConfigured || !supabase) {
    return {
      ok: false,
      message: "Supabase environment variables are missing.",
    };
  }

  const { data, error } = await supabase
    .from("hospitals")
    .select("id")
    .limit(1);

  if (error) {
    return {
      ok: false,
      message: `Supabase query failed: ${error.message}`,
    };
  }

  return {
    ok: true,
    message: "Supabase connection and hospitals query succeeded.",
    rowsReturned: data.length,
  };
}
