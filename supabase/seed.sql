-- Dados de DEMONSTRAÇÃO. Domínios .example são reservados (RFC 2606): nenhum e-mail real é afetado.
insert into public.schools (id, name, email_domain) values
  ('00000000-0000-4000-8000-000000000001', 'Colégio Demonstração', 'escola.example')
on conflict (id) do nothing;

-- Sem senha: entre por magic link ou defina uma em "Esqueci minha senha".
insert into public.users (id, email, display_name, role, school_id, locale, onboarded_at, email_verified_at) values
  ('00000000-0000-4000-8000-000000000010', 'owner@az.example', 'Owner Demo', 'owner', null, 'pt', now(), now()),
  ('00000000-0000-4000-8000-000000000011', 'admin@escola.example', 'Admin Demo', 'admin',
   '00000000-0000-4000-8000-000000000001', 'pt', now(), now()),
  ('00000000-0000-4000-8000-000000000012', 'aluno@escola.example', 'Aluno Demo', 'student',
   '00000000-0000-4000-8000-000000000001', 'pt', now(), now())
on conflict (id) do nothing;

insert into public.consents (user_id, kind, document_version, granted)
select u.id, k.kind, '2026-11-18', true
from public.users u
cross join (values ('terms'), ('privacy')) as k (kind)
where u.id in (
  '00000000-0000-4000-8000-000000000010',
  '00000000-0000-4000-8000-000000000011',
  '00000000-0000-4000-8000-000000000012'
)
and not exists (select 1 from public.consents c where c.user_id = u.id and c.kind = k.kind);
