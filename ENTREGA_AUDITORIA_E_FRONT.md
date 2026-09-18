# Entrega — Auditoria + Front-end do B.1/B.2 (18/09/2026, manhã)

Trabalho feito sozinho enquanto você estava fora, na ordem que você listou.

**Verificado de verdade**, num clone do repositório com Postgres 16 aqui na nuvem:

- `npx tsc --noEmit` na API: limpo (exit 0)
- `npx jest`: **52 testes passando** (eram 50; 2 novos)
- `ng build --configuration production` no front: compila limpo
- Isolamento entre DSPs testado no banco com usuário sem superpoderes

---

## 1. Tabela de auditoria genérica — FEITO

Antes disso, a tela de Audit Logs só conseguia mostrar logins e alterações de
tarifa. Qualquer outra coisa que alguém fizesse no sistema não deixava rastro.
A `security_events` não servia: não tem `organizationId`, então não dá pra
separar por DSP.

**Migration `20260918090331_audit_log`** — tabela `audit_log` com
`organizationId`, ação, entidade, quem fez, resumo, metadata JSON, IP,
user-agent e data. Índices e política de RLS iguais às outras tabelas. Aditiva.

**`AuditService.record(entry, tx?)`** — grava uma entrada. Quando recebe o `tx`,
entra na mesma transação da mudança que descreve: se a operação der rollback, a
trilha não fica afirmando que aconteceu algo que não aconteceu.

Uma decisão que vale explicar: fora de transação a gravação é best-effort (falha
é logada e engolida, porque auditoria quebrada não deve derrubar operação real);
**dentro** de transação ela relança. No Postgres, um comando que falha deixa a
transação inutilizável — engolir ali só transformaria um erro claro numa cascata
confusa, e pior, comitaria a mudança sem a trilha, que é exatamente o que uma
tabela de auditoria existe pra impedir.

**Ligada na tela que já existe** — as entradas aparecem na categoria "changes"
do Audit Logs, junto das alterações de tarifa. Não precisei mexer no front pra
isso: os filtros de categoria, status, data e busca continuam funcionando. O
resumo ganhou um campo novo `recordedActions7d` em vez de eu mudar o que o
`priceChanges7d` conta — um número que já está na tela não deve passar a
significar outra coisa em silêncio.

**A conversão candidato → motorista agora audita.** Dentro da mesma transação.
Com dois testes novos: um provando que a trilha é escrita com o `tx` certo,
outro provando que **não** é escrita quando a contratação é recusada.

Isso também destrava o requisito de auditoria do B.3 — já atualizei o
agendamento de hoje à noite pra usar essa tabela em vez de anotar como
pendência.

---

## 2. Front-end do B.1 + B.2 — FEITO

Agora o trabalho aparece na tela.

**Motorista** — campo "Corporate email" no modal de edição, com validação de
e-mail. Apagar o campo limpa o valor no banco (mandei `""`, que o backend trata
como nulo).

**Candidato** — seção nova "Recruitment Pipeline" com os três campos: checkbox
de contato inicial, resultado da triagem e resultado do dia de treinamento.
Segue o mesmo padrão de edição do resto da tela (só editável no modo Edit).

**Botão "Hire as driver"** — verde, no topo da tela do candidato, aparece só
para candidato que ainda não virou motorista. Abre um modal que pede depot
(carregado da API, só os ativos) e Transporter ID, com e-mail corporativo
opcional. Ao confirmar:

- sucesso → mostra o e-mail de login e, se a API gerou, a **senha temporária uma
  única vez**, com botão pra abrir o cadastro do motorista
- erro → mostra a mensagem que o backend devolveu. Se o candidato estiver
  incompleto, a API lista exatamente quais campos faltam, e essa lista aparece
  na tela em vez de um "erro genérico"

**Configurações → Service types** — tabela com código, nome, horas e status,
mais botões de criar, editar e ativar/desativar. O código fica bloqueado na
edição (é a ponte de volta pras tabelas de pagamento) e a tela explica isso.
Desativar esconde dos seletores mas mantém o histórico.

---

## 3. Migração do enum `RouteType` — PLANO, não executado

Você mesmo classificou como rodada própria, e concordo. Escrevi
`PLANO_MIGRACAO_ROUTETYPE.md` com o caminho seguro (coluna nova ao lado,
preencher pela ponte do `code`, conferir que os totais pagos não mudaram, e só
então travar), o que não fazer, e o levantamento real: são **4 tabelas**
(`RoutePrice`, `PaymentHistory`, `DriverPayment` e `InvoiceItem` — essa última
eu não tinha identificado antes) e 162 ocorrências em 14 arquivos.

Recomendo que essa seja a primeira rodada em que você esteja na frente do
computador enquanto roda, porque a validação que importa — os totais baterem
antes e depois — é uma decisão sua.

---

## 4. Twilio e visibilidade do repositório — continua com você

Não consigo fazer nenhum dos dois. O token do Twilio já barrou dois pushes e
está em texto puro num arquivo da sua pasta; o repositório é público (foi como
eu consegui cloná-lo sem credencial). Os dois são de um minuto cada nos painéis.

---

## O que rodar

A API não sobe até a migration ser aplicada (o Prisma Client precisa da tabela).

```bash
cd /c/Users/andre/Desktop/DSPHub00/api
# pare a API primeiro (Ctrl+C no terminal dela)
npx prisma migrate dev
npx prisma generate
npx jest                 # esperado: 52 passando
npm run start:dev
```

Noutro terminal:

```bash
cd /c/Users/andre/Desktop/DSPHub00/front
npm run start
```

Depois, no navegador, o que vale a pena olhar (eu não consigo ver nenhuma
destas telas):

1. Candidato → aba de detalhe: a seção "Recruitment Pipeline" aparece? Entra no
   modo Edit, preenche e salva — persiste ao recarregar?
2. Candidato aprovado → botão verde "Hire as driver" → escolhe depot, põe um
   Transporter ID qualquer → confirma. Deve criar o motorista e mostrar a senha.
3. Tenta contratar um candidato **incompleto** — a mensagem tem que dizer quais
   campos faltam, não "erro ao contratar".
4. Motorista → Editar: o campo "Corporate email" salva?
5. Admin → Configurações: a seção "Service types" lista 26 tipos? Cria um novo,
   renomeia um, desativa outro.
6. Admin → Audit Logs: a contratação do passo 2 aparece na lista?

Se algo estiver feio, desalinhado ou não funcionar ao clicar, me manda print —
compilar eu garanti, ficar bom aos olhos eu não tive como conferir.

Quando estiver de pé:

```bash
cd /c/Users/andre/Desktop/DSPHub00
git add -A
git status          # confere que package.json, package-lock.json e .env NÃO estão na lista
git commit -m "Auditoria por DSP + front-end do B.1/B.2 (pipeline, contratacao, tipos de servico)"
git push origin main
```

## Uma correção sobre algo que falei ontem

Disse no `ENTREGA_RODADA_B1_B2.md` que tabela nova sem registro em
`DIRECT_TENANT_MODELS` "passaria despercebida". Estava errado: a Rodada A deixou
um teste que lê o `schema.prisma`, acha toda tabela com `organizationId` e
compara com a lista. Testei removendo a linha de propósito — o teste falha.
O erro seria pego no build. Crédito da Rodada A, não meu.
