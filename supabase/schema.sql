-- =====================================================================
-- TODO 앱 Supabase 스키마
-- 적용 방법: Supabase 대시보드 > SQL Editor > 이 파일 전체 붙여넣기 > Run
-- 여러 번 실행해도 안전하게 작성됨 (IF NOT EXISTS / OR REPLACE)
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 0. 허용 도메인 설정
--    이 도메인의 Google 계정만 데이터에 접근 가능. 필요하면 배열에 추가.
-- ---------------------------------------------------------------------
create or replace function public.allowed_email_domains()
returns text[] language sql immutable as $$
  select array['joomidang.com']::text[];
$$;

-- 현재 로그인 사용자가 허용 도메인인지 검사
create or replace function public.is_allowed_user()
returns boolean language sql stable as $$
  select coalesce(
    split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 2) = any (public.allowed_email_domains()),
    false
  );
$$;

-- ---------------------------------------------------------------------
-- 1. 프로필 (auth.users 1:1). 위젯용 토큰을 여기에 보관
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  widget_token text unique default encode(gen_random_bytes(24), 'hex'),
  created_at timestamptz not null default now()
);

-- 회원가입 시 프로필 자동 생성
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 2. 프로젝트
--    is_shared = true 이면 허용 도메인 사용자 전원이 보고 편집 가능
--    status: active(진행중) / done(완료)
-- ---------------------------------------------------------------------
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  is_shared boolean not null default false,
  status text not null default 'active' check (status in ('active', 'done')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists projects_owner_idx on public.projects(owner_id, status);

-- ---------------------------------------------------------------------
-- 3. 할 일
-- ---------------------------------------------------------------------
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  done boolean not null default false,
  due_date date,
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  completed_by uuid references public.profiles(id) on delete set null
);
create index if not exists tasks_project_idx on public.tasks(project_id, done);
create index if not exists tasks_completed_idx on public.tasks(completed_at desc);

-- ---------------------------------------------------------------------
-- 4. 푸시 알림 구독 (브라우저 Web Push)
-- ---------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  notify_hour integer not null default 8,   -- 알림 시각(한국시간, 0~23)
  created_at timestamptz not null default now()
);
create index if not exists push_user_idx on public.push_subscriptions(user_id);

-- ---------------------------------------------------------------------
-- 5. RLS (행 단위 보안)
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.push_subscriptions enable row level security;

-- profiles: 허용 도메인 사용자는 서로 이름을 볼 수 있음(공유 프로젝트 표시용), 수정은 본인만
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (public.is_allowed_user());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- projects
drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects for select
  using (public.is_allowed_user() and (owner_id = auth.uid() or is_shared));
drop policy if exists projects_insert on public.projects;
create policy projects_insert on public.projects for insert
  with check (public.is_allowed_user() and owner_id = auth.uid());
drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects for update
  using (public.is_allowed_user() and (owner_id = auth.uid() or is_shared));
drop policy if exists projects_delete on public.projects;
create policy projects_delete on public.projects for delete
  using (owner_id = auth.uid());

-- tasks: 소속 프로젝트가 보이면 접근 가능
create or replace function public.can_access_project(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.projects p
    where p.id = p_id and (p.owner_id = auth.uid() or p.is_shared)
  );
$$;

drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks for select
  using (public.is_allowed_user() and public.can_access_project(project_id));
drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks for insert
  with check (public.is_allowed_user() and public.can_access_project(project_id));
drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks for update
  using (public.is_allowed_user() and public.can_access_project(project_id));
drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks for delete
  using (public.is_allowed_user() and public.can_access_project(project_id));

-- push_subscriptions: 본인 것만
drop policy if exists push_all on public.push_subscriptions;
create policy push_all on public.push_subscriptions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Realtime 활성화 (다른 기기 변경 즉시 반영)
do $$
begin
  alter publication supabase_realtime add table public.projects;
