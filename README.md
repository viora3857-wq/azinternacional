# AZ Internacional

Portal educacional para alunos do ensino médio que querem entrar em faculdades no Brasil e no exterior.

**Estado atual: Fase 1** — estrutura, autenticação (senha + confirmação de e-mail + recuperação, magic link e 2FA), banco com RLS, LGPD, CI e deploy (Render + Vercel).
Boletim, faculdades, IA, provas e painéis de admin/owner ainda **não** existem (fases 2 a 6).

## Stack

| Camada    | Tecnologia                                                                                    |
| --------- | --------------------------------------------------------------------------------------------- |
| Front-end | React 19 + Vite 8 + TypeScript, Tailwind 4, React Query 5, React Router 7, i18next (PT/EN/ES) |
| Back-end  | Node 22 + Express 5 + TypeScript, Zod 4, pino                                                 |
| Banco     | Supabase (Postgres) com Row Level Security                                                    |
| E-mail    | Brevo (API transacional v3)                                                                   |
| Testes    | Vitest (unitários e integração), Supertest, Playwright + axe-core (E2E e WCAG)                |
| CI        | GitHub Actions: lint, formato, tipos, unitários, integração com Postgres real, build, E2E     |

## Estrutura

```
apps/
  api/                 Express. Um módulo por domínio, sem arquivo gigante.
    src/config/        Variáveis de ambiente validadas com Zod (recusa config insegura em produção)
    src/db/            Pool + `asUser` (RLS aplicado) e `system` (fluxos do servidor)
    src/lib/           Criptografia, TOTP (RFC 6238), erros, logger com redação
    src/middleware/    Sessão, papéis, CSRF por Origin, rate limit, tratamento de erro
    src/modules/       auth · account · admin · audit · email · health · dev
    test/unit          Regras puras
    test/integration   Rotas + RLS contra Postgres real
  web/                 React. Telas em src/features, design system em src/components/ui
packages/shared/       Schemas Zod e tipos usados pelos dois lados (uma só fonte de validação)
supabase/migrations/   SQL das tabelas, RLS e grants
supabase/seed.sql      Dados de demonstração
e2e/                   Playwright
docs/mapa-de-dados.md  Mapa de dados LGPD
```

## Rodar localmente

Pré-requisitos: Node 22 e Postgres 15+ (local ou Docker). O Supabase só é necessário para produção.

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Crie o `.env` a partir do exemplo e preencha as duas chaves secretas:

   ```bash
   cp .env.example .env
   ```

   ```bash
   sed -i "s|^DATA_ENCRYPTION_KEY=$|DATA_ENCRYPTION_KEY=$(openssl rand -base64 32)|; s|^HASH_PEPPER=$|HASH_PEPPER=$(openssl rand -hex 32)|" .env
   ```

   No macOS use `sed -i ''` no lugar de `sed -i`.

3. Crie o banco local com migrações e seed. O script recusa hosts que não sejam locais.

   ```bash
   DATABASE_URL=postgres://postgres:postgres@localhost:5432/az_dev npm run db:setup
   ```

4. Suba API (porta 3000) e front (porta 5173):

   ```bash
   npm run dev
   ```

5. Abra http://localhost:5173. Crie uma conta em "Criar conta" com qualquer `*@escola.example`.
   Com `EMAIL_PROVIDER=dev` nenhum e-mail sai: os links (confirmação, nova senha, magic link) ficam em
   http://localhost:5173/api/dev/outbox (rota que **não existe** em produção).

### Contas de demonstração (seed)

As contas do seed **não têm senha**. Entre por "Receber link de acesso por e-mail" ou defina uma
senha em "Esqueci minha senha".

| E-mail                      | Papel      | Observação                                                             |
| --------------------------- | ---------- | ---------------------------------------------------------------------- |
| `owner@az.example`          | owner      | Fora do domínio escolar; entra porque a conta existe                   |
| `admin@escola.example`      | admin      | Colégio Demonstração                                                   |
| `aluno@escola.example`      | aluno      | Cadastro concluído                                                     |
| qualquer `*@escola.example` | aluno novo | Criado no cadastro, passa pela confirmação de e-mail e pelo onboarding |

## Testes

```bash
npm run lint && npm run format:check && npm run typecheck
```

```bash
npm run test:unit
```

Integração (recria o banco `az_test` do zero):

```bash
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/az_test npm run test:integration
```

E2E (recria `az_e2e`, sobe a API compilada e o front em modo preview):

```bash
npm run build && npm run test:e2e
```

## Segurança: como está implementado

- **Senha** com scrypt (N=2^15, r=8, p=1; nativo do Node), mínimo de 10 caracteres sem regras de
  composição (NIST 800-63B). Cadastro exige confirmar o e-mail (link de 24 h). Recuperação por link
  de 30 min, de uso único, que derruba todas as sessões. Trocar a senha logado exige a atual e
  derruba as outras sessões. Login errado e e-mail inexistente têm a mesma resposta e o mesmo
  custo de tempo; limite de 10 tentativas por e-mail a cada 15 min.
