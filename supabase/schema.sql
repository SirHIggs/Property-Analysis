-- Buy Box accounts: the database behind sign-in and saved deals.
-- Run this once in Supabase → SQL Editor → New query → paste → Run. Safe to run on a new, empty project.
--
-- Security model: the website uses the public (publishable / anon) key, which anyone can read from the page. That is
-- fine because every table below has row-level security: a signed-in person can only read and write their own rows,
-- and someone who isn't signed in can't read or write anything. Never put the secret / service_role key in the site.

-- ---------- profiles: one row per account, holding its role ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'user' check (role in ('user', 'owner')),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
-- People can read their own profile. There are no insert, update or delete policies, so nobody can change a role
-- from the website; the owner role is set by hand (see the end of this file).
create policy "profiles: read own" on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

-- Every new account gets a profile with the ordinary 'user' role.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- deals: one row per saved deal ----------
create table public.deals (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (id ~ '^[A-Za-z0-9_-]{1,64}$'),
  data jsonb not null check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 20000),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
alter table public.deals enable row level security;
create policy "deals: read own" on public.deals for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "deals: add own" on public.deals for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "deals: change own" on public.deals for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "deals: delete own" on public.deals for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Abuse limit: at most 500 deals per account (the site shows "Deal limit reached"). Also stamps updated_at.
create function public.deals_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' and (select count(*) from public.deals d where d.user_id = new.user_id and d.id <> new.id) >= 500 then
    raise exception 'deal_limit';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger deals_guard before insert or update on public.deals
  for each row execute function public.deals_guard();

-- ---------- settings: each account's targets (the buy box) ----------
create table public.settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  targets jsonb not null check (jsonb_typeof(targets) = 'object' and octet_length(targets::text) <= 5000),
  updated_at timestamptz not null default now()
);
alter table public.settings enable row level security;
create policy "settings: read own" on public.settings for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "settings: add own" on public.settings for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "settings: change own" on public.settings for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ---------- table access for signed-in people (row-level security above still limits them to their own rows) ----------
grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.deals to authenticated;
grant select, insert, update on public.settings to authenticated;

-- ---------- delete_me(): Account → Delete account ----------
-- Deletes the signed-in person's login; their profile, deals and settings go with it (on delete cascade).
create function public.delete_me() returns void
language sql security definer set search_path = '' as $$
  delete from auth.users where id = auth.uid();
$$;
revoke execute on function public.delete_me() from public, anon;
grant execute on function public.delete_me() to authenticated;

-- ---------- make yourself the owner (Video mode) ----------
-- After you've created your own account on the site, run this once with your sign-in email:
--
--   update public.profiles set role = 'owner'
--   where id = (select id from auth.users where email = 'you@example.com');
