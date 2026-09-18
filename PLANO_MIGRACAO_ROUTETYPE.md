# Plano de migração: enum `RouteType` → tabela `ServiceType`

**Status:** plano, não executado. Escrito em 18/09/2026.
**Por que não foi feito junto do B.2:** essa mudança atravessa o cálculo de
pagamento dos motoristas. Errar aqui paga gente errado, e não é coisa pra fazer
de madrugada sem conseguir abrir as telas pra conferir.

---

## O tamanho real do problema

O enum `RouteType` tem **26 valores** e é usado em **4 tabelas**:

| Tabela | Coluna | Observação |
|---|---|---|
| `RoutePrice` | `routeType` | tem `@@unique([organizationId, routeType])` — é a tarifa por tipo, por DSP |
| `PaymentHistory` | `routeType` | histórico de alteração de tarifa |
| `DriverPayment` | `routeType` | **o pagamento de cada motorista, por dia** |
| `InvoiceItem` | `routeType` | linhas de fatura já emitidas |

No código são **162 ocorrências em 14 arquivos**, concentradas no módulo de
pagamentos:

- `front/src/app/features/payments/payment.model.ts` — 45
- `front/src/app/features/payments/payment-dashboard.component.ts` — 43
- `api/src/payments/payments.service.ts` — 19
- e mais 11 arquivos com 4 a 8 cada

As duas últimas tabelas guardam **dinheiro que já foi pago e faturas que já
foram emitidas**. Elas não podem ser reinterpretadas: um pagamento de agosto tem
que continuar significando exatamente o que significava em agosto, mesmo que o
DSP renomeie ou desative aquele tipo de serviço depois.

---

## O que já existe (feito no B.2)

A tabela `service_type` existe, tem RLS, e cada DSP já tem os 26 tipos
populados. O campo `code` de cada linha é **igual ao valor do enum**. Ou seja: a
ponte entre os dois mundos já está construída e conferida. Falta atravessar.

---

## A abordagem que eu recomendo: coluna nova ao lado, não troca no lugar

Trocar o tipo da coluna (`ALTER COLUMN ... TYPE uuid USING ...`) é uma migração
destrutiva e irreversível: se der errado no seu banco de produção, não tem
`Ctrl+Z`. O caminho seguro é adicionar, preencher, validar, e só então parar de
usar a coluna velha — nunca apagá-la na mesma rodada.

### Etapa 1 — Adicionar a coluna nova (aditiva, reversível)

Em cada uma das 4 tabelas:

```sql
ALTER TABLE "route_prices"    ADD COLUMN "serviceTypeId" TEXT;
ALTER TABLE "payment_history" ADD COLUMN "serviceTypeId" TEXT;
ALTER TABLE "driver_payments" ADD COLUMN "serviceTypeId" TEXT;
ALTER TABLE "invoice_items"   ADD COLUMN "serviceTypeId" TEXT;
```

Sem `NOT NULL`, sem FK ainda. Nada quebra, nada muda de comportamento.

### Etapa 2 — Preencher a partir do `code` (a ponte)

```sql
UPDATE "driver_payments" dp
SET "serviceTypeId" = st.id
FROM "service_type" st
WHERE st."organizationId" = dp."organizationId"
  AND st.code = dp."routeType"::text
  AND dp."serviceTypeId" IS NULL;
```

Repetir para as outras três. Note o `st."organizationId" = tabela."organizationId"`:
é o que garante que cada DSP aponte para os **seus** tipos, não para os do
vizinho.

### Etapa 3 — Conferir ANTES de confiar

Esta é a etapa que não pode ser pulada. Toda linha tem que ter encontrado par:

```sql
-- tem que devolver 0 em todas
SELECT 'driver_payments', count(*) FROM "driver_payments" WHERE "serviceTypeId" IS NULL
UNION ALL SELECT 'route_prices',   count(*) FROM "route_prices"    WHERE "serviceTypeId" IS NULL
UNION ALL SELECT 'payment_history',count(*) FROM "payment_history" WHERE "serviceTypeId" IS NULL
UNION ALL SELECT 'invoice_items',  count(*) FROM "invoice_items"   WHERE "serviceTypeId" IS NULL;
```

E — mais importante — **os totais pagos não podem mudar**:

```sql
-- rodar antes e depois; os números têm que bater exatamente
SELECT "organizationId", date_trunc('month', "workDate") AS mes,
       count(*) AS linhas, sum("totalPaid") AS total
FROM "driver_payments" GROUP BY 1, 2 ORDER BY 1, 2;
```

Se qualquer linha ficou órfã ou qualquer total mudou, **pare** e investigue
antes de seguir. Não force com `DO NOTHING`.

### Etapa 4 — Travar

Só depois de a etapa 3 estar limpa:

```sql
ALTER TABLE "driver_payments" ALTER COLUMN "serviceTypeId" SET NOT NULL;
ALTER TABLE "driver_payments" ADD CONSTRAINT "driver_payments_serviceTypeId_fkey"
  FOREIGN KEY ("serviceTypeId") REFERENCES "service_type"("id");
```

Em `route_prices`, trocar o unique:
`@@unique([organizationId, serviceTypeId])` no lugar de `[organizationId, routeType]`.

### Etapa 5 — Código: ler do novo, escrever nos dois

Por uma ou duas semanas, o backend **escreve nas duas colunas** e **lê da nova**.
É o que permite voltar atrás sem perder nada se aparecer um problema em
produção. Só depois de esse período passar limpo é que a coluna `routeType` e o
enum saem do schema — em uma rodada separada, com a sua confirmação explícita.

---

## O que NÃO fazer

- **Não** usar `ALTER COLUMN ... TYPE`. Destrutivo e sem volta.
- **Não** apagar a coluna `routeType` na mesma rodada em que adiciona a nova.
- **Não** rodar isso sem `pg_dump` antes. Sério.
- **Não** deixar a migração "corrigir" linhas órfãs sozinha — uma linha sem par
  é sinal de que a premissa está errada, não de que falta um `COALESCE`.
- **Não** permitir renomear o `code` de um tipo de serviço enquanto as duas
  colunas coexistem (já está bloqueado no B.2, e é por isso).

---

## Esforço estimado

| Parte | Tamanho |
|---|---|
| Migrations (4 etapas acima) | pequeno, mas exige conferência cuidadosa |
| `api/src/payments/` (backend) | médio — 5 arquivos, ~45 ocorrências |
| `front/.../payments/` (6 telas) | **o maior pedaço** — ~110 ocorrências |
| Testes (incluindo comparar totais antes/depois) | médio |

É uma rodada inteira, não um item de uma rodada. E é a primeira em que eu
recomendo você estar na frente do computador enquanto roda, em vez de agendada
de madrugada — porque a validação que importa (os totais baterem) é uma decisão
sua, não minha.

---

## Pré-requisito

Antes de começar: **backup do banco**, e conferir que ele restaura.

```bash
"/c/Program Files/PostgreSQL/16/bin/pg_dump.exe" -U postgres dsphub > backup_pre_routetype.sql
```

Um backup que você nunca testou restaurar não é um backup.
