# DSPHub Roadmap — Rodada B (Completo)

**Data:** 2026-09-17  
**Status:** Planejado (agendado para 2026-09-17T22:00Z + 2026-09-18T22:00Z)  
**Autor:** Claude Haiku (session 01KMEJWmgSuJfAAc34w9iaWx)

---

## Visão Geral

Rodada B divida em 3 fases, cada uma escalonada:

| Fase | Nome | Foco | Token Estimate | Agendado |
|------|------|------|---|---|
| **B.1+B.2** | Pipeline → Conversão → Tipos de Serviço | Recrutamento + Configuração | 50-65k | 2026-09-17T22:00Z |
| **B.3** | Despacho (Dispatch) | Rota + Van Assignment | 50-60k | 2026-09-18T22:00Z |

**Total Rodada B:** ~100-125k tokens

---

## Rodada B.1 — Pipeline de Recrutamento

### Objetivos
✅ **Novos status no pipeline** — rastrear progresso do candidato (contato inicial, mini-entrevista, teste de treinamento)  
✅ **E-mail corporativo para motorista** — campo adicional no cadastro  
✅ **Conversão Candidato → Motorista** — fluxo completo com criação de usuário DRIVER  

### Escopo Detalhado

#### 1. Modelo de Dados — Candidate

**Migrations:**
- `20260917050000_candidate_pipeline_fields` 
  - ADD `contato_inicial` BOOLEAN (default: FALSE)
  - ADD `mini_entrevista_resultado` TEXT (nullable)
  - ADD `teste_treinamento_resultado` TEXT (nullable)
  - Índices em `organizationId` + campo para filtros rápidos

**Backend:**
- Update `CandidateDTO`, `CandidateResponseDTO`
- Update `recruitment.service.ts` para salvar/retornar campos novos
- Update endpoint `GET /recruitment/candidates/:id` e `PUT /recruitment/candidates/:id`

**Frontend:**
- Update `candidate-detail.component.ts`:
  - Checkbox: "Contato Inicial Realizado?"
  - Textarea: "Resultado Mini-Entrevista"
  - Textarea: "Resultado Teste de Treinamento"
  - Salvar automaticamente ao mudar

---

#### 2. Modelo de Dados — Driver

**Migrations:**
- `20260917051000_driver_corporate_email`
  - ADD `corporateEmail` TEXT (nullable)
  - Índice em `organizationId` + `corporateEmail` para busca única

**Backend:**
- Update `DriverDTO`, `DriverResponseDTO`
- Update `drivers.service.ts`
- Update endpoint `PUT /drivers/:id` para aceitar `corporateEmail`

**Frontend:**
- Update `driver-edit-modal.component.ts`:
  - Campo de input: "E-mail Corporativo (opcional)"
  - Validação: deve ser email válido, se preenchido

---

#### 3. Conversão Candidato → Motorista

**Backend Novo:**
- **Endpoint:** `POST /recruitment/convert-to-driver/:candidateId`
- **Payload:** `{ depot_id: UUID }`
- **Lógica:**
  1. Validar que candidato existe e pertence a este DSP (RLS barrier)
  2. Validar que depot existe, está ativo e pertence a este DSP
  3. Criar Driver:
     - `homeDepotId`: do request
     - `organizationId`: do candidato
     - `firstName`, `lastName`, `email`: do candidato
     - `status`: ACTIVE
  4. Criar User:
     - `role`: DRIVER
     - `driverId`: link bidirecional
     - `email`: do candidate (ou gerar nova)
     - `password`: temporária (reset na próxima login, ou notificar via email)
     - `organizationId`: mesmo DSP
  5. Update Candidate:
     - `status`: CONVERTED (ou criar novo enum)
     - Opcional: soft-delete (`is_archived: true`)
  6. Criar audit log:
     - `action`: "CANDIDATE_CONVERTED_TO_DRIVER"
     - `candidateId`, `driverId`, `depotId`
  7. Return: `{ success: true, driverId, userId, email, message: string }`

- **Validações:**
  - ✅ Candidato deve existir em este DSP (RLS)
  - ✅ Depot deve estar ativo
  - ✅ Candidato não deve ser já convertido (check `status`)
  - ✅ Email único (se criar novo user, não deve colidir)

- **Errors:**
  - `404`: Candidato não encontrado (ou DSP diferente)
  - `400`: Depot inválido, candidato já convertido, email conflict
  - `500`: DB error

