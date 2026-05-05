
-- Profiles
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  full_name text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "Profiles viewable by authenticated" on public.profiles for select to authenticated using (true);
create policy "Users update own profile" on public.profiles for update to authenticated using (auth.uid() = id);

-- Roles
create type public.app_role as enum ('admin','user');
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  role app_role not null default 'user',
  unique(user_id, role)
);
alter table public.user_roles enable row level security;
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.user_roles where user_id=_user_id and role=_role)
$$;
create policy "Roles viewable by authenticated" on public.user_roles for select to authenticated using (true);

-- Trigger to bootstrap profile + role
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, email, full_name) values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  insert into public.user_roles(user_id, role) values (new.id, 'user');
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Company profile (singleton)
create table public.company_profile (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'SADECO Decor LLC',
  logo_url text,
  about text,
  phone text,
  email text,
  website text,
  address text,
  services jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.company_profile enable row level security;
create policy "Company profile readable by all" on public.company_profile for select using (true);
create policy "Company profile editable by authenticated" on public.company_profile for all to authenticated using (true) with check (true);

insert into public.company_profile (name, about, services) values (
  'SADECO Decor LLC',
  'SADECO is a premier construction and interior fit-out company delivering luxury architectural projects with precision craftsmanship and innovative design.',
  '["Interior Fit-Out","Construction","Renovation","Architectural Design","Project Management","Joinery & Millwork"]'::jsonb
);

-- Projects
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users on delete set null,
  name text not null,
  location text,
  type text not null default 'fit-out',
  area_sqm numeric,
  client_name text,
  status text not null default 'ongoing',
  description text,
  highlights jsonb not null default '[]'::jsonb,
  images jsonb not null default '[]'::jsonb,
  cover_image text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.projects enable row level security;
create policy "Projects readable by all" on public.projects for select using (true);
create policy "Projects insert by authenticated" on public.projects for insert to authenticated with check (true);
create policy "Projects update by authenticated" on public.projects for update to authenticated using (true);
create policy "Projects delete by authenticated" on public.projects for delete to authenticated using (true);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
create trigger projects_touch before update on public.projects for each row execute function public.touch_updated_at();
create trigger company_touch before update on public.company_profile for each row execute function public.touch_updated_at();

-- Storage
insert into storage.buckets (id, name, public) values ('company-assets','company-assets', true), ('project-images','project-images', true);
create policy "Public read company-assets" on storage.objects for select using (bucket_id='company-assets');
create policy "Auth write company-assets" on storage.objects for insert to authenticated with check (bucket_id='company-assets');
create policy "Auth update company-assets" on storage.objects for update to authenticated using (bucket_id='company-assets');
create policy "Auth delete company-assets" on storage.objects for delete to authenticated using (bucket_id='company-assets');
create policy "Public read project-images" on storage.objects for select using (bucket_id='project-images');
create policy "Auth write project-images" on storage.objects for insert to authenticated with check (bucket_id='project-images');
create policy "Auth update project-images" on storage.objects for update to authenticated using (bucket_id='project-images');
create policy "Auth delete project-images" on storage.objects for delete to authenticated using (bucket_id='project-images');
