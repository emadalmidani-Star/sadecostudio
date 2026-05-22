
create table public.scheduled_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  project_id uuid,
  platform text not null default 'linkedin',
  content text not null,
  image_urls jsonb not null default '[]'::jsonb,
  scheduled_for timestamptz,
  status text not null default 'draft',
  published_id text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.scheduled_posts enable row level security;
create policy sp_select_own on public.scheduled_posts for select to authenticated using (auth.uid() = user_id);
create policy sp_insert_own on public.scheduled_posts for insert to authenticated with check (auth.uid() = user_id);
create policy sp_update_own on public.scheduled_posts for update to authenticated using (auth.uid() = user_id);
create policy sp_delete_own on public.scheduled_posts for delete to authenticated using (auth.uid() = user_id);
create trigger sp_touch before update on public.scheduled_posts for each row execute function public.touch_updated_at();
create index scheduled_posts_user_idx on public.scheduled_posts(user_id, scheduled_for);