**Frontend Novo:**
- Botão "Contratar" em `candidate-detail.component.ts`:
  - Visível apenas se `status === 'CANDIDATE'`
  - Click → Modal com dropdown de depot (carregar depots ativos)
  - Confirmação: "Confirmar contratação deste candidato como motorista?"
  - POST `/recruitment/convert-to-driver/:candidateId` com `depot_id`
  - ✅ Success: redirect `/drivers`, toast "Motorista criado com sucesso"
  - ❌ Error: toast com mensagem da API

**Tests (B.1):**
- ✅ Unit: `convertCandidateToDriver()` validations
- ✅ E2E: conversão bem-sucedida, validações, isolamento DSP, double-conversion rejection
- ✅ +5 novos testes (total 40+)

---

## Rodada B.2 — Tipos de Serviço por DSP + Acesso Manager

### Objetivos
✅ **Tabela de Tipos de Serviço** — substituir enum fixo por cadastro dinâmico por DSP  
✅ **Acesso Manager por Depot** — refinamento de restrições de depot  

### Escopo Detalhado

#### 1. Tabela de Tipos de Serviço

**Migrations:**
- `20260917052000_create_service_type_table`
  - CREATE TABLE `ServiceType`:
    - `id` UUID PK
    - `organizationId` UUID FK (tenancy)
    - `name` VARCHAR (ex: "STANDARD_8H", "SAMEDAY", "NURSERY_L1")
    - `hours` INT (8, 9, 10, etc.)
    - `isActive` BOOLEAN (default: TRUE)
    - `createdAt` TIMESTAMP
    - `updatedAt` TIMESTAMP
    - Unique index: `(organizationId, name)`
    - RLS policy: `WHERE organizationId = app.current_organization_id`

  - **Backfill:**
    - Para cada DSP existente (Organization), criar ServiceType rows:
      - STANDARD_8H (hours: 8)
      - STANDARD_9H (hours: 9)
      - STANDARD_10H (hours: 10)
      - EV (hours: 8)
      - SAMEDAY (hours: 6)
      - NURSERY_L1 (hours: 6)
      - NURSERY_L2 (hours: 6)
    - Nenhum dado perdido; apenas mapper enum → ServiceType

**Backend:**
- DTO: `ServiceTypeDTO`, `CreateServiceTypeDto`, `UpdateServiceTypeDto`
- Service: `service-type.service.ts`
  - `create()`, `findAll()`, `findById()`, `update()`, `deactivate()` (soft-delete)
- Controller: `service-type.controller.ts`
  - `GET /settings/service-types` (listar por DSP)
  - `POST /settings/service-types` (criar novo)
  - `PUT /settings/service-types/:id` (editar)
  - `DELETE /settings/service-types/:id` (desativar)

**Frontend:**
- Nova tela em `Settings`: "Tipos de Serviço"
  - Tabela com colunas: Name, Hours, Active status
  - Botão "Novo Tipo de Serviço" → modal com inputs
  - Cada row: editar, ativar/desativar, deletar (soft)
  - Responsivo, sem dados fake

**Tests (B.2):**
- ✅ Unit: CRUD operations, backfill logic, RLS checks
- ✅ E2E: criar tipo de serviço, isolamento DSP, deactivate, filtros
- ✅ +5 novos testes

---

#### 2. Manager Depot Access (Refinamento)

**Backend:**
- Review: tabela `MemberDepot` e relacionamento `Users.MemberDepot`
- Validar que queries ja usam `WHERE organizationId = ? AND depotId IN (...)`
- Update `GET /drivers` para respeitar `user.MemberDepot` restrição
- Update `GET /vans` para respeitar `user.MemberDepot` restrição
- Update `GET /payments` para respeitar `user.MemberDepot` restrição
- Criar query helper: `getManagerDepots(userId, organizationId)` → lista de depotIds ou null (sem restrição)

**Frontend:**
- Review: `drivers.component.ts` dropdown de depot
  - Se manager tem depot restrito: mostrar só aquele
  - Se manager sem restrição: mostrar todos (ou dropdown com todos)
- Review: `vans.component.ts` (mesma lógica)
- Review: `admin/users.component.ts` (editar MemberDepot pra manager)

**Tests (B.2):**
- ✅ E2E: manager com 1 depot vê só aquele depot
- ✅ E2E: manager sem restrição vê todos
- ✅ E2E: tentar listar drivers de outro depot → blocked
- ✅ +2-3 novos testes

---

## Rodada B.3 — Despacho (Dispatch)

### Objetivos
✅ **Sistema de Despacho** — atribuir rota + van a motorista para data específica  
✅ **Dashboard de Despacho** — calendário + seleção de motorista/van  
✅ **Validações de Disponibilidade** — motorista ativo, van ativa, sem conflitos  

### Escopo Detalhado

#### 1. Modelo de Dados

