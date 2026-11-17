-- AZ Internacional — Fase 1: identidade, sessões, consentimento e auditoria.
--
-- Modelo de acesso:
--   * O front-end NUNCA fala com o Supabase. Só o back-end tem a connection string.
--   * Operações do próprio usuário rodam com `set local role authenticated` + claims do usuário
--     (ver apps/api/src/db/tx.ts). Nesse modo o RLS abaixo é aplicado de verdade.
--   * Operações de sistema (login, sessões, auditoria) rodam como dono das tabelas e ficam no
--     schema `private`, que não é exposto pelo PostgREST e não tem grants para anon/authenticated.
--
-- ATENÇÃO para migrações futuras: o Supabase concede ALL em tabelas novas de `public` para
-- anon/authenticated por default privileges. Toda tabela nova deve repetir o padrão
-- "revoke all ... ; grant <colunas mínimas>" usado aqui.

create schema if not exists private;
revoke all on schema private from public;

create type public.user_role as enum ('student', 'admin', 'owner');

-- ---------------------------------------------------------------------------
-- Tabelas públicas (acessíveis via RLS)
-- ---------------------------------------------------------------------------

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  email_domain text not null unique
    check (email_domain = lower(email_domain) and email_domain ~ '^[a-z0-9-]+(\.[a-z0-9-]+)+$'),
  created_at timestamptz not null default now()
);

create table public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email) and char_length(email) <= 254),
  display_name text check (display_name is null or char_length(display_name) between 2 and 80),
  role public.user_role not null default 'student',
  school_id uuid references public.schools (id) on delete restrict,
  locale text not null default 'pt' check (locale in ('pt', 'en', 'es')),
  -- Declaração de menoridade feita no onboarding. Não guardamos data de nascimento (minimização).
  is_minor boolean,
  onboarded_at timestamptz,
  guardian_consent_at timestamptz,
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint students_need_school check (role <> 'student' or school_id is not null)
);
create index users_school_id_idx on public.users (school_id);

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  kind text not null check (kind in ('terms', 'privacy', 'guardian')),
  document_version text not null,
  granted boolean not null,
  -- Só para kind = 'guardian': quem consentiu (prova do consentimento, LGPD art. 14 §1).
  guardian_email text check (guardian_email is null or guardian_email = lower(guardian_email)),
  ip_hash text,
  created_at timestamptz not null default now(),
  constraint guardian_email_only_for_guardian check ((kind = 'guardian') = (guardian_email is not null))
);
create index consents_user_id_idx on public.consents (user_id);

-- ---------------------------------------------------------------------------
-- Tabelas privadas (somente back-end, papel dono)
-- ---------------------------------------------------------------------------

create table private.magic_link_tokens (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email)),
  token_hash bytea not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  ip_hash text,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);
create index magic_link_tokens_expires_idx on private.magic_link_tokens (expires_at);

create table private.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  token_hash bytea not null unique,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_reason text check (revoked_reason in ('logout', 'logout_all', 'admin_shutdown', 'mfa_change')),
  check (expires_at > created_at)
);
create index sessions_user_id_idx on private.sessions (user_id);

create table private.user_mfa (
  user_id uuid primary key references public.users (id) on delete cascade,
  -- Segredos TOTP cifrados com AES-256-GCM (chave fora do banco: DATA_ENCRYPTION_KEY).
  secret_enc text,
  pending_secret_enc text,
  enabled_at timestamptz,
  -- Último passo TOTP aceito: impede reuso do mesmo código (replay).
  last_step bigint,
  updated_at timestamptz not null default now()
);

create table private.mfa_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  token_hash bytea not null unique,
  attempts int not null default 0,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index mfa_challenges_user_idx on private.mfa_challenges (user_id);

create table private.guardian_consent_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  guardian_email text not null check (guardian_email = lower(guardian_email)),
  token_hash bytea not null unique,
  locale text not null default 'pt' check (locale in ('pt', 'en', 'es')),
  expires_at timestamptz not null,
  decided_at timestamptz,
  decision text check (decision in ('grant', 'deny')),
  created_at timestamptz not null default now()
);
create index guardian_requests_user_idx on private.guardian_consent_requests (user_id);

