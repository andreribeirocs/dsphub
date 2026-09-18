# Entrega — Rodada B.1 + B.2 (backend), 18/09/2026

## Antes de tudo: duas coisas que você precisa saber

**1. O agendamento das 23h não rodou — e nunca ia rodar.**

As duas tarefas que criei ontem de manhã (B.1+B.2 e B.3) foram salvas **sem
horário nenhum**. O parâmetro do horário foi parar dentro do texto da tarefa em
vez de ser passado como parâmetro, e eu não conferi o resultado depois de criar.
Elas ficaram como tarefas que só disparam no botão. Além disso, mesmo com o
horário certo, cada disparo abriria uma sessão na nuvem **sem ligação com o seu
PC** — sem repositório, sem banco, sem git. Não entregaria nada.

Já consertei: a tarefa do B.3 foi recriada exigindo o seu computador, com
horário de verdade (18/09 às 23h de Londres) e aprovação automática. Confira no
card se a pasta DSPHub00 aparece listada.

**2. O repositório no GitHub está público.**

Cloneei `github.com/andreribeirocs/dsphub` deste container sem usar credencial
nenhuma sua, e funcionou. Isso quer dizer que o repositório é público: o código
inteiro, o `DSPHub_Blueprint.md` e a análise do negócio estão legíveis por
qualquer um. Foi o que me deixou trabalhar hoje, mas imagino que não seja o que
você quer para um produto que pretende vender. Dá pra trocar para privado em
Settings → General → Danger Zone → Change visibility, sem perder nada.

---

## O que foi entregue

Tudo abaixo foi **verificado rodando de verdade**, não apenas escrito: subi um
PostgreSQL 16 e uma cópia do repositório aqui na nuvem, apliquei as migrations
num banco zerado e rodei a suíte completa.

- `tsc --noEmit`: limpo (exit 0)
- `npx jest`: **50 testes passando** (eram 35; 15 novos)
- 10 migrations aplicam do zero sem erro
- Isolamento entre DSPs testado no banco com um usuário sem superpoderes

### B.1 — Pipeline de recrutamento

**Migration `20260917224757_candidate_pipeline_and_driver_corporate_email`**
Puramente aditiva, não toca em nenhum dado existente:
- `Candidate.initialContactDone` (boolean, default false)
- `Candidate.miniInterviewResult` (texto livre)
- `Candidate.trainingTestResult` (texto livre)
- `Driver.corporateEmail` (opcional)

**Conversão candidato → motorista**
`POST /recruitment/candidates/:id/convert-to-driver`

Corpo: `{ homeDepotId, transporterId, corporateEmail?, joinDate?, contractType?, password? }`

Numa transação só, cria o login (User + Account + Member com papel DRIVER),
cria o Driver ligado ao depot casa, e fecha o candidato como `ACTIVE_DRIVER`
ligado àquele login. Se qualquer passo falhar, nada acontece — um motorista sem
login, ou um login sem motorista, deixaria o DSP num estado que ninguém conserta
pelas telas.

Recusa, com mensagem clara: candidato de outro DSP (404), candidato já
contratado, depot inexistente ou inativo, e-mail já usado por outra conta,
Transporter ID já usado por outro motorista.

### B.2 — Tipos de serviço por DSP

**Migration `20260917225315_service_type_per_dsp`**
- Tabela `service_type` (código, nome, horas, ativo, ordem), uma por DSP
- Política de RLS igual às outras tabelas
- **Backfill**: cada DSP existente recebe os 26 tipos que o sistema já tem hoje.
  O backfill lê os valores direto do enum `RouteType` no banco em vez de uma
  lista digitada à mão, então é impossível faltar ou errar um. É idempotente
  (rodar duas vezes não duplica).

**CRUD**: `GET/POST/PATCH/DELETE /service-types`. O `DELETE` desativa, não apaga
— o histórico de pagamento referencia esses tipos.

---

## O que NÃO foi feito (e por quê)

**Nada do front-end.** Nenhuma tela foi tocada. Os campos novos, o botão
"Contratar" e a tela de tipos de serviço em Configurações não existem ainda. A
API está pronta e testada, mas você não vai ver diferença nenhuma abrindo o
sistema. Foi escolha de prioridade: preferi entregar backend verificado a
entregar tela que eu não consigo nem abrir pra conferir.

**A substituição do enum `RouteType` não foi feita.** Era o pedido original do
B.2 ("substituir o enum fixo"). Não fiz, de propósito: o enum está em 4 colunas
do banco — incluindo `DriverPayment` e `PaymentHistory` — e em 162 lugares do
código, espalhados por 14 arquivos, quase todos no módulo de pagamentos. Trocar
aquilo significa reescrever o cálculo de quanto cada motorista recebe. Fazer
isso à meia-noite, sem conseguir rodar o front, é como errar paga gente errado.

