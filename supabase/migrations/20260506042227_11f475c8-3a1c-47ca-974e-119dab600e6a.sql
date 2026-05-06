
-- invitations table
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  role app_role not null default 'user',
  invited_by uuid,
  accepted boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.invitations enable row level security;

create policy "Admins manage invitations"
on public.invitations for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

-- Allow admins to update / delete user_roles
create policy "Admins manage user_roles insert"
on public.user_roles for insert
to authenticated
with check (public.has_role(auth.uid(), 'admin'));

create policy "Admins manage user_roles update"
on public.user_roles for update
to authenticated
using (public.has_role(auth.uid(), 'admin'));

create policy "Admins manage user_roles delete"
on public.user_roles for delete
to authenticated
using (public.has_role(auth.uid(), 'admin'));

-- Update signup handler: honor pending invitation for assigned role
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invited_role app_role;
begin
  insert into public.profiles(id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email));

  select role into invited_role
  from public.invitations
  where lower(email) = lower(new.email) and accepted = false
  limit 1;

  insert into public.user_roles(user_id, role)
  values (new.id, coalesce(invited_role, 'user'));

  if invited_role is not null then
    update public.invitations set accepted = true where lower(email) = lower(new.email);
  end if;

  return new;
end; $$;

-- Ensure trigger exists
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