create table private.audit_logs (
  id bigint generated always as identity primary key,
  -- set null: se a conta for excluída, o evento continua, mas sem vínculo com a pessoa.
  actor_id uuid references public.users (id) on delete set null,
  action text not null check (action ~ '^[a-z_]+(\.[a-z_]+)+$'),
  target_type text,
  target_id uuid,
  ip_hash text,
  -- Apenas metadados não sensíveis (ex.: motivo, contagem). Nunca conteúdo, e-mail ou token.
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_actor_idx on private.audit_logs (actor_id, created_at desc);
create index audit_logs_created_idx on private.audit_logs (created_at desc);

-- ---------------------------------------------------------------------------
-- Funções auxiliares para políticas (security definer para não recursar no RLS de users)
-- ---------------------------------------------------------------------------

create function private.current_app_role() returns public.user_role
language sql stable security definer set search_path = ''
as $$
  select u.role from public.users u
  where u.id = (select auth.uid()) and u.disabled_at is null
$$;

create function private.current_school_id() returns uuid
language sql stable security definer set search_path = ''
as $$
  select u.school_id from public.users u
  where u.id = (select auth.uid()) and u.disabled_at is null
$$;

create function private.touch_updated_at() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

create trigger users_touch_updated_at before update on public.users
for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.schools enable row level security;
alter table public.users enable row level security;
alter table public.consents enable row level security;
alter table private.magic_link_tokens enable row level security;
alter table private.sessions enable row level security;
alter table private.user_mfa enable row level security;
alter table private.mfa_challenges enable row level security;
alter table private.guardian_consent_requests enable row level security;
alter table private.audit_logs enable row level security;
-- Tabelas privadas: RLS ligado e nenhuma política = nada acessível para anon/authenticated.

-- users: o aluno vê só a própria linha; admin vê a própria escola; owner vê todos.
create policy users_select_self on public.users
  for select to authenticated
  using (id = (select auth.uid()));

create policy users_select_staff on public.users
  for select to authenticated
  using (
    (select private.current_app_role()) = 'owner'
    or ((select private.current_app_role()) = 'admin'
        and school_id = (select private.current_school_id()))
  );

create policy users_update_self on public.users
  for update to authenticated
  using (id = (select auth.uid()) and disabled_at is null)
  with check (id = (select auth.uid()));

-- schools: cada um vê a própria escola; owner vê todas.
create policy schools_select on public.schools
  for select to authenticated
  using (
    id = (select private.current_school_id())
    or (select private.current_app_role()) = 'owner'
  );

-- consents: leitura dos próprios registros; staff lê os da sua escola (owner: todos).
create policy consents_select_self on public.consents
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy consents_select_staff on public.consents
  for select to authenticated
  using (
    (select private.current_app_role()) = 'owner'
    or ((select private.current_app_role()) = 'admin' and exists (
      select 1 from public.users u
      where u.id = consents.user_id and u.school_id = (select private.current_school_id())
    ))
  );

-- ---------------------------------------------------------------------------
-- Privilégios: começa do zero e concede só o mínimo, por coluna.
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;
revoke all on all tables in schema private from anon, authenticated, public;
revoke all on all functions in schema private from public;
revoke all on all sequences in schema private from public;

grant usage on schema private to authenticated;
grant execute on function private.current_app_role() to authenticated;
grant execute on function private.current_school_id() to authenticated;

grant select on public.schools to authenticated;
grant select (
  id, email, display_name, role, school_id, locale, is_minor,
  onboarded_at, guardian_consent_at, disabled_at, created_at, updated_at
) on public.users to authenticated;
-- O usuário só altera nome e idioma. Papel, escola e status são exclusivos do servidor.
grant update (display_name, locale) on public.users to authenticated;
grant select on public.consents to authenticated;