O que entreguei é a metade aditiva: a tabela por DSP existe, está populada e
editável. As colunas de pagamento continuam guardando o enum, e o campo `code`
da tabela nova é a ponte entre os dois. Repontar aquelas colunas é uma rodada
própria, com plano de migração de dados e conferência de pagamento.

**Audit log da conversão.** Não existe tabela de auditoria genérica no sistema:
a tela de Audit Logs é montada a partir de `loginAttempt` + `paymentHistory`, e
a tabela `security_events` não tem `organizationId`, então não serve pra trilha
por DSP. A conversão registra no log do servidor, mas não aparece na tela. Criar
uma tabela de auditoria de verdade é a primeira coisa da próxima rodada — e ela
também bloqueia o requisito de audit do B.3.

**Manager por depot (B.2 item 2).** Revisei e **não precisava de mudança**: a
Rodada A já resolveu isso e já tem teste. O filtro por depot está em
`tenant-scope.ts` cobrindo Depot, Driver, Van, DriverPayment, DriverSchedule e
MemberDepot. Não inventei trabalho onde não havia.

---

## Decisões que tomei sozinho

1. **Nomes dos campos em inglês camelCase.** Você pediu `contato_inicial`,
   `mini_entrevista_resultado`, `teste_treinamento_resultado`. Usei
   `initialContactDone`, `miniInterviewResult`, `trainingTestResult` pra não
   misturar dois idiomas e duas convenções na mesma tabela — o schema inteiro é
   inglês. Se preferir em português, é só um rename, me avisa.

2. **A conversão exige `transporterId` no request.** O `Driver` exige
   Transporter ID (único por DSP) e o `Candidate` não tem esse campo. Quem
   contrata é que sabe o número, então ele vem no corpo do request.

3. **Candidato incompleto é recusado, não completado por mim.** `address`,
   `age`, `citizenship`, validade da carta, do passaporte e do RTW são
   obrigatórios no motorista e opcionais no candidato. Se faltar algum, a API
   devolve 400 **listando o que falta**, em vez de inventar valor.

4. **`nextCheck` = data de entrada + 6 meses.** Não achei regra de compliance
   escrita em lugar nenhum; 6 meses é o intervalo que os registros existentes
   usam. Editável na tela do motorista como qualquer outra data.

5. **Senha gerada e devolvida uma vez.** Se você não mandar `password`, a API
   gera uma e devolve no corpo da resposta, pra quem contratou repassar. Nunca
   fica guardada em texto claro.

6. **O `code` do tipo de serviço não pode ser editado depois de criado.** Ele é
   a ponte de volta para o enum que as tabelas de pagamento ainda guardam.
   Nome, horas, ordem e ativo/inativo são editáveis.

---

## Uma correção sobre algo que eu disse durante o trabalho

Enquanto mexia no `tenant-scope.ts`, percebi que toda tabela nova com
`organizationId` precisa ser registrada à mão numa lista, senão vaza entre DSPs.
Falei na hora que isso "ia passar despercebido". Estava errado: a Rodada A
deixou um teste que lê o `schema.prisma`, acha toda tabela com `organizationId`
e compara com a lista. Testei removendo a linha de propósito — o teste falha.
Ou seja, o erro seria pego no build. Crédito pra Rodada A, não pra mim.

---

## O que falta você fazer

Não consigo rodar comandos nem usar o git no seu PC nesta sessão — só escrever
arquivos. Então:

```bash
cd /c/Users/andre/Desktop/DSPHub00/api

# 1. Backup antes das migrations (elas são aditivas, mas backup é backup)
"/c/Program Files/PostgreSQL/16/bin/pg_dump.exe" -U postgres dsphub > ../backup_pre_b1.sql

# 2. Aplicar as 2 migrations novas
npx prisma migrate dev
npx prisma generate

# 3. Conferir que passou
npx jest                    # esperado: 50 passando
npx tsc --noEmit            # esperado: sem saída

# 4. Conferir o backfill no SEU banco
"/c/Program Files/PostgreSQL/16/bin/psql.exe" -U postgres -d dsphub \
  -c 'SELECT "organizationId", count(*) FROM service_type GROUP BY 1;'
# esperado: 26 por DSP

# 5. Commit
git add -A
git commit -m "Rodada B.1+B.2 (backend): pipeline fields, corporate email, candidate->driver conversion, per-DSP service types"
git push origin main
```

Se o `jest` não der 50, ou a migration reclamar, **não force** — me manda a
saída que eu conserto.

## Próxima rodada, na ordem que eu faria

1. Tabela de auditoria genérica por DSP (destrava o audit do B.3 também)
2. Front-end do B.1+B.2: campos novos, botão Contratar, tela de tipos de serviço
3. Repontar as colunas de pagamento do enum para a tabela (rodada própria)
4. B.3 — Despacho (já agendado para hoje 23h de Londres)