exception when duplicate_object then null; end $$;
do $$
begin
  alter publication supabase_realtime add table public.tasks;
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 6. 위젯 API (아이폰 Scriptable / 안드로이드 위젯용)
--    로그인 세션 없이 개인 위젯 토큰으로 호출. anon key + token 조합.
--    호출: POST /rest/v1/rpc/widget_get_tasks  body {"token": "..."}
-- ---------------------------------------------------------------------
create or replace function public.widget_user_id(p_token text)
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.profiles where widget_token = p_token and length(p_token) >= 32;
$$;

-- 진행중 프로젝트 + 미완료 할 일 반환
create or replace function public.widget_get_tasks(token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.widget_user_id(token);
begin
  if uid is null then
    raise exception 'invalid token' using errcode = '28000';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id,
      'title', p.title,
      'is_shared', p.is_shared,
      'tasks', coalesce((
        select jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title, 'due_date', t.due_date)
                         order by t.sort_order, t.created_at)
        from public.tasks t where t.project_id = p.id and t.done = false
      ), '[]'::jsonb)
    ) order by p.sort_order, p.created_at)
    from public.projects p
    where p.status = 'active' and (p.owner_id = uid or p.is_shared)
  ), '[]'::jsonb);
end;
$$;

-- 할 일 완료 처리
create or replace function public.widget_complete_task(token text, task_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.widget_user_id(token);
begin
  if uid is null then
    raise exception 'invalid token' using errcode = '28000';
  end if;
  update public.tasks t
  set done = true, completed_at = now(), completed_by = uid
  from public.projects p
  where t.id = task_id and t.project_id = p.id and (p.owner_id = uid or p.is_shared);
  return found;
end;
$$;

-- 할 일 추가
create or replace function public.widget_add_task(token text, project_id uuid, title text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.widget_user_id(token);
  new_id uuid;
begin
  if uid is null then
    raise exception 'invalid token' using errcode = '28000';
  end if;
  if not exists (select 1 from public.projects p where p.id = project_id and (p.owner_id = uid or p.is_shared)) then
    raise exception 'no access' using errcode = '42501';
  end if;
  insert into public.tasks (project_id, title, created_by)
  values (project_id, trim(title), uid) returning id into new_id;
  return new_id;
end;
$$;

-- 위젯 토큰 재발급 (로그인 사용자 본인)
create or replace function public.regenerate_widget_token()
returns text language plpgsql security definer set search_path = public as $$
declare new_token text := encode(gen_random_bytes(24), 'hex');
begin
  update public.profiles set widget_token = new_token where id = auth.uid();
  return new_token;
end;
$$;

grant execute on function public.widget_get_tasks(text) to anon, authenticated;
grant execute on function public.widget_complete_task(text, uuid) to anon, authenticated;
grant execute on function public.widget_add_task(text, uuid, text) to anon, authenticated;
grant execute on function public.regenerate_widget_token() to authenticated;

-- ---------------------------------------------------------------------
-- 7. 아침 알림용 요약 (service role 키로 GitHub Actions에서 호출)
-- ---------------------------------------------------------------------
create or replace function public.daily_summary()
returns table (user_id uuid, name text, project_count bigint, task_count bigint, sample_tasks text[])
language sql stable security definer set search_path = public as $$
  select
    pr.id,
    pr.name,
    (select count(*) from public.projects p where p.status = 'active' and (p.owner_id = pr.id or p.is_shared)),
    (select count(*) from public.tasks t join public.projects p on p.id = t.project_id
       where t.done = false and p.status = 'active' and (p.owner_id = pr.id or p.is_shared)),
    (select array_agg(x.title order by x.created_at) from (
       select t.title, t.created_at from public.tasks t join public.projects p on p.id = t.project_id
       where t.done = false and p.status = 'active' and (p.owner_id = pr.id or p.is_shared)
       order by t.created_at limit 5) x)
  from public.profiles pr;
$$;
revoke execute on function public.daily_summary() from anon, authenticated;
