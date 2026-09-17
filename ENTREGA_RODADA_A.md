# Entrega — Rodada A (sessão noturna, 17/09/2026)

## Leia isto primeiro: como esta entrega chega até você

Os arquivos **já foram escritos direto na sua pasta**
`C:\Users\andre\Desktop\DSPHub00` (com fim de linha CRLF, como o resto do
projeto), às ~08h do dia 17/09, quando a conexão com o seu PC ficou
disponível.

Antes de sobrescrever qualquer coisa, conferi os 63 arquivos que eu ia
modificar: **todos estavam idênticos ao commit-base** (`baseline: twilio
removed`, `7a0bc75`) — ou seja, nenhuma alteração sua foi perdida. Os 33
arquivos novos também não existiam na pasta.

- **96 arquivos gravados** (63 modificados + 33 novos).
- **Não tocados**: `package.json`, `package-lock.json`, `.env` (só o
  `api/.env.example` mudou).
- Nada foi commitado nem dado push; nenhuma migration rodou no seu banco.
- Uma cópia de tudo em formato patch ficou em
  `_backup-git\claude-wip\rodada-a.patch` (referência/backup — **não
  precisa aplicar**, os arquivos já estão no lugar).

### Único passo manual: 1 arquivo pra remover

Eu não consigo apagar arquivos no seu PC. Este ficou obsoleto (substituído
pelo novo sistema de tenancy) e precisa sair, senão é só lixo — não quebra o
build, mas deve ir embora:

```bash
cd /c/Users/andre/Desktop/DSPHub00
git rm api/src/common/middleware/organization.middleware.ts
git status        # deve listar os 63 modificados + 33 novos + 1 removido
```

Portão de qualidade (rodado na nuvem sobre exatamente esses arquivos):
`tsc` limpo, `jest` 35/35, e2e de isolamento 18/18, `ng build` de produção
ok.

---

## O que foi feito esta noite

### Entrega 1 — Isolamento entre DSPs (multi-tenant)

- **Cada DSP só enxerga os próprios dados**, sempre. Três travas, como
  decidido:
  1. **Filtro automático no Prisma** — toda consulta em modelos de dados do
     DSP (motoristas, vans, pagamentos, etc.) é reescrita para incluir
     `organizationId` automaticamente. Se por engano uma rota rodar sem DSP
     definido, a extensão do Prisma **bloqueia** a consulta em vez de deixar
     passar (fail closed).
  2. **Row-Level Security no PostgreSQL** — políticas no banco que barram
     qualquer leitura fora do DSP atual, mesmo que alguém escreva uma query
     SQL direta. Só funciona com um usuário de banco sem privilégio de
     superusuário (veja "Ativar RLS de verdade" abaixo — **opcional**, seu
     ambiente local continua funcionando sem isso).
  3. **Backup/exportação por DSP** — arquitetura pronta para isso; a
     implementação de exportação/backup automático fica pra próxima rodada.
- **Depots (estações)**: entidade própria, com endereço, código, ativo/
  inativo. Motorista tem depot casa obrigatório; van tem depot; managers
  podem ser limitados a alguns depots (`MemberDepot`) — sem restrição
  nenhuma, o manager vê todos os depots do DSP.
- **`operatingModel`** no DSP: `DSP_1_0` ou `DSP_2_0`, editável em
  Configurações.
- Cada DSP é identificado pelo **domínio** de acesso
  (tabela `organization_domain`). Domínio desconhecido → 404. O front usa
  proxy `/api` (sem CORS, sem trocar URL por ambiente).
- Uploads (avatares) não são mais servidos como pasta pública — passam por
  rota autenticada.
- Swagger (`/api/docs`, se existir no seu setup) só fica disponível fora de
  produção.
- Script `api/scripts/dev-setup-tenants.ts` cria um **segundo DSP de teste**
  (`DSP Teste B`, domínio `127.0.0.1`) para você comparar lado a lado com o
  seu DSP em `localhost` — sem mexer nos seus dados reais.
- **18 testes automatizados de isolamento** (e2e) provam, contra o banco de
  verdade: DSP A não lê/edita/apaga nada do DSP B, usuário de um DSP não
  existe pro outro, dashboards só contam o próprio DSP, manager restrito a
  um depot só vê aquele depot, uploads não ficam públicos.

### Entrega 2 — "Nenhum botão mentindo" no front

Todas as telas do levantamento original ligadas à API de verdade (sem dado
fake, sem `setTimeout` fingindo salvar):

- **Vans**: Adicionar/Editar van (modal completo, com depot, MOT, seguro
  etc.), filtros por depot funcionando, exportar CSV.