**Migrations:**
- `20260917053000_create_dispatch_table`
  - CREATE TABLE `Dispatch`:
    - `id` UUID PK
    - `organizationId` UUID FK (tenancy)
    - `driverId` UUID FK (motorista ativo)
    - `vanId` UUID FK (van ativa)
    - `date` DATE (dia da rota)
    - `status` ENUM (PENDING, ASSIGNED, COMPLETED, CANCELLED)
    - `notes` TEXT (opcional)
    - `createdAt` TIMESTAMP
    - `updatedAt` TIMESTAMP
    - Unique index: `(organizationId, driverId, date)` → motorista só pode ter 1 despacho/dia
    - Índices: `(organizationId, date)`, `(driverId, date)`, `(vanId, date)`
    - RLS policy: `WHERE organizationId = app.current_organization_id`

#### 2. Backend — Despacho Service

**Service: `dispatch.service.ts`**
```typescript
assignRoute(
  driverId: UUID,
  vanId: UUID,
  date: Date,
  organizationId: UUID
): Promise<Dispatch>
// Lógica:
// 1. Validar driver ativo e pertence a este DSP
// 2. Validar van ativa e pertence a este DSP
// 3. Validar sem conflito (driver já tem despacho para date)
// 4. Validar van sem conflito (van já tem despacho para date)
// 5. Criar Dispatch record
// 6. Log audit: "DISPATCH_ASSIGNED"

getAvailableDriversAndVans(
  date: Date,
  organizationId: UUID
): Promise<{ drivers: Driver[], vans: Van[] }>
// Retorna motoristas + vans que não têm despacho naquela data

optimizeAssignment(
  date: Date,
  strategy?: 'round-robin' | 'greedy',
  organizationId?: UUID
): Promise<{ assignments: Dispatch[] }>
// Algoritmo básico:
// - round-robin: distribui vans entre motoristas
// - greedy: prioriza motoristas com menos despachos

listDispatchesByDate(date: Date, organizationId: UUID): Promise<Dispatch[]>

updateDispatchStatus(id: UUID, status: string, organizationId: UUID): Promise<Dispatch>

deleteDispatch(id: UUID, organizationId: UUID): Promise<void>
// Soft-delete via status: CANCELLED
```

**Controller: `dispatch.controller.ts`**
```
GET /dispatch/available?date=YYYY-MM-DD
  → { drivers: [], vans: [] }

POST /dispatch/assign
  body: { driverId, vanId, date }
  → { id, status: ASSIGNED, ... }

POST /dispatch/optimize?date=YYYY-MM-DD&strategy=round-robin
  → { assignments: [] } (bulk assign)

PUT /dispatch/:id
  body: { status: string, notes?: string }
  → updated dispatch

DELETE /dispatch/:id
  → soft-delete

GET /dispatch?date=YYYY-MM-DD
  → { dispatchesByDay: [] }
```

**Tests (B.3):**
- ✅ Unit: assignRoute validations, optimizeAssignment logic, conflicts
- ✅ E2E: atribuir motorista + van, validar isolamento DSP, remover atribuição
- ✅ E2E: tentar atribuir motorista de outro DSP → blocked (404)
- ✅ +5 novos testes

---

#### 3. Frontend — Dashboard de Despacho

**Componente: `dispatch.component.ts` / `.html`**

Layout:
1. **Calendário** (topo)
   - Picker de data (mat-datepicker ou calendar simples)
   - Mostrar data selecionada

2. **Disponíveis** (lado esquerdo)
   - **Motoristas Disponíveis**
     - Lista com badges:
       - Nome (link pro perfil)
       - Status badge (ACTIVE, etc.)
       - Depot (home depot)
       - Draggable ou clickable
   - **Vans Disponíveis**
     - Lista com badges:
       - Matrícula
       - Status badge (ACTIVE, etc.)
       - Depot
       - Draggable ou clickable

3. **Despachos do Dia** (lado direito / topo)
   - Tabela com colunas:
     - Motorista (link)
     - Van (link)
     - Status (PENDING, ASSIGNED, etc.)
     - Ações: editar, remover
   - Totalizador: "X despachos hoje"

4. **Formulário Simples de Atribuição**
   - Dropdown: Motorista (filtrado por disponíveis)
   - Dropdown: Van (filtrado por disponíveis)
   - Botão: "Atribuir"
   - On click: POST `/dispatch/assign` → reload tabela

**Responsiveness:**
- Mobile: collapse tudo em 1 coluna
- Tablet: 2 colunas (disponíveis, despachos)
- Desktop: 3 painéis (calendário, disponíveis, despachos)

**Sem dados fake:** todos os dados vêm da API.

