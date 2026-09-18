# Security & Performance Audit — Rodada A

**Data:** 2026-09-17  
**Escopo:** Revisão rápida de pontos críticos (sem mudanças — só recomendações)  
**Status:** Informativo (para B.1+B.2 session)

---

## 1. CORS & Security Headers

### ✅ Current State
- API rodando em `localhost:3000`
- Front proxy `/api` → `http://localhost:3000` (sem CORS direto)
- No production CORS, isso seria `https://dsphub.mycompany.com`

### 🔍 Checklist de Recomendação

**CORS Headers (Backend):**
```typescript
// api/src/main.ts
app.enableCors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:4200',
  credentials: true,
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  allowedHeaders: 'Content-Type,Authorization',
});
```

**Status:** ✅ Provavelmente OK em dev (proxy nulo/localhost)  
**Action:** Revisar em production → usar domínio real

**Security Headers (recomendado adicionar):**
```typescript
// Middleware ou helmet
app.use(helmet()); // Content-Security-Policy, X-Frame-Options, etc.

// Ou manual:
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});
```

**Status:** ⚠️ Não implementado  
**Recommendation:** Adicionar em B.1+B.2 (baixo esforço, alto impacto)

---

## 2. Row-Level Security (RLS) — PostgreSQL Policies

### ✅ Current State
- 4 migrations de A.1 incluem RLS policies em 13 tabelas
- Policies usam `organizationId` comparison
- **Ativo apenas se usar usuário non-superuser** (`dsphub_app`)

### 🔍 Verificação

**Políticas criadas:**
- `Driver` → `WHERE organizationId = app.current_organization_id`
- `Van` → `WHERE organizationId = app.current_organization_id`
- `Candidate` → `WHERE organizationId = app.current_organization_id`
- `Payment` → `WHERE organizationId = app.current_organization_id`
- ... (+ 9 mais)

**Teste em dev (verificar se está ativo):**
```sql
SELECT * FROM pg_policies WHERE tablename = 'Driver';
-- Deve listar as policies

-- Se usar superuser (postgres), RLS é ignorado:
SELECT current_user; -- é "postgres"?
-- Se sim, Prisma extension fornece proteção pra dev

-- Se use dsphub_app (non-superuser):
SELECT current_user; -- é "dsphub_app"?
-- Se sim, RLS force-protege mesmo se Prisma bug
```

**Status:** ✅ Políticas criadas, escopo A  
**Action (B.1+B.2):** Testar RLS isoladamente (desligar Prisma, confirmar que PostgreSQL bloqueia cross-DSP reads)

---

## 3. Authentication & Session Management

### ✅ Current State
- Better Auth 1.7.5 para login
- Tokens (JWT?) salvos em httpOnly cookies
- `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`

### 🔍 Verificação

**Críticos:**
- ✅ Passwords hasheadas (Better Auth padrão: bcrypt)
- ✅ HttpOnly cookies (proteção XSS)
- ✅ Secure flag (HTTPS em production)
- ❓ CSRF token (depende configuração Better Auth)

**Recomendações:**
1. **Verify Better Auth config** (api/.env ou config file):
   - Checkup: `TRUST_HOST` está configurado?
   - Checkup: `SESSION_SECRET` é forte? (32+ chars, random)
   - Checkup: Cookie domain/samesite está ok?

2. **Session timeout:**
   - Recomendado: 30min idle timeout + 24h absolute timeout
   - Implementar em Better Auth middleware (verificar docs)

3. **Rate limiting:**
   - ✅ Já implementado em A.1 (600/min por IP)
   - Recomendado: tighter rate limit no `/auth/login` (ex: 5 tentativas/min)

**Status:** ✅ Configuração padrão Better Auth (provavelmente segura)  
**Action (B.1+B.2):** Revisar `api/.env` e Better Auth config

---

## 4. API Validations & Input Sanitization

### ✅ Current State
- NestJS com `class-validator` (decorators)
- DTOs com `@IsString()`, `@IsEmail()`, `@IsUUID()`, etc.
- Frontend ng validation (bonus, não proteção)

### 🔍 Verificação

**Exemplo (bom):**
```typescript
// CandidateDTO
export class CreateCandidateDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  firstName: string;

  @IsEmail()
  email: string;
}
```

