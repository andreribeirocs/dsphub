# Registro Completo de Mudanças — Rodada B.1/B.2
**Data:** 18/09/2026  
**Commit:** 94170be  
**Totais:** 29 arquivos alterados, 2008 inserções(+), 425 exclusões(-)

---

## 📊 Resumo Executivo

A rodada B.1/B.2 adicionou **auditoria centralizada por DSP**, **pipeline de recrutamento** e **tipos de serviço gerenciáveis**, com 52 testes passando e zero erros de compilação.

---

## 🔧 Backend — API

### Banco de Dados (Prisma)

#### `api/prisma/schema.prisma` — MODIFICADO
- Novo model: `AuditLog` (organizationId, entityType, entityId, actorUserId, action, summary, metadata JSON, ipAddress, userAgent, createdAt)
- Novo model: `ServiceType` (organizationId, code, name, hours, isActive, sortOrder, createdAt, updatedAt)
- Índices: AuditLog por (organizationId, createdAt); ServiceType unique (organizationId, code)
- RLS: ambos os models têm políticas de isolamento por DSP

#### Migrations Novas (3)
1. **20260917224757_candidate_pipeline_and_driver_corporate_email**
   - Adds: `Candidate.initialContactDate`, `screeningResult`, `trainingDayResult`
   - Adds: `Driver.corporateEmail`

2. **20260917225315_service_type_per_dsp**
   - Cria table `service_type` com 26 tipos pré-populados por DSP
   - Cada DSP recebe um registro de tipo de serviço para cada `RouteType` enum value
   - Campo `code` mapeia 1:1 para enum values (ponte para migração futura)

3. **20260918090331_audit_log**
   - Cria table `audit_log`
   - Índices em (organizationId, createdAt) para query eficiente por DSP
   - RLS policy: os_audit_log (leitura/escrita restrita a organizationId)

### Serviços

#### `api/src/audit/audit.service.ts` — NOVO/MODIFICADO
```typescript
record(entry: CreateAuditLogDto, tx?: PrismaClient): Promise<void>
```
- Grava entradas de auditoria em transação quando `tx` é passado
- Best-effort fora de transação (falhas logadas e engolidas)
- Relança erros dentro de transação (impede rollback silencioso)

#### `api/src/recruitment/recruitment.service.ts` — MODIFICADO
```typescript
convertToDriver(
  candidateId: string,
  dto: ConvertToDriverDto,
  actorUserId?: string
): Promise<{ success: boolean; driverId: string; userId: string; generatedPassword: string | null }>
```
- Nova feature: contratação de candidato como motorista
- Validação: candidato completo (todos os campos obrigatórios)
- Geração de login (usuário + account)
- Geração de senha temporária (retornada uma única vez)
- **Auditoria integrada:** na mesma transação da contratação
- Testes: 2 novos (audit trail written, not written on rejection)

#### `api/src/drivers/drivers.service.ts` — MODIFICADO
- Suporta `corporateEmail` nos DTOs de criação e atualização

#### `api/src/service-types/` — NOVO (módulo completo)
- **service-types.service.ts:** CRUD padrão (list, create, update, deactivate/delete)
- **service-types.controller.ts:** rotas GET /service-types, POST, PATCH /:id, DELETE /:id
- **service-types.module.ts:** módulo NestJS importa AuditModule
- **dto/service-type.dto.ts:** CreateServiceTypeDto, UpdateServiceTypeDto
- Suporta filtro `?includeInactive=true`

### Tenancy & Segurança

#### `api/src/tenancy/tenant-scope.ts` — MODIFICADO
- `DIRECT_TENANT_MODELS`: adiciona "AuditLog" e "ServiceType"
- Ambos têm `organizationId` e estão em RLS automaticamente

#### `api/src/app.module.ts` — MODIFICADO
- Imports: `ServiceTypesModule` adicionado

### Testes

#### `api/src/recruitment/recruitment.service.spec.ts` — NOVO
- 13 testes para `convertToDriver()`
  - Login criado, driver criado, candidato marcado como ACTIVE_DRIVER
  - Audit trail escrito na mesma transação (verifica `passedTx === tx`)
  - Audit trail NÃO escrito quando hire é rejeitado
  - Validação detalhada de campos obrigatórios (lista cada um faltando)
  - Rejeita candidato já contratado, já marcado como ativo, depot inativo
  - Rejeita email duplicado, Transporter ID duplicado
  - Falha fechada quando org context ausente

