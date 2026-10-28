-- Gram Clean: organization-scoped village maintenance foundation.
-- Apply with Supabase CLI after reviewing for the target project and pilot.
begin;

create extension if not exists pgcrypto with schema extensions;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  organization_type text not null default 'village' check (organization_type = 'village'),
  preferred_language text not null default 'mr' check (preferred_language in ('mr', 'hi', 'en')),
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 1 and 100),
  preferred_language text not null default 'mr' check (preferred_language in ('mr', 'hi', 'en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('resident', 'worker', 'supervisor', 'admin')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table public.wards (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 100),
  landmarks text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, name),
  unique (organization_id, id)
);

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 100),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, name),
  unique (organization_id, id)
);

create table public.issues (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  ward_id uuid,
  department_id uuid,
  reporter_id uuid not null references public.profiles(id) on delete restrict,
  title text not null check (length(trim(title)) between 5 and 120),
  description text not null check (length(trim(description)) between 10 and 2000),
  category text not null check (category in ('Garbage & sanitation', 'Drainage', 'Water supply', 'Road damage', 'Streetlights', 'Public toilets', 'Public facilities', 'Other maintenance')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'new' check (status in ('new', 'assigned', 'in_progress', 'resolution_submitted', 'verified', 'reopened')),
  location_text text not null check (length(trim(location_text)) between 2 and 250),
  latitude double precision check (latitude is null or latitude between -90 and 90),
  longitude double precision check (longitude is null or longitude between -180 and 180),
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, ward_id) references public.wards(organization_id, id),
  foreign key (organization_id, department_id) references public.departments(organization_id, id),
  unique (organization_id, reporter_id, idempotency_key)
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  issue_id uuid not null references public.issues(id) on delete cascade,
  worker_id uuid not null references public.profiles(id) on delete restrict,
  assigned_by uuid not null references public.profiles(id) on delete restrict,
  department_id uuid not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  foreign key (organization_id, department_id) references public.departments(organization_id, id)
);

create table public.issue_photos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  issue_id uuid not null references public.issues(id) on delete cascade,
  uploader_id uuid not null references public.profiles(id) on delete restrict,
  photo_kind text not null check (photo_kind in ('report', 'completion')),
  storage_path text not null unique,
  content_type text not null check (content_type in ('image/jpeg', 'image/png', 'image/webp')),
  byte_size integer not null check (byte_size between 1 and 10485760),
  created_at timestamptz not null default now()
);

create table public.status_history (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  issue_id uuid not null references public.issues(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  from_status text check (from_status is null or from_status in ('new', 'assigned', 'in_progress', 'resolution_submitted', 'verified', 'reopened')),
  to_status text not null check (to_status in ('new', 'assigned', 'in_progress', 'resolution_submitted', 'verified', 'reopened')),
  reason text not null default '',
  created_at timestamptz not null default now()
);

create table public.verifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  issue_id uuid not null references public.issues(id) on delete cascade,
  supervisor_id uuid not null references public.profiles(id) on delete restrict,
  decision text not null check (decision in ('approved', 'rejected')),
  note text not null default '' check (length(note) <= 1000),
  created_at timestamptz not null default now()
);

create table public.points_ledger (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete restrict,
  issue_id uuid references public.issues(id) on delete set null,
  entry_type text not null check (entry_type in ('award', 'adjustment', 'reversal')),
  points integer not null check (points <> 0 and abs(points) <= 1000),
  idempotency_key text not null,
  reason text not null check (length(trim(reason)) between 1 and 250),
  created_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  issue_id uuid references public.issues(id) on delete cascade,
  kind text not null check (kind in ('assigned', 'status_changed', 'verification', 'system')),
  title text not null check (length(trim(title)) between 1 and 120),
  body text not null default '' check (length(body) <= 500),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null check (length(trim(action)) between 1 and 100),
  target_type text not null check (length(trim(target_type)) between 1 and 60),
  target_id text not null,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now()
);

create table public.ai_usage (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  usage_day date not null default current_date,
  request_count integer not null default 0 check (request_count between 0 and 10),
  primary key (organization_id, user_id, usage_day)
);

