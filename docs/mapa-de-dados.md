# Mapa de dados (LGPD) — AZ Internacional

Versão: 2026-11-18 · Cobre o que o código da **Fase 1** coleta. Cada fase nova atualiza este documento.

Base legal resumida: consentimento do titular (LGPD art. 7º I); execução do serviço (art. 7º V);
segurança e prevenção a fraude (art. 7º IX).

**Público:** estudantes a partir de 13 anos (decisão do produto, 2026-11-18). O consentimento parental
específico do art. 14 §1º vale para crianças (até 12 anos) e não se aplica. Para adolescentes vale o
melhor interesse (art. 14 caput; Enunciado CD/ANPD nº 1/2023). A plataforma **não verifica idade**:
a regra depende do vínculo escolar (só e-mail de escola cadastrada cria conta). Confirmar com o jurídico.

## Dados coletados

| Dado                                                             | Onde fica                                                       | Finalidade                               | Base legal                                  | Retenção                                                                          | Quem acessa                           |
| ---------------------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------- |
| E-mail institucional                                             | `public.users.email`                                            | Login, identificação                     | Consentimento / execução                    | Até excluir a conta                                                               | Próprio aluno; admin da escola; owner |
| Nome de exibição                                                 | `public.users.display_name`                                     | Identificação na interface               | Consentimento                               | Até excluir a conta                                                               | Próprio aluno; admin da escola; owner |
| Idioma                                                           | `public.users.locale`                                           | Interface e e-mails no idioma certo      | Execução                                    | Até excluir a conta                                                               | Próprio aluno; staff                  |
| Escola                                                           | `public.users.school_id`                                        | Vincular aluno à escola; escopo do admin | Execução                                    | Até excluir a conta                                                               | Próprio aluno; staff                  |
| Hash da senha (scrypt)                                           | `private.user_credentials`                                      | Login com senha                          | Execução / segurança                        | Até excluir a conta                                                               | Só back-end                           |
| Data de confirmação do e-mail                                    | `public.users.email_verified_at`                                | Garantir que o e-mail é do titular       | Segurança                                   | Até excluir a conta                                                               | Próprio aluno; staff                  |
| Hash dos links de confirmação e de nova senha                    | `private.email_tokens`                                          | Confirmar e-mail, recuperar senha        | Execução / segurança                        | 24 h / 30 min de validade; registro: **até 30 dias (job pendente)**               | Só back-end                           |
| Aceite de termos e privacidade (versão, data, IP pseudonimizado) | `public.consents`                                               | Prova do consentimento                   | Obrigação legal (art. 8º §2º)               | Até excluir a conta                                                               | Próprio aluno; staff                  |
| Hash do link de acesso                                           | `private.magic_link_tokens`                                     | Login sem senha                          | Execução                                    | Link vale 15 min; registro: **até 30 dias (job de limpeza pendente, Fase 6)**     | Só back-end                           |
| Hash da sessão, datas de criação/último uso                      | `private.sessions`                                              | Manter login, revogar sessões            | Execução / segurança                        | 7 dias de validade; registro: **até 30 dias após expirar (job pendente, Fase 6)** | Só back-end                           |
| Segredo TOTP (cifrado AES-256-GCM)                               | `private.user_mfa`                                              | Verificação em duas etapas               | Segurança                                   | Até desativar 2FA ou excluir a conta                                              | Só back-end                           |
| Desafios de 2FA (hash, tentativas)                               | `private.mfa_challenges`                                        | Limitar tentativas de código             | Segurança                                   | 5 min de validade; registro: **até 30 dias (job pendente)**                       | Só back-end                           |
| Auditoria (ação, data, id do autor, IP pseudonimizado)           | `private.audit_logs`                                            | Segurança, investigação de incidentes    | Legítimo interesse / segurança (art. 7º IX) | **12 meses (job pendente)**; ao excluir conta, perde o vínculo com a pessoa       | Só back-end (painel owner na Fase 6)  |
| IP                                                               | Não armazenado em claro. Só HMAC com pepper secreto (`ip_hash`) | Limite de taxa, auditoria                | Segurança                                   | Junto do registro onde aparece                                                    | Só back-end                           |

## Dados que NÃO coletamos

CPF, RG, endereço, telefone, data de nascimento, idade, dados de responsável, foto de perfil,
geolocalização. Logs de aplicação
não registram IP, cookies, query string, corpo de requisição nem e-mail (redação no pino).

## Operadores (compartilhamento)

| Operador                       | Uso                                                         | Transferência internacional                                         |
| ------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------- |
| Supabase                       | Banco Postgres                                              | Depende da região escolhida no projeto (escolher `sa-east-1` evita) |
| Brevo                          | Envio de e-mail transacional (destinatário, assunto, corpo) | Sim (UE)                                                            |
| Cloudflare                     | Proxy/DNS/proteção (vê IP e tráfego)                        | Sim                                                                 |
| Hospedagem da API e do front   | Executa o código                                            | Depende do provedor                                                 |
| OpenRouter + modelos (Fase 2+) | IA. Ainda **não** usado na Fase 1                           | Sim (EUA)                                                           |

## Exclusão

`POST /api/account/delete` apaga a linha em `public.users`; as FKs `on delete cascade` apagam
consentimentos, sessões, senha, 2FA, desafios e tokens de e-mail. Tokens de login do e-mail são
apagados explicitamente. Na auditoria, `actor_id` vira `null` (o evento fica, sem vínculo). Teste:
`apps/api/test/integration/account.test.ts`.

## Pendências de conformidade

1. Job de limpeza com os prazos acima (Fase 6). Hoje os registros expirados **não** são apagados.
2. Exportação de dados (portabilidade, art. 18 V) — Fase 6.
3. Contas criadas e nunca confirmadas (cadastro sem clicar no link): definir prazo de exclusão automática (Fase 6).
4. Preencher controlador, CNPJ e encarregado na política; revisão jurídica dos textos.