- **Motoristas**: Editar (via depot casa e demais campos), "Adicionar
  motorista" agora manda pra Candidatos (o cadastro direto continua
  bloqueado de propósito — motorista só entra pelo pipeline, como você
  definiu), desativar com confirmação, exportar CSV, removida a
  "performance" e "atividade recente" inventadas.
- **Admin › Usuários**: editar de verdade, acesso por depot pra managers,
  sem mais usuários falsos quando a API falha.
- **Admin › Configurações**: salva de verdade (dados da empresa, modelo de
  operação 1.0/2.0), com gestão de depots (criar/editar/ativar).
- **Audit Logs**: dados reais — logins (sucesso/falha) e alterações de
  tarifa, com filtros, paginação e export CSV. (Ainda não cobre todo tipo
  de alteração no sistema — isso fica pra depois.)
- **Pagamentos**: histórico completo com paginação/filtro.
- **Perfil**: mensagens de sucesso/erro de verdade, histórico de login real
  (mostra os últimos 20 logins), 2FA e API Keys escondidos (não existe
  backend pra isso ainda).
- Menus de módulos futuros (Despacho, Portal do motorista, Imports Amazon)
  aparecem no menu como **"Em breve"**, sem link — deixam claro que o resto
  do sistema não some, só ainda não foi construído.

### Bugs encontrados e corrigidos hoje (fora do escopo original, mas sérios)

1. **Loop infinito na tela de Disponibilidade dos motoristas**
   (`/drivers/schedule`). A tela ficava recarregando os mesmos 7 pedidos pra
   API sem parar — medi **mais de 400 chamadas em 4 segundos** antes do
   conserto. Causa: a tela calculava "qual semana estou vendo" usando hora
   **local do servidor/navegador**, mas convertia pra texto usando **UTC**
   — no Reino Unido, com horário de verão (BST, UTC+1), isso troca o dia
   errado, e a tela nunca "reconhecia" que carregou a semana certa, então
   tentava de novo pra sempre. Corrigido no backend e no front. Provavelmente
   já acontecia em produção (ou vai acontecer, se o servidor rodar no
   horário do Reino Unido) — vale testar essa tela primeiro.
2. **Limite de requisições por minuto preso em 60** mesmo eu tendo
   configurado um valor bem maior. Causa: o validador de variáveis de
   ambiente tinha um valor padrão de 60 pra essa configuração, e o NestJS
   escreve esse padrão de volta nas variáveis de ambiente **antes** do
   limitador de requisições ler o valor — então qualquer coisa que eu
   configurasse era ignorada. Levantei o padrão pra 600/minuto por IP (dá
   folga confortável pra navegação normal). Isso também **contribuiu** pro
   loop acima (a tela quebrada tomava 429 "muitas requisições" depois de
   uns segundos, mas o loop em si já era o problema principal).

---

## Rodar localmente

```bash
cd DSPHub00/api
npx prisma migrate dev      # aplica as 4 migrations novas (lista abaixo)
npx prisma generate
npx ts-node scripts/dev-setup-tenants.ts    # cria o DSP B de teste
npm run start:dev           # (ou como você costuma rodar a API)
```

Em outro terminal:

```bash
cd DSPHub00/front
npm run start                # ng serve, com o proxy /api já configurado
```

Abra:
- `http://localhost:4200` → seu DSP de sempre, login `admin@dsphub.com`
- `http://127.0.0.1:4200` → DSP de teste, login `admin@dsp-b.test` /
  `admin123456`

### Migrations novas (nesta ordem, o Prisma já respeita)

1. `20260916120000_add_organization_domains` — tabela que liga domínio → DSP.
2. `20260917010000_depots_and_operating_model` — depots, `operatingModel`,
   e **migra dados existentes**: cria um depot por nome de depot já usado em
   motoristas/vans/pagamentos e liga cada registro ao depot certo
   automaticamente (não perde nada, só organiza).
3. `20260917020000_row_level_security` — ativa RLS nas tabelas do DSP
   (só tem efeito se o usuário do banco não for superusuário — veja abaixo).
4. `20260917030000_login_attempt_organization` — liga tentativas de login
   ao DSP, pra alimentar o Audit Log.

### Ativar RLS de verdade (opcional, pra sentir a 2ª trava funcionando)

Sua `DATABASE_URL` local provavelmente usa o usuário `postgres` (super-
usuário), que o Postgres deixa passar por cima de qualquer política de RLS
— então a 1ª trava (filtro automático no Prisma) já protege sozinha no seu
ambiente normal, e não precisa fazer nada. Se quiser testar a 2ª trava
isoladamente:

