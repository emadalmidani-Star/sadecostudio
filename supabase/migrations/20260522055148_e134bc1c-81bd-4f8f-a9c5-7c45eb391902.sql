
create table public.linkedin_connections (
  user_id uuid primary key,
  linkedin_sub text not null,
  name text,
  email text,
  picture text,
  access_token text not null,
  expires_at timestamptz,
  scope text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.linkedin_connections enable row level security;
create policy lc_select_own on public.linkedin_connections for select to authenticated using (auth.uid() = user_id);
create policy lc_insert_own on public.linkedin_connections for insert to authenticated with check (auth.uid() = user_id);
create policy lc_update_own on public.linkedin_connections for update to authenticated using (auth.uid() = user_id);
create policy lc_delete_own on public.linkedin_connections for delete to authenticated using (auth.uid() = user_id);
create trigger lc_touch before update on public.linkedin_connections for each row execute function public.touch_updated_at();

create table public.linkedin_oauth_states (
  state text primary key,
  user_id uuid not null,
  created_at timestamptz not null default now()
);
alter table public.linkedin_oauth_states enable row level security;
create policy los_select_own on public.linkedin_oauth_states for select to authenticated using (auth.uid() = user_id);
create policy los_insert_own on public.linkedin_oauth_states for insert to authenticated with check (auth.uid() = user_id);
create policy los_delete_own on public.linkedin_oauth_states for delete to authenticated using (auth.uid() = user_id);
