import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://yitkhjdkypepphscavyo.supabase.co";
const supabaseAnonKey = "sb_publishable_Ia0MsHslOPNI45iB_OvLkw_IcVBQ9zt";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