**Tests:**
- ✅ Component: calendário muda data, dropdown filtra corretamente
- ✅ E2E: workflow completo (selecionar data → motorista → van → atribuir → vê na tabela)

---

## Arquitetura de Tenancy — Notas de Referência

Para futuras rodadas (B.4+), entender como o isolamento funciona:

### Três Camadas de Isolamento

1. **Prisma Extension** (`api/src/tenancy/prisma-tenant.extension.ts`)
   - Transparente: toda query é reescrita com `organizationId` filter
   - Fail-closed: se nenhum organizationId, bloqueia
   - Workflow:
     ```typescript
     // Frontend chama:
     GET /drivers
     
     // Middleware injeta organizationId no context
     @CurrentOrganization() org = '123'
     
     // Service usa Prisma:
     this.prisma.driver.findMany() // reescrito como:
     // WHERE organizationId = '123' AND ...
     ```

2. **PostgreSQL RLS** (Opcional em dev, ativo em produção)
   - Policies na tabela: `WHERE organizationId = app.current_organization_id`
   - Requer usuário non-superuser (`dsphub_app`)
   - Testa: desligar Prisma extension (via flag) → RLS ainda bloqueia

3. **Exportação por DSP** (Arquitetura pronta, feature pendente)
   - Endpoint: `POST /export/backup?organizationId=...`
   - Lógica: dump todas as tabelas filtrando por `organizationId`
   - Uso: backup, migração entre deployments, GDPR compliance

### Multi-Domain Routing

- Tabela: `organization_domain` (domínio → organizationId)
- Flow:
  ```
  Request: http://dsphub.mycompany.com/api/drivers
  → Middleware resolve domínio → organizationId = '456'
  → Prisma extension filtra tudo por organizationId
  ```

- **Dev Setup:**
  - `localhost:4200` → DSP A (organizationId: '1')
  - `dsp-b.local:4200` → DSP B (organizationId: '2')
  - Compartilham mesmo backend (`localhost:3000`)
  - RLS bloqueia crosstalk

---

## Timeline & Token Budget

### Sessão 1 (2026-09-17T22:00:00Z) — B.1 + B.2

**Estimado:** 50-65k tokens

**Atividades:**
1. Lê este roadmap
2. Implementa B.1 (pipeline + conversão)
   - Migrations, DTOs, service, endpoint, frontend
   - +10 testes
   - Total: ~35k tokens
3. Implementa B.2 (service types + manager depot)
   - Migrations, DTOs, service, frontend
   - +10 testes
   - Total: ~25k tokens
4. Code review, commit, push
   - Total: ~5k tokens

**Output esperado:**
- 40+/35 unit tests passing ✅
- 23+/18 e2e tests passing ✅
- 1 commit: "Rodada B.1 + B.2 — Pipeline, conversão, tipos de serviço"
- Branch main updated, CI green

---

### Sessão 2 (2026-09-18T22:00:00Z) — B.3

**Estimado:** 50-60k tokens

**Atividades:**
1. Lê roadmap B.3 (dispatch)
2. Implementa dispatch backend
   - Migration (dispatch table)
   - DTOs, service (assign, available, optimize)
   - Controller
   - +10 testes (unit + e2e)
   - Total: ~35k tokens
3. Implementa frontend dispatch dashboard
   - Calendário, dropdown, tabela
   - Integração com API
   - Drag-drop (opcional)
   - Total: ~15k tokens
4. Code review, commit, push
   - Total: ~5k tokens

**Output esperado:**
- 40+/35 unit tests passing ✅
- 28+/18 e2e tests passing ✅ (23 de A + 5 de B.3)
- 1 commit: "Rodada B.3 — Despacho (atribuição rota + van)"
- Branch main updated, CI green

---

## Pendências Futuras (Rodada B.4+)

**Não incluído em B.1-B.3:**

- [ ] Portal do Motorista (horários, despachos, histórico de pagamento)
- [ ] Imports Amazon (integração de pedidos)
- [ ] Branding por DSP (cores, logos, configurações UI)
- [ ] Cálculo de tarifas por depot + away (distância)
- [ ] Score/performance dashboard
- [ ] Calculadora de pagamento
- [ ] Insights (relatórios)
- [ ] Renovação automática de credenciais (Twilio token rotation)

Estas podem ser priorizadas conforme feedback dos DSPs reais.

---

## Referências

- **Scaffold files:** `/mnt/user-data/outputs/RODADA_B1_SCAFFOLDS.md`
- **Delivery notes:** `ENTREGA_RODADA_A.md`
- **Architecture:** `DSPHub_Blueprint.md`
- **Product decisions:** `Claude/DSPHub_Decisoes_Produto.md` (no projeto)