create index issues_org_status_created_idx on public.issues (organization_id, status, created_at desc);
create index issues_reporter_created_idx on public.issues (reporter_id, created_at desc);
create index assignments_worker_active_idx on public.assignments (worker_id, active, created_at desc);
create index assignments_issue_active_idx on public.assignments (issue_id, active);
create unique index assignments_one_active_worker_per_issue on public.assignments (issue_id) where active;
create index photos_issue_kind_idx on public.issue_photos (issue_id, photo_kind, created_at desc);
create index history_issue_created_idx on public.status_history (issue_id, created_at desc);
create index ledger_user_created_idx on public.points_ledger (organization_id, user_id, created_at desc);
create index notifications_user_unread_idx on public.notifications (user_id, created_at desc) where read_at is null;
create index audit_org_created_idx on public.audit_logs (organization_id, created_at desc);

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin new.updated_at := now(); return new; end;
$$;
create trigger profiles_touch_updated_at before update on public.profiles for each row execute function public.touch_updated_at();
create trigger issues_touch_updated_at before update on public.issues for each row execute function public.touch_updated_at();

create or replace function public.create_profile_for_auth_user()
returns trigger language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare
  display text;
  language_code text;
begin
  display := coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(coalesce(new.email, 'Village resident'), '@', 1));
  language_code := case when new.raw_user_meta_data ->> 'preferred_language' in ('mr', 'hi', 'en') then new.raw_user_meta_data ->> 'preferred_language' else 'mr' end;
  insert into public.profiles (id, display_name, preferred_language) values (new.id, left(display, 100), language_code)
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.create_profile_for_auth_user();

create or replace function public.has_org_role(p_organization_id uuid, p_roles text[] default array[]::text[])
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.memberships m
    where m.organization_id = p_organization_id and m.user_id = auth.uid() and m.active
      and (cardinality(p_roles) = 0 or m.role = any(p_roles))
  );
$$;

create or replace function public.shares_village_with(p_user_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.memberships mine
    join public.memberships theirs on theirs.organization_id = mine.organization_id
    where mine.user_id = auth.uid() and mine.active and theirs.user_id = p_user_id and theirs.active
  );
$$;

create or replace function public.can_access_issue(p_issue_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.issues i
    join public.memberships m on m.organization_id = i.organization_id and m.user_id = auth.uid() and m.active
    where i.id = p_issue_id and (
      m.role in ('admin', 'supervisor') or i.reporter_id = auth.uid() or exists (
        select 1 from public.assignments a where a.issue_id = i.id and a.worker_id = auth.uid()
      )
    )
  );
$$;