```bash
psql -U postgres -d dsphub -f api/scripts/sql/create-app-role.sql
```

Isso cria o usuário `dsphub_app` (senha `app123456`, sem permissão de
superusuário) com as permissões certas. Troque a `DATABASE_URL` do `.env`
pra usar esse usuário e reinicie a API — no log ela avisa se detectou RLS
ativo.

---

## Roteiro de teste (~15 minutos)

1. Login em `localhost:4200` com seu usuário de sempre — confirme que os
   dados continuam todos lá (motoristas, vans, etc.), nada sumiu.
2. Abra `127.0.0.1:4200`, login `admin@dsp-b.test` / `admin123456` — deve
   ver só o punhado de dados de teste (2 motoristas, 1 van, 1 depot), nunca
   os seus.
3. Em Configurações (`localhost:4200`), confirme os dados da empresa e troque
   o modelo de operação — deve salvar e persistir ao recarregar a página.
4. Em Vans, clique **Adicionar Van**, preencha e salve — deve aparecer na
   lista na hora. Exporte CSV.
5. Em Motoristas, edite um motorista (troque o depot casa, por exemplo) —
   deve salvar. Tente **Adicionar motorista** — deve te mandar pra
   Candidatos, não abrir um formulário de motorista.
6. Em Admin › Usuários, edite um usuário e, se for um manager, restrinja a
   um depot — confirme que esse manager, ao logar, só vê motoristas/vans
   daquele depot.
7. Abra **Disponibilidade dos motoristas** (o menu que dava loop) e deixe a
   tela aberta uns 10 segundos observando o console do navegador (F12) —
   não deve haver um monte de chamadas repetidas pra API.
8. No menu, confirme que Despacho, Portal do motorista e Imports Amazon
   aparecem cinza, com "Em breve", sem clicar em lugar nenhum.
9. Em Audit Logs, confirme que aparece pelo menos o seu login de agora.
10. `npx jest` e `npx jest --config ./test/jest-e2e.json tenant-isolation`
    (API rodando) — todos verdes (35 + 18 testes).

---

## Premissas e decisões que tomei sozinho

- `operatingModel` começa em `DSP_1_0` por padrão — dá pra trocar na tela de
  Configurações a qualquer momento.
- Manager sem depot nenhum atribuído vê **todos** os depots do DSP (mais
  permissivo por padrão; restringir é uma ação explícita).
- Apagar um motorista, na prática, só marca **INATIVO** (nunca apaga
  histórico de pagamento).
- `POST /drivers` continua bloqueado de propósito — motorista só nasce pelo
  pipeline de recrutamento, como você definiu.
- Se o mesmo usuário pertence a mais de um DSP (raro, mas possível), editar
  o perfil dele afeta os dois — é a mesma pessoa/conta.
- O link de cadastro de candidato usa o domínio de acesso de quem gerou o
  link (o DSP certo, mesmo em localhost).

## O que ainda falta (Rodada B, se topar)

- Novo status no pipeline pra "contato inicial/mini-entrevista" e resultado
  de teste do treinamento.
- Campo de e-mail corporativo no cadastro do motorista.
- Conversão candidato → motorista de verdade, criando o usuário DRIVER com
  depot casa.
- Tabela de tipos de serviço por DSP (Standard 8/9/10h, EV, Sameday,
  Nursery L1/L2) substituindo o enum fixo hoje usado — mantendo os dados
  já existentes.
- Exportação/backup por DSP (3ª trava) — hoje é só arquitetura, não tem
  botão ainda.
- Despacho (atribuição de rota + van), Portal do motorista, Imports da
  Amazon — os três "Em breve" do menu.

## Se algo der errado (desfazer)

Como nada foi commitado, dá pra guardar tudo de lado sem perder:

```bash
cd /c/Users/andre/Desktop/DSPHub00
git stash push --include-untracked -m "rodada-a"   # volta pro commit-base
# ...e se quiser trazer de volta depois:
git stash pop
```

Atenção: `--include-untracked` guarda **todos** os arquivos não rastreados
da pasta (inclusive `ENTREGA_RODADA_A.md` e o que estiver em `Claude
outputs`, se não estiverem no `.gitignore`) — eles voltam com o `stash pop`.

Nenhuma migration é desfeita por isso — se você já rodou `prisma migrate
dev` e quer voltar atrás no banco também, me avise que preparamos o
rollback certo (não é seguro eu improvisar isso sem você olhar).

---

Qualquer dúvida, é só puxar essa conversa de novo — tenho o contexto todo
de por que cada coisa foi feita assim.
