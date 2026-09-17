# DSPHub — COMECE POR AQUI (Handover)

**Data:** 16/09/2026
**Para:** iniciar uma conversa nova sobre o DSPHub sem perder contexto.

> **Como usar:** cole este arquivo (ou o conteúdo dele) como primeira mensagem da conversa nova, junto com o `DSPHub_Blueprint.md`. Com esses dois, a conversa nova nasce sabendo tudo.

---

## 1. O que é o projeto

DSPHub é um sistema de gestão para operação de **Amazon DSP** (entregadores) — controla pagamento por rota, performance dos motoristas e comunicação via WhatsApp. É a automação de um processo que hoje o Andre faz à mão num Google Sheets ("Payment Tracker 2025") com 8 scripts Apps Script.

**Dois repositórios**, ambos já clonados na máquina do Andre em `C:\Users\andre\Desktop\DSPHub00\`:
- `api/` — NestJS 11 + Prisma 6 + PostgreSQL + better-auth 1.3.33
- `front/` — Angular 20 + Tailwind 4

---

## 2. Estado atual: **RODANDO LOCALMENTE** ✅

O sistema sobe e funciona. Para rodar (dois terminais Git Bash):

```bash
# Terminal 1 — API (porta 3000)
cd ~/Desktop/DSPHub00/api
npm run start:dev

# Terminal 2 — Front (porta 4200)
cd ~/Desktop/DSPHub00/front
npm start
```

Abrir `http://localhost:4200` · Login: **admin@dsphub.com** / **admin123456**

Banco: PostgreSQL 16 local, `postgresql://postgres:123456@localhost:5432/dsphub`
Dados: 4 migrations aplicadas + seed (2 admins + 50 motoristas de exemplo).

---

## 3. O que foi feito na sessão anterior (15/09/2026)

Partimos de "não roda" e chegamos em "rodando". Resumo do que foi resolvido:

1. **Node.js não estava instalado** → instalado (v24.21.0 / npm 11.19).
2. **Prisma client não era gerado** — o npm 11 bloqueia install scripts por padrão (mudança de segurança). O postinstall do `@prisma/client` (que é o `prisma generate`) não rodava → 109 erros de TypeScript. Resolvido rodando `npx prisma generate`.
3. **Banco de dados:** a máquina tinha um **PostgreSQL 9.5 de 2016** esquecido ocupando a porta 5432, com senha desconhecida. Como o Prisma 6 exige 9.6+, decidimos aposentá-lo (`Stop-Service` + `StartupType Disabled`) e instalar **PostgreSQL 16** com senha `123456` (batendo com o `.env`).
4. **Schema do better-auth desatualizado** — faltavam 4 colunas que a versão 1.3.33 exige. Corrigido em `prisma/schema.prisma` + migration nova `20260915000000_sync_better_auth_fields`:
   - `account.accessTokenExpiresAt`, `account.refreshTokenExpiresAt`, `account.scope`
   - `organization.metadata`
5. **Seed falhava** (`ts-node` fora do PATH) → `package.json` corrigido para `npx ts-node prisma/seed.ts`.

### Arquivos criados na pasta `api/` (utilitários de diagnóstico, podem ser apagados)
`setup-local.sh`, `find-pass.js`, `diag-db.js`, `find-postgres.ps1`, `find-db-password.sh`

---

## 4. Documentos do projeto

Todos em `C:\Users\andre\Desktop\DSPHub00\`:

| Arquivo | O que tem |
|---|---|
| **`DSPHub_Blueprint.md`** | **O principal.** Fontes de dados Amazon, fórmula exata de Score/Rating/Ranking, os dois fluxos de WhatsApp, motor de insights, de-para completo do que existe vs. falta |
| `DSPHub00_Analise_Completa.md` | Análise técnica dos dois repos (stack, estrutura, issues) |
| `DSPHub00_Plano_Acao.md` | Plano de ação inicial e opções de continuidade |

---

## 5. Descobertas-chave sobre os dados

- **Transporter ID é a chave universal.** Todo arquivo da Amazon (`A25G70DL1VJ9VT`) identifica o motorista por esse ID, e o `Driver.transporterId` já existe no schema. É o que casa tudo automaticamente.
- **Scorecard PDF não precisa de OCR** — tem camada de texto, extrai exato via `pdfplumber` (testado em dois scorecards: Week 46/2025 e Week 4/2026).
- **Rotas com 2 motoristas** vêm com pipe: `NomeA|NomeB` (motorista + helper/rescue) — tratar na importação.
- **A planilha do Andre não calcula valor-base de rota** — só volume (nº rotas) + ajustes (extra/dedução). A calculadora de pagamento é **feature nova** no app.
- **Embaralhamento de nome é GDPR, não bug.** O quadro de performance vai pro grupo de WhatsApp; nomes pseudonimizados (`Joshua → Jhsoua`) para cada um reconhecer o próprio sem expor os outros. **Preservar.**

---

## 6. O que falta — em ordem

### Bloqueadores de input (dependem do Andre)
1. **Tabela de tarifas** — £ por tipo de rota. Único dado não centralizado em lugar nenhum. Sem ele, a calculadora de pagamento não fecha.
2. **Conta Twilio ativa** — a atual está suspensa (status 4), WhatsApp não envia.
3. Confirmar se metas/pesos do Score (seção 4 do Blueprint) continuam atuais.
4. Relatórios novos da Amazon (o Andre vai extrair nos próximos dias) — idealmente a **mesma semana** nos três arquivos: Routes (7 dias) + Scorecard + Concessions.

### Para construir (ver de-para completo no Blueprint, seção 7)
- Import de Routes XLSX → pagamento diário (estender `/api/payments/import-xlsx`)
- Calculadora de pagamento (rotas × tarifa + extras − deduções)
- Import do Scorecard PDF → tabela nova de performance semanal
- Import de Concessions CSV
- Score / Rating / Ranking (lógica no Blueprint, seção 4)
- WhatsApp: broadcast no grupo (pseudonimizado) + DM individual
- Motor de insights (Blueprint, seção 6)

### Dívida técnica (registrada, não urgente)
- `.env` commitado no Git (segredos no histórico) — rotacionar
- `dist/` commitado — remover do versionamento
- Warning da rota `/api/auth/*` no NestJS 11 (path-to-regexp)
- Headers de segurança via `<meta>` (ignorados pelo browser) — mover pro backend
- Issues críticas abertas: #37 (2FA), #38 (password reset)

---

## 7. Primeira mensagem sugerida para a conversa nova

> "Vamos continuar o DSPHub. Leia o `DSPHub_HANDOVER.md` e o `DSPHub_Blueprint.md` em `C:\Users\andre\Desktop\DSPHub00\`. O sistema já roda local. Quero começar por [X]."

Onde **[X]** é o que você escolher: importação de rotas, o motor de score, os insights, ou o que fizer mais sentido quando você tiver os relatórios novos em mãos.
