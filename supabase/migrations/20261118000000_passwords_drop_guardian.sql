-- Ajuste da Fase 1 (decisão de produto, 2026-11-18):
--  1. Login com senha, confirmação de e-mail e recuperação de senha (o magic link continua como alternativa).
--  2. Remove o consentimento do responsável: todos os alunos têm 13+ anos. Para adolescentes a base
--     é o consentimento do próprio titular no seu melhor interesse (LGPD art. 14 caput; Enunciado ANPD 1/2023).
--     Também deixamos de perguntar a idade (minimização: o dado não muda mais nenhum tratamento).

-- 1. Senhas e tokens de e-mail ------------------------------------------------------------------

alter table public.users add column email_verified_at timestamptz;
-- Quem já entrou por magic link provou acesso à caixa de e-mail.
update public.users set email_verified_at = coalesce(onboarded_at, created_at);
grant select (email_verified_at) on public.users to authenticated;

create table private.user_credentials (
  user_id uuid primary key references public.users (id) on delete cascade,
  -- scrypt (formato: scrypt$N$r$p$salt$hash). Nunca a senha.
  password_hash text not null check (password_hash like 'scrypt$%'),
  updated_at timestamptz not null default now()
);

create table private.email_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  purpose text not null check (purpose in ('verify_email', 'password_reset')),
  token_hash bytea not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);
create index email_tokens_user_purpose_idx on private.email_tokens (user_id, purpose);

alter table private.user_credentials enable row level security;
alter table private.email_tokens enable row level security;
revoke all on private.user_credentials, private.email_tokens from anon, authenticated, public;

alter table private.sessions drop constraint sessions_revoked_reason_check;
alter table private.sessions add constraint sessions_revoked_reason_check check (
  revoked_reason in ('logout', 'logout_all', 'admin_shutdown', 'mfa_change', 'password_change', 'password_reset')
);

-- 2. Remove o fluxo do responsável -------------------------------------------------------------

drop table private.guardian_consent_requests;
delete from public.consents where kind = 'guardian';
alter table public.consents drop constraint guardian_email_only_for_guardian;
alter table public.consents drop column guardian_email;
alter table public.consents drop constraint consents_kind_check;
alter table public.consents add constraint consents_kind_check check (kind in ('terms', 'privacy'));
alter table public.users drop column is_minor;
alter table public.users drop column guardian_consent_at;