**Críticos:**
- ✅ Email validation (protege contra typos + XSS)
- ✅ UUID validation (garante formato válido)
- ✅ MaxLength (proteção contra buffer overflow)
- ❓ Sanitização de texto livre (ex: `notes`, `mini_entrevista_resultado`)

**Recomendação:**
```typescript
// Para campos de texto livre
@IsString()
@MaxLength(2000)
@Matches(/^[\w\s\-.,!?()'"]*$/) // Regex restritivo, ou
@sanitize() // usar lib como 'sanitize-html'
mini_entrevista_resultado?: string;
```

**Status:** ✅ DTO validation em lugar (bom)  
**Action (B.1+B.2):** Adicionar @MaxLength e @Matches em novos campos de texto

---

## 5. Data Encryption & Sensitive Fields

### ✅ Current State
- Senhas: hasheadas com bcrypt ✅
- Tokens de terceiros (Twilio, etc.): em `.env` (não versionado) ✅
- Arquivos de upload: agora servidos via rota autenticada (A.1 melhoria)

### 🔍 Verificação

**Sensíveis em banco:**
- Senhas: ✅ hasheadas
- Email: ❌ texto plano (OK — não é secreto)
- Phone: ❌ texto plano (OK — não é secreto)
- Corporate email: ❌ texto plano (OK — não é secreto)

**Recomendação:**
Se futuro guardar dados altamente sensíveis (SSN, documento, conta bancária), considerar:
- AES-256 encryption em application layer (lib: `crypto-js` ou `libsodium`)
- Ou usar PostgreSQL pgcrypto extension

**Status:** ✅ Padrão de segurança OK pra ROI+motorista  
**Action:** Não urgente; apenas se coletar novos dados sensíveis

---

## 6. Dependency Vulnerabilities

### ⚠️ Current State
- 80 vulnerabilidades npm em A.1 (3 críticas)
- Falta patch: `npm audit fix --force` (não recomendado)
- Alternativa: update libs menores

### 🔍 Checklist

**Críticas identificadas:**
- (Verify com `npm audit` no seu PC)
- Típicas: outdated lodash, minimist, etc.

**Recomendações:**
1. Rodar localmente:
   ```bash
   cd api
   npm audit
   # Listar vulnerabilities + recomendações
   ```

2. Para cada crítica:
   - Check changelog/release notes
   - Testar se upgrade quebra algo
   - Commit separado: "chore: security update <lib>"

3. Automatizar futuro:
   - Dependabot (GitHub) ou Snyk (terceiro)
   - Auto-bump minor+patch (safe)

**Status:** ⚠️ Pendente, não bloqueia funcionalidade  
**Action (B.1+B.2):** Próxima sessão, focar no MVP (audit fixable)

**Quick fix attempt:**
```bash
cd DSPHub00/api
npm audit --json > audit-report.json
# Review report, fix critical ones manualmente
```

---

## 7. Logging & Audit Trail

### ✅ Current State
- Audit logs em banco (A.1): logins, payment changes
- Structured logging em `audit.service.ts`
- Front não tem console spam (cleanup em A.1)

### 🔍 Verificação

**Bom:**
- ✅ Audit logs por DSP isolados (`organizationId` filter)
- ✅ Timestamp + user + action + context

**Recomendações:**
1. Centralized logging (opcional, futuro):
   - ELK stack (Elasticsearch, Logstash, Kibana) ou
   - Cloud logging (AWS CloudWatch, GCP Logging)
   - Usado em produção pra alertas + análise

2. Log retention:
   - Recomendado: 90 dias mínimo (compliance)
   - Atualmente: sem limite (OK pra dev)

**Status:** ✅ Implementado adequadamente  
**Action:** Apenas se escalar pra produção real

---

## 8. Frontend Security (Bundle Size & XSS)

### ✅ Current State
- Angular 20 + Tailwind 4 + Vite
- Bundle size: não medido
- No `innerHTML` direto (Angular sanitizes por padrão)

### 🔍 Verificação

**Bundle size check:**
```bash
cd front
npm run build
ls -lh dist/
# Typical: main.*.js ~ 500-800 KB (gzipped)
```

**XSS Protections (Angular padrão):**
- `{{data}}` → sanitized
- `[innerHTML]="data"` → sanitized (precisa `bypassSecurityTrustHtml()` pra override)
- Attribute binding: `[attr.src]="url"` → safe