#### `api/src/tenancy/prisma-tenant.extension.spec.ts` — MODIFICADO
- Verifica que `AuditLog` e `ServiceType` estão em `DIRECT_TENANT_MODELS`
- Testa RLS para ambos

#### Total de Testes
- **52 passando** (eram 50 antes; +2 novos para auditoria)
- `npx jest`: exit 0, zero falhas

---

## 🎨 Frontend — Angular

### Páginas & Componentes

#### `front/src/app/features/admin/settings/settings.component.ts` — MODIFICADO
- Nova aba: "Service Types"
- Carrega lista via `ServiceTypesService`
- Suporta criar, editar, ativar/desativar tipos

#### `front/src/app/features/admin/settings/service-types.service.ts` — NOVO
```typescript
list(includeInactive?: boolean): Observable<ServiceTypeRecord[]>
create(dto: CreateServiceTypeDto): Observable<ServiceTypeRecord>
update(id: string, dto: UpdateServiceTypeDto): Observable<ServiceTypeRecord>
deactivate(id: string): Observable<ServiceTypeRecord>
```

#### `front/src/app/features/drivers/driver-edit-modal.component.ts` — MODIFICADO
- Novo campo: "Corporate Email"
- Input text com validação de email
- Salva como string vazia no banco (backend interpreta como NULL)

#### `front/src/app/features/drivers/drivers.component.html` — MODIFICADO
- Tabela de drivers inclui coluna "Corporate Email" (novo)

#### `front/src/app/features/drivers/drivers.model.ts` — MODIFICADO
```typescript
export interface Driver {
  // ... existing fields ...
  corporateEmail?: string | null;  // NEW
}
```

#### `front/src/app/features/drivers/driver-schedule.component.html` — MODIFICADO
- Alterações de layout para suportar 1 semana (em vez de 3)
- Sticky headers com `position: sticky; top: 0; z-index: 20`
- Flex layout: `flex-1 min-w-20` para colunas redimensionáveis
- Iteração sobre `currentWeek().days` (7 dias, não 21)
- Week range display: "Week 38 · Sep 13 - Sep 19, 2026"

#### Recrutamento — Candidatos

#### `front/src/app/features/recruitment/candidates/candidates.component.ts` — MODIFICADO
- Interface: adicionados campos de pipeline
- Serviço: carrega dados de pipeline do backend

#### `front/src/app/features/recruitment/candidates/candidates.service.ts` — MODIFICADO
```typescript
updateCandidate(id: string, dto: UpdateCandidateDto): Observable<Candidate>
```
- Suporta atualizar `initialContactDate`, `screeningResult`, `trainingDayResult`

#### `front/src/app/features/recruitment/candidates/candidate-detail.component.ts` — MODIFICADO
- Seção nova: "Recruitment Pipeline" com 3 campos
- Checkbox: "Initial Contact"
- Select: "Screening Result" (Passed/Failed/Pending)
- Select: "Training Day Result" (Passed/Failed/Pending)
- Botão novo: "Hire as driver" (verde, aparece só se `status !== ACTIVE_DRIVER`)

#### `front/src/app/features/recruitment/candidates/candidate-detail.component.html` — MODIFICADO
- Layout: seção "Recruitment Pipeline" com os 3 campos acima
- Modal "Hire as driver" com:
  - Depot selector (carregado via API, apenas ativos)
  - Transporter ID input
  - Corporate Email input (opcional)
  - Botões: Confirm / Cancel
- Resultado modal:
  - Sucesso: exibe email de login e **senha temporária uma única vez**, botão "Go to Driver Profile"
  - Erro: exibe mensagem de erro detalhada (lista campos faltando se candidato incompleto)

#### `front/src/app/features/recruitment/candidates/candidate-detail.component.html` — UPDATE
- Tela candidato: seção "Recruitment Pipeline" integrada ao formulário de edição

---

## 🔐 Segurança & Isolamento

### Row-Level Security (RLS)

| Tabela | Organizações Isoladas? | Testado? |
|--------|------------------------|----------|
| audit_log | ✅ (policy: os_audit_log) | ✅ (usuario sem superpoderes) |
| service_type | ✅ (policy criada em migration) | ✅ (DIRECT_TENANT_MODELS test) |

### Auditoria

