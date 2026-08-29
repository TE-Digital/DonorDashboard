import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://lkmnjhgrecgczfodllwh.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrbW5qaGdyZWNnY3pmb2RsbHdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0NDkzMjIsImV4cCI6MjA3NzAyNTMyMn0.yVev7DFPJK7mJM2HZsRdg1exYtD6e4HkFKB2Vea14tw";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  const { data: schools, error: schoolError } = await supabase.from("schools").select("*");
  console.log("--- Schools ---");
  console.log("Error:", schoolError);
  console.log("Count:", schools?.length);
  console.log("Data:", schools);
}

check();