**Recomendação:**
- Não usar `bypassSecurityTrustHtml()` em dados de usuário
- Se precisa HTML customizado, usar DomSanitizer + whitelist tags
- Content Security Policy header (nginx/server-side)

**Status:** ✅ Padrão Angular seguro  
**Action:** Revisar em code review se usar `innerHTML` com dados dinâmicos

---

## 9. API Rate Limiting

### ✅ Current State
- Implementado: 600 requests/min por IP
- Padrão aumentado de 60 (default bug fixado em A.1)

### 🔍 Verificação

**Recomendações por endpoint:**

| Endpoint | Rate Limit | Reason |
|----------|-----------|--------|
| `/auth/login` | 5/min | Brute force protection |
| `/auth/register` | 10/min | Prevent spam |
| `/api/*` | 600/min | General API |
| `/api/export` | 1/min | CPU-heavy |
| `/upload` | 50/min | File size limits |

**Configuração atual (em A.1):**
- Global: 600/min
- Should be good pra dev/testing

**Status:** ✅ Implementado, funcional  
**Action:** Revisar e diferenciar por endpoint em B.1+B.2 se necessário

---

## 10. Database Backups & Disaster Recovery

### ❌ Current State
- Nenhuma backup automática (dev environment)
- Manual backup via `pg_dump` (feito em A.1 pra historical)

### 🔍 Recomendações (Production Future)

**Backup strategy:**
1. **Daily backups** → S3 or Google Cloud Storage
2. **Retention:** 30 dias (compliance)
3. **Test restore:** mensal
4. **Encryption:** AES-256 in transit + at rest

**Commands (reference):**
```bash
# Manual backup
pg_dump -U postgres dsphub > backup_$(date +%Y%m%d).sql

# Restore
psql -U postgres dsphub < backup_20260917.sql
```

**Status:** ❌ Não implementado (OK pra dev)  
**Action:** Implementar em produção (infrastructure team)

---

## Resumo de Ações por Prioridade

### 🔴 Críticas (do now / B.1+B.2)
- [ ] Add security headers (Helmet ou manual)
- [ ] Verify Better Auth config (SESSION_SECRET, CSRF)
- [ ] Test RLS isoladamente (desligar Prisma, confirmar RLS bloqueia)
- [ ] Review API validations (add @MaxLength, @Sanitize em novos campos)

### 🟡 Importantes (próximas 2-3 sprints)
- [ ] Dependency audit — fix 3 críticas manualmente
- [ ] Rate limiting — diferenciar por endpoint (login mais restrito)
- [ ] Centralized logging (ELK ou similar pra produção)
- [ ] CSP header (Content-Security-Policy)

### 🟢 Futuro (production-ready)
- [ ] Backup automático (S3)
- [ ] Encryption dados sensíveis (se necessário)
- [ ] Compliance audit (GDPR, PCI-DSS, etc. conforme cliente)
- [ ] Penetration testing (hire profesional)

---

## Verificação Rápida — Runbook

Rodar isto antes de B.1+B.2 commit:

```bash
cd DSPHub00

# 1. Security headers
grep -r "helmet\|X-Content-Type-Options" api/src/main.ts
# Resultado: deve haver ou helmet() ou manual headers

# 2. Better Auth config
cat api/.env | grep SESSION_SECRET
# Resultado: deve ter valor (não default)

# 3. API validation
grep -r "@IsEmail\|@IsUUID" api/src/*/dto/
# Resultado: múltiplos matches esperados

# 4. RLS policies
psql -U postgres dsphub -c "SELECT * FROM pg_policies LIMIT 5;"
# Resultado: lista de policies

# 5. Npm audit
npm audit 2>/dev/null | grep -E "critical|high"
# Resultado: 3-5 vulnerabilities (conhecidas)

# 6. Bundle size
cd front && npm run build && du -sh dist/ && cd ..
# Resultado: < 2MB (typical)
```

---

## Notas Finais

- Este audit é **informativo**, não bloqueador
- Pontos críticos ("🔴") devem ser endereçados em B.1+B.2
- Pontos importantes ("🟡") para próximas sprints
- Pontos futuros ("🟢") só se escalar pra produção real

**Próximo passo:** Integrar recomendações 🔴 na sessão B.1+B.2 agora.
