import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()
url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_KEY")
supabase = create_client(url, key)

# Попробуй обновить ЛЮБОГО юзера (подставь свой ID из таблицы)
user_id = "b60c4236-4a61-4668-8496-8e23649e7650" 
res = supabase.table("profiles").update({"search_count": 99}).eq("id", user_id).execute()
print(res)