- **Magic link** (alternativa sem senha): uso único, 15 min, guardado só como SHA-256. O token vai no
  fragmento `#token=` (não aparece em logs de servidor nem no Referer) e é trocado por sessão via
  POST, então leitores de link de antivírus não o consomem. Pedir link novo invalida o anterior.
- **Sem enumeração de contas.** Pedido de link responde igual para e-mail cadastrado ou não.
  Limite: 5 pedidos por e-mail por hora e 30 por IP a cada 15 min.
- **Sessão** em cookie `HttpOnly`, `SameSite=Lax`, `Secure` e prefixo `__Host-` em produção.
  Guardada como hash, revogável no servidor (logout, "sair de todos", shutdown do admin).
- **2FA (TOTP)** opcional, compatível com Google/Microsoft Authenticator. Segredo cifrado com
  AES-256-GCM, anti-replay de código, 5 tentativas por desafio. Ativar ou desativar derruba as
  outras sessões.
- **CSRF**: toda requisição que altera estado precisa do header `Origin` igual a `APP_URL`.
- **Papéis checados no servidor** a cada requisição (lidos do banco, não do cliente).
- **RLS de verdade.** As consultas do usuário rodam com `set local role authenticated` + claims,
  então o Postgres aplica as políticas mesmo se o back-end errar. Grants por coluna: o aluno não
  altera papel nem escola nem com SQL direto. Tabelas de auth ficam no schema `private`, sem acesso
  para `anon`/`authenticated`. Um teste falha se alguma tabela ficar sem RLS.
- **Validação Zod** em toda entrada, com o mesmo schema no front e no back. Erros devolvem só o
  nome dos campos, nunca o valor. Corpo JSON limitado a 64 KB.
- **Logs** sem IP, cookie, query string, corpo ou e-mail. IPs são pseudonimizados (HMAC + pepper).
- **Auditoria** em `private.audit_logs`: quem, o quê, quando, sem conteúdo.

## Deploy (Render + Vercel + Supabase)

Fluxo: push na `main` → CI → (se verde) `deploy.yml`: migrações no Supabase → deploy da API no
Render → espera `/api/health` responder com o commit novo → deploy do front no Vercel.
O navegador só fala com o domínio do Vercel; o Vercel repassa `/api/*` ao Render (rewrite).
Assim o cookie de sessão é first-party e não há CORS.

**Configuração única (manual):**

1. **Supabase:** crie o projeto em `us-east-1` (mesma região do Render; o Render não tem região no
   Brasil). Copie a connection string do pooler (modo transaction).
2. **Render:** New → Blueprint → este repositório (lê `render.yaml`). Preencha as variáveis
   marcadas `sync: false`. `APP_URL` = domínio do Vercel. Em Settings → Deploy Hook, copie a URL.
3. **Vercel:** importe o repositório com Root Directory `apps/web`. Troque
   `az-internacional-api.onrender.com` em `apps/web/vercel.json` pelo domínio real do Render.
   Desligue o deploy automático do Git (o deploy é feito pelo Actions).
4. **Brevo:** verifique o domínio remetente (SPF/DKIM) e crie a API key.
5. **GitHub** → Settings → Environments → `production`:
   - Secrets: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF`,
     `RENDER_DEPLOY_HOOK_URL`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.
   - Variable: `API_HEALTH_URL` = `https://<seu-servico>.onrender.com/api/health`.
6. **Branch protection** na `main`: exija os checks `Lint, formato, tipos, unitários e build`,
   `Integração + RLS (Postgres)` e `End-to-end (Playwright + axe)`. Isso garante "nenhum merge com
   teste falhando"; não dá para versionar no repositório.
7. **Cloudflare:** use para DNS. O Vercel desaconselha proxy da Cloudflare na frente dele (já tem
   CDN e proteção próprios); se ligar o proxy, ajuste `TRUST_PROXY_HOPS` para 3.

Não rode `scripts/db-setup-local.sh` nem `supabase/test/supabase-shim.sql` no Supabase.

## Pendências conhecidas

Ver também `docs/mapa-de-dados.md`.

- Job de limpeza de tokens, sessões e auditoria expirados (Fase 6).
- Rate limit em memória: com mais de uma instância da API, trocar por Redis.
- Códigos de recuperação de 2FA não existem; quem perder o celular depende de reset pelo admin (Fase 6).
- A URL `*.onrender.com` fica pública: quem chamar a API direto (sem passar pelo Vercel) consegue
  forjar o IP usado no rate limit por IP. Os limites por e-mail e por usuário continuam valendo.
  Correção possível: middleware no Vercel que injete um segredo e a API recusar sem ele.
- O deploy (Render, Vercel, Supabase CLI) não foi executado: depende das contas e segredos.
- Textos legais são rascunho com campos `[A PREENCHER]`; precisam de revisão jurídica.
- Integração com Brevo coberta por teste com `fetch` simulado; envio real não foi testado (sem chave).