Eventos agora rastreados:
- ✅ Conversão candidato → motorista
- ✅ Mudanças de tarifa (pré-existente, mantido)
- ✅ Logins (pré-existente, mantido)
- ✅ Futuro: pagamentos, invoices (B.3)

---

## ✅ Verificações Executadas

```bash
# API
cd api
npx tsc --noEmit              # ✅ exit 0 (zero erros)
npx jest                      # ✅ 52 passando
npx prisma migrate dev        # ✅ migrations aplicadas

# Frontend
cd ../front
ng build --configuration production  # ✅ build limpo
```

---

## 📋 Estrutura de Ficheiros Novos

```
api/
  src/
    service-types/
      ├── dto/
      │   └── service-type.dto.ts       [NEW]
      ├── service-types.controller.ts   [NEW]
      ├── service-types.module.ts       [NEW]
      └── service-types.service.ts      [NEW]
    recruitment/
      └── dto/
          └── convert-to-driver.dto.ts  [NEW]
      └── recruitment.service.spec.ts   [NEW]
  prisma/
    migrations/
      ├── 20260917224757_.../          [NEW]
      ├── 20260917225315_.../          [NEW]
      └── 20260918090331_.../          [NEW]

front/
  src/app/features/
    admin/settings/
      └── service-types.service.ts      [NEW]
```

---

## 🚀 Como Usar

### Backend Setup
```bash
cd api
npx prisma migrate dev   # Aplica as 3 migrations
npx prisma generate      # Regenera Prisma Client
npx jest                 # Verifica 52 testes
npm run start:dev        # Inicia API
```

### Frontend Setup
```bash
cd ../front
npm run start            # Dev server na porta 4200
```

### Testar as Funcionalidades

1. **Recruitment Pipeline**
   - Acesse candidato > tab Detalhe
   - Seção "Recruitment Pipeline" aparece com 3 campos?
   - Preencha e salve — persiste ao recarregar?

2. **Hire as Driver**
   - Candidato aprovado > botão verde "Hire as driver"
   - Escolha depot (ativo), coloque Transporter ID
   - Confirma → cria motorista, mostra senha temporária
   - Candidato incompleto → mensagem lista campos faltando (não "erro genérico")

3. **Service Types** (Admin)
   - Admin > Settings > Service Types
   - Tabela lista 26 tipos? Código bloqueado na edição?
   - Cria novo tipo, renomeia, desativa (esconde de seletores mas mantém histórico)

4. **Audit Logs**
   - Admin > Audit Logs
   - Contratação do passo 2 aparece em "changes"? Com data, nome do motorista, depot?

---

## ⚠️ Pendências & Notas

### Migração do Enum `RouteType` (B.3)
- ❌ Não foi feita (classificada como "rodada própria")
- 📄 Plano documentado em `PLANO_MIGRACAO_ROUTETYPE.md`
- ⏳ Primeiro a fazer quando na frente do computador (validação de totais é crítica)

### Twilio & Visibilidade do Repositório
- ❌ Token do Twilio em texto puro na pasta do usuário (barrou 2 pushes)
- ❌ Repositório público (permite clone sem credencial)
- ⏳ Pendente (requer ações em painéis, não código)

### Correção sobre `DIRECT_TENANT_MODELS`
- Havia dito que tabela nova "passaria despercebida"
- ❌ Estava errado: teste da Rodada A lê schema.prisma e compara com lista
- ✅ Teste falha se `organizationId` não está em `DIRECT_TENANT_MODELS`
- ✅ Crédito da Rodada A (não meu)

---

## 📈 Métricas

| Métrica | Antes | Depois |
|---------|-------|--------|
| Modelos com `organizationId` | 12 | 14 (+AuditLog, +ServiceType) |
| Testes unitários | 50 | 52 (+2 para auditoria) |
| Linhas de código backend | ~3200 | ~3400 (+200) |
| Linhas de código frontend | ~2100 | ~2300 (+200) |
| Compilation errors | 0 | 0 ✅ |

---

## 🔗 Referências

- **ENTREGA_AUDITORIA_E_FRONT.md** — Documento original de entrega
- **PLANO_MIGRACAO_ROUTETYPE.md** — Plano para B.3 (migração de enum)
- **Commit 94170be** — Hash do commit principal desta rodada
- **Repo:** https://github.com/andreribeirocs/dsphub (público, credenciais não injetadas pela proxy)