create or replace function public.can_upload_issue_photo(p_organization_id uuid, p_issue_id uuid, p_actor_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select p_actor_id = auth.uid() and exists (
    select 1 from public.issues i
    join public.memberships m on m.organization_id = i.organization_id and m.user_id = auth.uid() and m.active
    where i.id = p_issue_id and i.organization_id = p_organization_id and i.status <> 'verified'
      and (i.reporter_id = auth.uid() or exists (
        select 1 from public.assignments a where a.issue_id = i.id and a.worker_id = auth.uid() and a.active
      ))
  );
$$;

create or replace function public.join_village(p_slug text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  organization uuid;
begin
  if auth.uid() is null then raise exception 'Sign in before joining a village'; end if;
  select id into organization from public.organizations where slug = lower(trim(p_slug));
  if organization is null then raise exception 'Village code was not found'; end if;
  if exists (select 1 from public.memberships where organization_id = organization and user_id = auth.uid()) then
    raise exception 'You already have a membership for this village';
  end if;
  insert into public.memberships (organization_id, user_id, role) values (organization, auth.uid(), 'resident');
  insert into public.audit_logs (organization_id, actor_id, action, target_type, target_id)
    values (organization, auth.uid(), 'member.joined', 'membership', auth.uid()::text);
  return organization;
end;
$$;

create or replace function public.consume_ai_request(p_organization_id uuid)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare used_count integer;
begin
  if auth.uid() is null or not public.has_org_role(p_organization_id) then raise exception 'Active village membership required'; end if;
  insert into public.ai_usage (organization_id, user_id, usage_day, request_count)
    values (p_organization_id, auth.uid(), current_date, 1)
    on conflict (organization_id, user_id, usage_day) do update
      set request_count = public.ai_usage.request_count + 1
      where public.ai_usage.request_count < 10
    returning request_count into used_count;
  return used_count is not null;
end;
$$;

create or replace function public.admin_set_member_role(p_organization_id uuid, p_user_id uuid, p_role text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare old_role text;
begin
  if not public.has_org_role(p_organization_id, array['admin']) then raise exception 'Village administrator permission required'; end if;
  if p_user_id = auth.uid() then raise exception 'You cannot change your own village role'; end if;
  if p_role not in ('resident', 'worker', 'supervisor', 'admin') then raise exception 'Invalid village role'; end if;
  select role into old_role from public.memberships where organization_id = p_organization_id and user_id = p_user_id and active;
  if old_role = 'admin' and p_role <> 'admin' and not exists (
    select 1 from public.memberships where organization_id = p_organization_id and user_id <> p_user_id and role = 'admin' and active
  ) then raise exception 'Keep at least one active village administrator'; end if;
  update public.memberships set role = p_role
   where organization_id = p_organization_id and user_id = p_user_id and active;
  if not found then raise exception 'Active village membership was not found'; end if;
  insert into public.audit_logs (organization_id, actor_id, action, target_type, target_id, details)
    values (p_organization_id, auth.uid(), 'member.role_changed', 'membership', p_user_id::text, jsonb_build_object('role', p_role));
end;
$$;

create or replace function public.admin_set_member_active(p_organization_id uuid, p_user_id uuid, p_active boolean)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare target_role text;
begin
  if not public.has_org_role(p_organization_id, array['admin']) then raise exception 'Village administrator permission required'; end if;
  if p_user_id = auth.uid() then raise exception 'You cannot suspend your own village membership'; end if;
  select role into target_role from public.memberships where organization_id = p_organization_id and user_id = p_user_id;
  if target_role is null then raise exception 'Village membership was not found'; end if;
  if not p_active and target_role = 'admin' and not exists (
    select 1 from public.memberships where organization_id = p_organization_id and user_id <> p_user_id and role = 'admin' and active
  ) then raise exception 'Keep at least one active village administrator'; end if;
  update public.memberships set active = p_active where organization_id = p_organization_id and user_id = p_user_id;
  insert into public.audit_logs (organization_id, actor_id, action, target_type, target_id, details)
    values (p_organization_id, auth.uid(), case when p_active then 'member.activated' else 'member.suspended' end, 'membership', p_user_id::text, '{}'::jsonb);
end;
$$;

create or replace function public.admin_save_ward(
  p_organization_id uuid, p_name text, p_landmarks text default '', p_active boolean default true, p_ward_id uuid default null
)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare saved_id uuid;
begin
  if not public.has_org_role(p_organization_id, array['admin']) then raise exception 'Village administrator permission required'; end if;
  if length(trim(coalesce(p_name, ''))) not between 1 and 100 then raise exception 'Ward name is invalid'; end if;
  if p_ward_id is null then
    insert into public.wards (organization_id, name, landmarks, active) values (p_organization_id, trim(p_name), left(coalesce(p_landmarks, ''), 500), p_active) returning id into saved_id;
  else
    update public.wards set name = trim(p_name), landmarks = left(coalesce(p_landmarks, ''), 500), active = p_active
      where id = p_ward_id and organization_id = p_organization_id returning id into saved_id;
    if saved_id is null then raise exception 'Ward was not found in this village'; end if;
  end if;
  insert into public.audit_logs (organization_id, actor_id, action, target_type, target_id)
    values (p_organization_id, auth.uid(), 'ward.saved', 'ward', saved_id::text);
  return saved_id;
end;
$$;

create or replace function public.admin_save_department(
  p_organization_id uuid, p_name text, p_active boolean default true, p_department_id uuid default null
)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare saved_id uuid;
begin
  if not public.has_org_role(p_organization_id, array['admin']) then raise exception 'Village administrator permission required'; end if;
  if length(trim(coalesce(p_name, ''))) not between 1 and 100 then raise exception 'Department name is invalid'; end if;
  if p_department_id is null then
    insert into public.departments (organization_id, name, active) values (p_organization_id, trim(p_name), p_active) returning id into saved_id;
  else
    update public.departments set name = trim(p_name), active = p_active
      where id = p_department_id and organization_id = p_organization_id returning id into saved_id;
    if saved_id is null then raise exception 'Department was not found in this village'; end if;
  end if;
  insert into public.audit_logs (organization_id, actor_id, action, target_type, target_id)
    values (p_organization_id, auth.uid(), 'department.saved', 'department', saved_id::text);
  return saved_id;
end;
$$;

create or replace function public.submit_issue(
  p_organization_id uuid,
  p_ward_id uuid,
  p_title text,
  p_description text,
  p_category text,
  p_priority text,
  p_location_text text,
  p_idempotency_key uuid,
  p_latitude double precision default null,
  p_longitude double precision default null
)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  existing_issue uuid;
  created_issue uuid;
begin
  if auth.uid() is null or not public.has_org_role(p_organization_id, array['resident']) then raise exception 'Active resident membership required'; end if;
  if p_idempotency_key is null then raise exception 'An idempotency key is required'; end if;
  select id into existing_issue from public.issues
    where organization_id = p_organization_id and reporter_id = auth.uid() and idempotency_key = p_idempotency_key;
  if existing_issue is not null then return existing_issue; end if;
  if p_ward_id is not null and not exists (select 1 from public.wards where id = p_ward_id and organization_id = p_organization_id and active) then raise exception 'Ward does not belong to this village'; end if;
  if length(trim(coalesce(p_title, ''))) not between 5 and 120 or length(trim(coalesce(p_description, ''))) not between 10 and 2000 then raise exception 'Report title or description is invalid'; end if;
  if length(trim(coalesce(p_location_text, ''))) not between 2 and 250 then raise exception 'A location is required'; end if;
  if p_category not in ('Garbage & sanitation', 'Drainage', 'Water supply', 'Road damage', 'Streetlights', 'Public toilets', 'Public facilities', 'Other maintenance') then raise exception 'Invalid issue category'; end if;
  if p_priority not in ('low', 'normal', 'high', 'urgent') then raise exception 'Invalid priority'; end if;
  insert into public.issues (organization_id, ward_id, reporter_id, title, description, category, priority, location_text, latitude, longitude, idempotency_key)
    values (p_organization_id, p_ward_id, auth.uid(), trim(p_title), trim(p_description), p_category, p_priority, trim(p_location_text), p_latitude, p_longitude, p_idempotency_key)
    returning id into created_issue;
  insert into public.status_history (organization_id, issue_id, actor_id, from_status, to_status, reason)
    values (p_organization_id, created_issue, auth.uid(), null, 'new', 'Report submitted');
  insert into public.notifications (organization_id, user_id, issue_id, kind, title, body)
    select p_organization_id, m.user_id, created_issue, 'status_changed', 'New village report', trim(p_title)
      from public.memberships m where m.organization_id = p_organization_id and m.role in ('supervisor', 'admin') and m.active;
  insert into public.audit_logs (organization_id, actor_id, action, target_type, target_id)
    values (p_organization_id, auth.uid(), 'issue.created', 'issue', created_issue::text);
  return created_issue;
end;
$$;

-- Return only low-risk duplicate hints. Residents cannot read another report's title,
-- description, reporter identity, precise location, photos or workflow history.
create or replace function public.find_similar_issues(
  p_organization_id uuid, p_title text, p_description text, p_category text, p_ward_id uuid
)
returns table(issue_id uuid, category text, status text, ward_name text, created_at timestamptz)
language plpgsql security definer set search_path = public, pg_temp as $$
declare search_terms text[];
begin
  if auth.uid() is null or not public.has_org_role(p_organization_id, array['resident']) then raise exception 'Active resident membership required'; end if;
  if length(trim(coalesce(p_title, ''))) not between 5 and 120 or length(trim(coalesce(p_description, ''))) not between 10 and 700 then raise exception 'Report title or description is invalid'; end if;
  if p_category not in ('Garbage & sanitation', 'Drainage', 'Water supply', 'Road damage', 'Streetlights', 'Public toilets', 'Public facilities', 'Other maintenance') then raise exception 'Invalid issue category'; end if;
  if p_ward_id is not null and not exists (select 1 from public.wards where id = p_ward_id and organization_id = p_organization_id and active) then raise exception 'Ward does not belong to this village'; end if;
  select array_agg(distinct term) into search_terms
    from regexp_split_to_table(lower(p_title || ' ' || p_description), '[^[:alnum:]]+') as tokens(term)
    where length(term) >= 4;
  return query
    select i.id, i.category, i.status, coalesce(w.name, 'Village area'), i.created_at
    from public.issues i left join public.wards w on w.id = i.ward_id and w.organization_id = i.organization_id
    where i.organization_id = p_organization_id
      and i.created_at >= now() - interval '180 days'
      and (
        (select count(*) from unnest(search_terms) as words(term) where strpos(lower(i.title || ' ' || i.description), term) > 0) >= 2
        or ((i.category = p_category and i.ward_id is not distinct from p_ward_id)
          and (select count(*) from unnest(search_terms) as words(term) where strpos(lower(i.title || ' ' || i.description), term) > 0) >= 1)
      )
    order by (select count(*) from unnest(search_terms) as words(term) where strpos(lower(i.title || ' ' || i.description), term) > 0) desc, i.created_at desc
    limit 3;
end;
$$;

create or replace function public.register_issue_photo(
  p_organization_id uuid, p_issue_id uuid, p_photo_kind text,
  p_storage_path text, p_content_type text, p_byte_size integer
)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare photo_id uuid;
begin
  if not public.can_upload_issue_photo(p_organization_id, p_issue_id, auth.uid()) then raise exception 'You cannot attach a photo to this issue'; end if;
  if p_photo_kind not in ('report', 'completion') then raise exception 'Invalid photo type'; end if;
  if p_photo_kind = 'completion' and not exists (
    select 1 from public.assignments where issue_id = p_issue_id and worker_id = auth.uid() and active
  ) then raise exception 'Only the assigned worker can attach completion evidence'; end if;
  if p_storage_path !~ ('^' || p_organization_id::text || '/' || p_issue_id::text || '/' || auth.uid()::text || '/[A-Za-z0-9._-]+$') then raise exception 'Invalid private photo path'; end if;
  insert into public.issue_photos (organization_id, issue_id, uploader_id, photo_kind, storage_path, content_type, byte_size)
    values (p_organization_id, p_issue_id, auth.uid(), p_photo_kind, p_storage_path, p_content_type, p_byte_size)
    returning id into photo_id;
  return photo_id;
end;
$$;

create or replace function public.assign_issue(p_issue_id uuid, p_worker_id uuid, p_department_id uuid, p_reason text default '')
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare current_issue public.issues%rowtype;
begin
  select * into current_issue from public.issues where id = p_issue_id for update;
  if not found then raise exception 'Issue was not found'; end if;
  if not public.has_org_role(current_issue.organization_id, array['admin', 'supervisor']) then raise exception 'Supervisor permission required'; end if;
  if not exists (select 1 from public.memberships where organization_id = current_issue.organization_id and user_id = p_worker_id and role = 'worker' and active) then raise exception 'Worker must have an active membership in this village'; end if;
  if not exists (select 1 from public.departments where id = p_department_id and organization_id = current_issue.organization_id and active) then raise exception 'Department does not belong to this village'; end if;
  if current_issue.status in ('resolution_submitted', 'verified') then raise exception 'Issue cannot be assigned in its current state'; end if;
  update public.assignments set active = false, ended_at = now() where issue_id = p_issue_id and active;
  insert into public.assignments (organization_id, issue_id, worker_id, assigned_by, department_id)
    values (current_issue.organization_id, p_issue_id, p_worker_id, auth.uid(), p_department_id);
  update public.issues set department_id = p_department_id, status = 'assigned' where id = p_issue_id;
  insert into public.status_history (organization_id, issue_id, actor_id, from_status, to_status, reason)
    values (current_issue.organization_id, p_issue_id, auth.uid(), current_issue.status, 'assigned', left(coalesce(p_reason, ''), 500));
  insert into public.notifications (organization_id, user_id, issue_id, kind, title, body)
    values (current_issue.organization_id, p_worker_id, p_issue_id, 'assigned', 'New task assigned', current_issue.title);
  insert into public.audit_logs (organization_id, actor_id, action, target_type, target_id)
    values (current_issue.organization_id, auth.uid(), 'issue.assigned', 'issue', p_issue_id::text);
end;
$$;

create or replace function public.start_issue_work(p_issue_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare current_issue public.issues%rowtype;
begin
  select * into current_issue from public.issues where id = p_issue_id for update;
  if not found or not exists (select 1 from public.assignments where issue_id = p_issue_id and worker_id = auth.uid() and active) then raise exception 'Active assignment required'; end if;
  if current_issue.status not in ('assigned', 'reopened') then raise exception 'Issue is not ready to start'; end if;
  update public.issues set status = 'in_progress' where id = p_issue_id;
  insert into public.status_history (organization_id, issue_id, actor_id, from_status, to_status) values (current_issue.organization_id, p_issue_id, auth.uid(), current_issue.status, 'in_progress');
end;
$$;

create or replace function public.submit_issue_resolution(p_issue_id uuid, p_note text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare current_issue public.issues%rowtype;
begin
  select * into current_issue from public.issues where id = p_issue_id for update;
  if not found or not exists (select 1 from public.assignments where issue_id = p_issue_id and worker_id = auth.uid() and active) then raise exception 'Active assignment required'; end if;
  if current_issue.status <> 'in_progress' then raise exception 'Work must be in progress before submitting a resolution'; end if;
  if length(trim(coalesce(p_note, ''))) not between 5 and 1000 then raise exception 'Add a short completion note'; end if;
  if not exists (select 1 from public.issue_photos where issue_id = p_issue_id and uploader_id = auth.uid() and photo_kind = 'completion') then raise exception 'Add a completion photo before submitting for review'; end if;
  update public.issues set status = 'resolution_submitted' where id = p_issue_id;
  insert into public.status_history (organization_id, issue_id, actor_id, from_status, to_status, reason) values (current_issue.organization_id, p_issue_id, auth.uid(), 'in_progress', 'resolution_submitted', trim(p_note));
  insert into public.notifications (organization_id, user_id, issue_id, kind, title, body)
    select current_issue.organization_id, m.user_id, p_issue_id, 'status_changed', 'Repair ready for review', current_issue.title
      from public.memberships m where m.organization_id = current_issue.organization_id and m.role in ('supervisor', 'admin') and m.active;
end;
$$;

create or replace function public.review_issue_resolution(p_issue_id uuid, p_decision text, p_note text default '')
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare current_issue public.issues%rowtype;
declare assigned_worker uuid;
declare next_status text;
begin
  select * into current_issue from public.issues where id = p_issue_id for update;
  if not found then raise exception 'Issue was not found'; end if;
  if not public.has_org_role(current_issue.organization_id, array['admin', 'supervisor']) then raise exception 'Supervisor permission required'; end if;
  if current_issue.status <> 'resolution_submitted' then raise exception 'Only submitted resolutions can be reviewed'; end if;
  select worker_id into assigned_worker from public.assignments where issue_id = p_issue_id and active limit 1;
  if assigned_worker = auth.uid() then raise exception 'Workers cannot approve their own work'; end if;
  if p_decision not in ('approved', 'rejected') then raise exception 'Invalid review decision'; end if;
  next_status := case when p_decision = 'approved' then 'verified' else 'reopened' end;
  insert into public.verifications (organization_id, issue_id, supervisor_id, decision, note)
    values (current_issue.organization_id, p_issue_id, auth.uid(), p_decision, left(coalesce(p_note, ''), 1000));
  update public.issues set status = next_status where id = p_issue_id;
  if next_status = 'verified' then update public.assignments set active = false, ended_at = now() where issue_id = p_issue_id and active; end if;
  insert into public.status_history (organization_id, issue_id, actor_id, from_status, to_status, reason)
    values (current_issue.organization_id, p_issue_id, auth.uid(), 'resolution_submitted', next_status, left(coalesce(p_note, ''), 500));
  if next_status = 'verified' then
    insert into public.points_ledger (organization_id, user_id, issue_id, entry_type, points, idempotency_key, reason)
      values (current_issue.organization_id, current_issue.reporter_id, p_issue_id, 'award', 2, 'issue:' || p_issue_id::text || ':reporter-verified', 'Verified village report') on conflict (organization_id, idempotency_key) do nothing;
    if assigned_worker is not null then
      insert into public.points_ledger (organization_id, user_id, issue_id, entry_type, points, idempotency_key, reason)
        values (current_issue.organization_id, assigned_worker, p_issue_id, 'award', 1, 'issue:' || p_issue_id::text || ':worker-verified', 'Verified repair completed') on conflict (organization_id, idempotency_key) do nothing;
    end if;
  end if;
  insert into public.notifications (organization_id, user_id, issue_id, kind, title, body)
    values (current_issue.organization_id, current_issue.reporter_id, p_issue_id, 'verification', case when next_status = 'verified' then 'Your report was resolved' else 'More work is needed' end, left(coalesce(p_note, ''), 500));
  if assigned_worker is not null then
    insert into public.notifications (organization_id, user_id, issue_id, kind, title, body)
      values (current_issue.organization_id, assigned_worker, p_issue_id, 'verification', case when next_status = 'verified' then 'Repair verified' else 'More work requested' end, left(coalesce(p_note, ''), 500));
  end if;
  insert into public.audit_logs (organization_id, actor_id, action, target_type, target_id, details)
    values (current_issue.organization_id, auth.uid(), 'issue.reviewed', 'issue', p_issue_id::text, jsonb_build_object('decision', p_decision));
end;
$$;

-- RLS is enabled for every table in the exposed public schema above.
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.wards enable row level security;
alter table public.departments enable row level security;
alter table public.issues enable row level security;
alter table public.assignments enable row level security;
alter table public.issue_photos enable row level security;
alter table public.status_history enable row level security;
alter table public.verifications enable row level security;
alter table public.points_ledger enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;
alter table public.ai_usage enable row level security;

create policy organizations_member_read on public.organizations for select to authenticated using (public.has_org_role(id));
create policy profiles_member_read on public.profiles for select to authenticated using (
  id = auth.uid() or public.shares_village_with(id)
);
create policy profiles_self_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy memberships_member_read on public.memberships for select to authenticated using (
  user_id = auth.uid() or public.has_org_role(organization_id, array['admin'])
);
create policy memberships_coordinator_read on public.memberships for select to authenticated using (
  public.has_org_role(organization_id, array['supervisor', 'admin'])
);
create policy wards_member_read on public.wards for select to authenticated using (active and public.has_org_role(organization_id));
create policy departments_member_read on public.departments for select to authenticated using (active and public.has_org_role(organization_id));
create policy issues_authorized_read on public.issues for select to authenticated using (public.can_access_issue(id));
create policy assignments_authorized_read on public.assignments for select to authenticated using (public.can_access_issue(issue_id));
create policy photos_authorized_read on public.issue_photos for select to authenticated using (public.can_access_issue(issue_id));
create policy history_authorized_read on public.status_history for select to authenticated using (public.can_access_issue(issue_id));
create policy verification_authorized_read on public.verifications for select to authenticated using (public.can_access_issue(issue_id));
create policy points_member_read on public.points_ledger for select to authenticated using (public.has_org_role(organization_id));
create policy notifications_owner_read on public.notifications for select to authenticated using (user_id = auth.uid() and public.has_org_role(organization_id));
create policy notifications_owner_update on public.notifications for update to authenticated using (user_id = auth.uid() and public.has_org_role(organization_id)) with check (user_id = auth.uid() and public.has_org_role(organization_id));
create policy audit_admin_read on public.audit_logs for select to authenticated using (public.has_org_role(organization_id, array['admin']));

-- Authenticated users receive only the columns and write paths required by the app.
revoke all on all tables in schema public from anon, authenticated;
grant usage on schema public to authenticated;
grant select on public.organizations, public.memberships, public.wards, public.departments,
  public.issues, public.assignments, public.issue_photos, public.status_history,
  public.verifications, public.points_ledger, public.notifications, public.audit_logs to authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, preferred_language) on public.profiles to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant usage, select on all sequences in schema public to authenticated;

revoke all on function public.touch_updated_at() from public, anon, authenticated;
revoke all on function public.create_profile_for_auth_user() from public, anon, authenticated;
revoke all on function public.has_org_role(uuid, text[]) from public, anon;
revoke all on function public.shares_village_with(uuid) from public, anon;
revoke all on function public.can_access_issue(uuid) from public, anon;
revoke all on function public.can_upload_issue_photo(uuid, uuid, uuid) from public, anon;
revoke all on function public.join_village(text) from public, anon;
revoke all on function public.consume_ai_request(uuid) from public, anon;
revoke all on function public.admin_set_member_role(uuid, uuid, text) from public, anon;
revoke all on function public.admin_set_member_active(uuid, uuid, boolean) from public, anon;
revoke all on function public.admin_save_ward(uuid, text, text, boolean, uuid) from public, anon;
revoke all on function public.admin_save_department(uuid, text, boolean, uuid) from public, anon;
revoke all on function public.submit_issue(uuid, uuid, text, text, text, text, text, uuid, double precision, double precision) from public, anon;
revoke all on function public.find_similar_issues(uuid, text, text, text, uuid) from public, anon;
revoke all on function public.register_issue_photo(uuid, uuid, text, text, text, integer) from public, anon;
revoke all on function public.assign_issue(uuid, uuid, uuid, text) from public, anon;
revoke all on function public.start_issue_work(uuid) from public, anon;
revoke all on function public.submit_issue_resolution(uuid, text) from public, anon;
revoke all on function public.review_issue_resolution(uuid, text, text) from public, anon;
grant execute on function public.has_org_role(uuid, text[]) to authenticated;
grant execute on function public.shares_village_with(uuid) to authenticated;
grant execute on function public.can_access_issue(uuid) to authenticated;
grant execute on function public.can_upload_issue_photo(uuid, uuid, uuid) to authenticated;
grant execute on function public.join_village(text) to authenticated;
grant execute on function public.consume_ai_request(uuid) to authenticated;
grant execute on function public.admin_set_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.admin_set_member_active(uuid, uuid, boolean) to authenticated;
grant execute on function public.admin_save_ward(uuid, text, text, boolean, uuid) to authenticated;
grant execute on function public.admin_save_department(uuid, text, boolean, uuid) to authenticated;
grant execute on function public.submit_issue(uuid, uuid, text, text, text, text, text, uuid, double precision, double precision) to authenticated;
grant execute on function public.find_similar_issues(uuid, text, text, text, uuid) to authenticated;
grant execute on function public.register_issue_photo(uuid, uuid, text, text, text, integer) to authenticated;
grant execute on function public.assign_issue(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.start_issue_work(uuid) to authenticated;
grant execute on function public.submit_issue_resolution(uuid, text) to authenticated;
grant execute on function public.review_issue_resolution(uuid, text, text) to authenticated;

-- Photo objects are private; file paths follow organization/issue/uploader/filename.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('issue-photos', 'issue-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 10485760, allowed_mime_types = excluded.allowed_mime_types;

revoke all on storage.objects from anon, authenticated;
grant select, insert, delete on storage.objects to authenticated;
create policy issue_photo_objects_read on storage.objects for select to authenticated using (
  bucket_id = 'issue-photos'
  and array_length(storage.foldername(name), 1) = 3
  and public.can_access_issue((storage.foldername(name))[2]::uuid)
  and exists (
    select 1 from public.issues i where i.id = (storage.foldername(name))[2]::uuid
      and i.organization_id::text = (storage.foldername(name))[1]
  )
);
create policy issue_photo_objects_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'issue-photos'
  and array_length(storage.foldername(name), 1) = 3
  and (storage.foldername(name))[3] = auth.uid()::text
  and public.can_upload_issue_photo((storage.foldername(name))[1]::uuid, (storage.foldername(name))[2]::uuid, auth.uid())
  and not exists (select 1 from public.issue_photos photo where photo.storage_path = name)
);
create policy issue_photo_objects_remove_own_unverified on storage.objects for delete to authenticated using (
  bucket_id = 'issue-photos'
  and array_length(storage.foldername(name), 1) = 3
  and (storage.foldername(name))[3] = auth.uid()::text
  and public.can_upload_issue_photo((storage.foldername(name))[1]::uuid, (storage.foldername(name))[2]::uuid, auth.uid())
);

commit;
