-- shoot+ tables, added to the same Supabase project as lifestyle+. Safe to run more than once.
-- Run it in Supabase: Dashboard → SQL Editor → New query → paste → Run.
--
-- shoot+ keeps its own tables (shoot_records, shoot_record_history), so it never reads or changes
-- lifestyle+'s `records`. Sign-in accounts are shared: the same email works in both apps.

/* ---------- Records: every booking, client, service, tax payment and the settings ---------- */

create table if not exists public.shoot_records (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  kind        text not null,                 -- 'booking', 'client', 'service', 'taxpay', 'settings'
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null,          -- when the change was made (set by the device)
  deleted     boolean not null default false,-- soft delete so other devices hear about it
  synced_at   timestamptz not null default now() -- when the server received it (used for pulling changes)
);

create index if not exists shoot_records_user_synced on public.shoot_records (user_id, synced_at);
create index if not exists shoot_records_user_kind on public.shoot_records (user_id, kind);

-- Only you can see and change your own rows.
alter table public.shoot_records enable row level security;
drop policy if exists "Own shoot records" on public.shoot_records;
create policy "Own shoot records" on public.shoot_records
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Stamp synced_at with the server clock on every insert and update.
create or replace function public.shoot_touch_synced_at()
returns trigger language plpgsql as $$
begin
  new.synced_at = now();
  return new;
end $$;

drop trigger if exists shoot_records_touch on public.shoot_records;
create trigger shoot_records_touch
  before insert or update on public.shoot_records
  for each row execute function public.shoot_touch_synced_at();

/* ---------- Undo history: the version each change replaced, kept 90 days ---------- */

create table if not exists public.shoot_record_history (
  hid          bigint generated always as identity primary key,
  record_id    uuid not null,
  user_id      uuid not null references auth.users on delete cascade,
  kind         text not null,
  data         jsonb not null,
  deleted      boolean not null,
  updated_at   timestamptz not null,           -- when that version was made
  replaced_at  timestamptz not null default now() -- when it was replaced
);
create index if not exists shoot_record_history_user_time on public.shoot_record_history (user_id, replaced_at desc);
create index if not exists shoot_record_history_record on public.shoot_record_history (record_id, replaced_at desc);

alter table public.shoot_record_history enable row level security;
drop policy if exists "Read own shoot history" on public.shoot_record_history;
create policy "Read own shoot history" on public.shoot_record_history for select using (auth.uid() = user_id);

create or replace function public.shoot_keep_history()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.data is distinct from new.data or old.deleted is distinct from new.deleted then
    insert into public.shoot_record_history (record_id, user_id, kind, data, deleted, updated_at)
    values (old.id, old.user_id, old.kind, old.data, old.deleted, old.updated_at);
  end if;
  return new;
end $$;

drop trigger if exists shoot_records_history on public.shoot_records;
create trigger shoot_records_history
  after update on public.shoot_records
  for each row execute function public.shoot_keep_history();

-- Nightly cleanup (pg_cron is already on from lifestyle+'s setup).
create extension if not exists pg_cron;
select cron.unschedule('shoot-history-cleanup') where exists (select 1 from cron.job where jobname = 'shoot-history-cleanup');
select cron.schedule(
  'shoot-history-cleanup',
  '23 9 * * *',
  $cron$ delete from public.shoot_record_history where replaced_at < now() - interval '90 days'; $cron$
);
