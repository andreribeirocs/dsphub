# DSPHub — Blueprint de Produto e Dados

**Versão:** 1.0 · 15/09/2026
**Autor da lógica de negócio:** Andre Ribeiro (extraído do "Payment Tracker 2025" e dos scripts Apps Script)
**Objetivo:** Ser a fonte única de verdade para continuar o desenvolvimento do DSPHub — o que o sistema faz, de onde vêm os dados, qual é a lógica exata, e o que já existe vs. o que falta construir.

> Este documento é para revisão do Andre. Qualquer coisa marcada com **[CONFIRMAR]** precisa da sua validação antes de virar código.

---

## 1. O que é o DSPHub, em uma frase

O DSPHub é a **automação do processo manual** que hoje vive no "Payment Tracker 2025" (Google Sheets) + 8 scripts Apps Script. Ele gerencia uma operação de Amazon DSP (entregadores) em três frentes: **pagamento/volume**, **performance**, e **comunicação com o motorista (WhatsApp)**.

### A descoberta que amarra tudo
Todo arquivo que a Amazon entrega identifica o motorista pelo **Transporter ID** (ex: `A25G70DL1VJ9VT`). O DSPHub já guarda esse campo (`Driver.transporterId`). Ele é a **chave de junção universal**: qualquer arquivo da Amazon casa com o motorista certo por ID exato — sem depender de casar nome (que hoje dá trabalho e erro).

---

## 2. Fontes de dados (arquivos da Amazon)

| Arquivo | Frequência | O que traz | Extração | Alimenta |
|---|---|---|---|---|
| **Routes_*.xlsx** | Diário (1/dia) | Route code, Transporter ID, motorista, tipo de serviço, duração, paradas | Leitura direta de XLSX | Pagamento diário (`DriverPayment`) |
| **DSP Scorecard PDF** | Semanal | Por motorista: Delivered, DCR, DNR/DSC DPMO, LoR, POD, CC, CE, CDF, PSB. Estação: score, rank, FICO, safety, WH exceptions | **Texto do PDF** (não precisa OCR) | Performance + Insights |
| **Delivery Concessions CSV** | Semanal | Cada pacote concedido, por Transporter ID | Leitura direta de CSV | Concessões/qualidade por motorista |
| **OTR Roundtable PDF** | Semanal | Slides de reunião (não é dado estruturado) | — | Descartar (opcional: 3-4 KPIs soltos) |

**Nota sobre OCR:** os scorecards têm camada de texto; a extração é exata via `pdfplumber`. OCR fica apenas como fallback automático se algum scorecard vier escaneado (imagem).

**Edge case já identificado:** rotas com dois motoristas vêm com `NomeA|NomeB` e `IDa|IDb` (motorista + helper/rescue). O app separa em principal + helper (`DriverPayment.isHelper` / `helperFor`).

---

## 3. O processo manual hoje (os 8 scripts)

Fluxo completo, ponta a ponta:

```
RawData (cola do Routes Amazon)
   │  dailyTabs.gs → cria aba do dia, 1 linha por rota
   ▼
Abas diárias  (Date · Driver · Service type · Route · Extra · Deduction · Van)
   │  database.gs → achata tudo, valida nome vs. Driver Backlog, janela de 5 semanas
   ▼
Database  (+ Source Sheet, Week, Status)
   │
   ├─ weekLookup.gs   → rollup semanal por motorista (nº rotas + líquido £)
   ├─ driverLookup.gs → detalhe de 1 motorista (últimas 4 semanas)
   └─ dashboard.gs    → semana atual vs. anterior

PerfRaw (cola do Scorecard PDF)
   │  PerformanceRanking.gs → calcula Score, Rating, Ranking
   ▼
Performance  (nomes EMBARALHADOS por GDPR)
   │  msgDrivers.gs → gera mensagem individual por motorista
   ▼
MSG DRIVERS
```

Suporte: `core.gs` (mapa de semanas, matching de nome, datas). Semana começa no **domingo**.

---

## 4. Modelo de Score (Scorecard 3.0) — a lógica exata

Cada métrica vira uma nota 0–100; a nota final é a média ponderada.

### Metas e limites
```
TARGET  = { DCR:99, DNR:1100, DSC:860, LoR:80, POD:98.5, CC:99, CE:0, CDF:4420, PSB:3 }
LIMITS  = { DNR_MIN:1740, LoR_MIN:220, CE_MIN:130, CDF_MIN:6420, PSB_MIN:12 }
WEIGHT  = { DCR:15%, DNR:15%, POD:15%, CC:15%,  LoR:10%, CE:10%, CDF:10%, PSB:10% }   (soma = 100%)
```

### As duas funções de nota
- **Métricas de % (DCR, POD, CC)** — quanto maior melhor:
  `nota = min(valor / meta, 1) × 100`
- **Métricas de DPMO (DNR/DSC, LoR, CE, CDF, PSB)** — quanto menor melhor:
  `nota = 100` se valor ≤ meta; `0` se valor ≥ piso(min); senão interpola linear `(min − valor)/(min − meta) × 100`

### Concessões
Usa **DSC** se existir (>0), senão **DNR**. (DSC meta 860 / DNR meta 1100, piso 1740 em ambos.)

### Score, Rating e Ranking
```
Score  = Σ(nota_i × peso_i)              (0–100, 2 casas)
Rating = ≥95 Fantastic Plus · ≥90 Fantastic · ≥80 Great · ≥70 Fair · <70 Poor
Ranking = ordem decrescente por Score
Cores  = Fantastic Plus #0B8043 · Fantastic #66BB6A · Great #FBC02D · Fair #F57C00 · Poor #C62828
```

**[CONFIRMAR]** Metas/pesos são fáceis de ajustar. Se a Amazon mudar o Scorecard (3.1, 4.0…), esses valores viram configuração editável na tela de Settings — não código fixo.

---

## 5. Os dois fluxos de WhatsApp

O módulo WhatsApp dispara **dois tipos de mensagem** quando o scorecard entra. Hoje o Andre faz isso na mão (copia o quadro colorido, tira print, joga no grupo; e manda os individuais). O app automatiza os dois.

### Fluxo A — Broadcast no grupo (público · GDPR)
- Quadro de ranking com cores por Rating, **nomes pseudonimizados** (embaralhamento `anonimiseConsistent`: mantém 1ª e última letra — `Joshua → Jhsoua` — cada um reconhece o próprio nome sem expor a identidade dos outros).
- **Isto é obrigatório por GDPR:** a mensagem vai pro grupo inteiro; não pode conter nome real de terceiros.
- O app gera esse quadro (imagem colorida, mantendo o visual atual) e posta no grupo automaticamente.

### Fluxo B — Mensagem individual (privada · nome real)
Enviada no privado de cada motorista, então **nome real é permitido**. Estrutura:
1. Cabeçalho `📊 Your Weekly Performance Summary`
2. `Hi {nome real}`
3. Linhas de métrica com emoji por faixa (regras abaixo)
4. `⭐ Rating` + `📈 Ranking #X of N`
5. `🔍 Areas to improve` — dica específica por métrica que falhou (coaching)
6. Fecho por tier (Poor → oferta de 1:1; Fantastic Plus → parabéns 🏆)

### Faixas de emoji (✅ ok / ⚠️ perto / ❌ ruim)
```
DCR:   ✅≥99   ⚠️≥97          POD:  ✅≥98.5 ⚠️≥97
CC:    ✅≥99   ⚠️≥96          Conc: ✅≤meta ⚠️≤(meta+1740)/2
LoR:   ✅≤80   ⚠️≤150         CE:   ✅≤0    ⚠️≤1
CDF:   ✅≤4420 ⚠️≤5420        PSB:  ✅≤3    ⚠️≤6
Score: ✅≥95   ⚠️≥90
```

---

## 6. Motor de Insights (NOVO — pedido do Andre)

> Hoje não existe nem na planilha nem no app. É capacidade nova, e é o maior salto de valor de ter os dados num banco em vez de planilha.

**Pergunta que o motor responde:** "o que está impactando a performance do time, e qual motorista está colocando a operação em risco?"

### 6.1 Insights de time
A partir do histórico semanal do scorecard (página do overall + tabela por motorista):
- **Tendência** de cada métrica da estação semana-a-semana (Overall Score, Rank, DCR, DNR, POD, CC, Speeding, Distractions, Following Distance…).
- **Maior ofensor da semana:** qual métrica puxou o score pra baixo, e quais estão em Fair/Poor.
- **Decomposição:** DNR subiu? → quais tipos de rota / quais motoristas concentram as concessões (junção scorecard + concessions + routes). Distracted driving subiu? → foco de segurança.
- **Alertas de tendência:** métrica caindo N semanas seguidas.

### 6.2 Risco individual
Cada motorista recebe um **Risk Score** = combinação ponderada de:
1. **Severidade** — quão abaixo do limite nas métricas-chave.
2. **Exposição/volume** — motorista de alto volume com DCR ruim machuca mais o score do DSP (risco ponderado por impacto).
3. **Tendência** — piorando ao longo das semanas.
4. **Ratings repetidos** — Poor/Fair recorrente.
5. **Flags duras** — CE > 0 (escalation), exceções de Working Hours, Breach of Contract.

→ Ranqueia os motoristas por risco e mostra o **top N em risco**, com o motivo específico de cada um.

### 6.3 Camadas (o que é determinístico vs. IA)
- **Núcleo determinístico** (confiável, explicável): as contas acima — thresholds, tendências, risk score. Sempre com o "porquê" rastreável.
- **Camada de narrativa (IA, opcional):** um briefing semanal em linguagem natural por cima dos números — ex: *"O DNR DPMO subiu 18% esta semana; 60% vem de 3 motoristas em rotas Nursery. O DCR do motorista X caiu 3 semanas seguidas e já ameaça o tier do DSP — maior risco operacional. Recomendado 1:1."*
- Regra: a IA **resume** os números, nunca os inventa. Todo insight aponta pro dado que o gerou.

---

## 7. De-para: manual → DSPHub (o que existe vs. o que falta)

| Capacidade | Estado no app hoje | Ação |
|---|---|---|
| Cadastro de motorista + Transporter ID | ✅ Existe (`Driver`) | Usar como chave de junção |
| Import de rotas → pagamento diário | ⚙️ Parcial (`DriverPayment`, endpoint `import-xlsx`) | Estender: ler XLSX, tratar helper `A|B` |
| Rollup semanal → invoice | ✅ Existe (`DriverInvoice`) | Ligar ao pagamento |
| **Cálculo de pagamento (rotas × tarifa)** | ❌ Não existe | **Construir** + precisa da tabela de tarifas |
| Dashboard semana vs. semana | ✅ Existe | Ligar aos dados reais |
| **Score / Rating / Ranking** | ❌ Não existe no schema | **Construir** (seção 4) — tabela nova de performance semanal |
| Import do Scorecard PDF | ❌ Não existe | **Construir** (extração de texto + fallback OCR) |
| Import de Concessions CSV | ❌ Não existe | **Construir** |
| **WhatsApp — broadcast grupo (pseudonimizado)** | ⚙️ Canal existe (Twilio) | **Construir** geração do quadro + disparo |
| **WhatsApp — DM individual** | ⚙️ Canal existe | **Construir** gerador de mensagem (seção 5) |
| **Motor de Insights** | ❌ Não existe | **Construir** (seção 6) |

---

## 8. Inputs que faltam do Andre

1. **[CONFIRMAR] Tabela de tarifas (£ por tipo de rota).** É o único dado que a planilha não tem centralizado. Necessário pra calculadora de pagamento. Ex:
   - Standard Parcel Medium Van → £___
   - Nursery Route Level 1/2/3/4 → £___
   - ORDT Extra Large Cargo Van → £___
   - Standard Parcel Low Emission → £___
   - (demais tipos do enum `RouteType`)
2. **[CONFIRMAR]** A conta Twilio de WhatsApp está suspensa (status 4). Precisa de conta ativa pra ligar os dois fluxos.
3. **[CONFIRMAR]** Confirmar se as metas/pesos do Score (seção 4) ainda são os atuais ou se mudaram.

---

## 9. Dívida técnica encontrada (registro, não urgente)

- `.env` está commitado no Git (segredos no histórico do repo) — rotacionar e remover.
- Pasta `dist/` commitada — remover do versionamento.
- Rota `/api/auth/*` gera warning no NestJS 11 (path-to-regexp) — arrumar a conversão.
- Cabeçalhos de segurança (`frame-ancestors`, `X-Frame-Options`) aplicados via `<meta>` (ignorados) — mover pro backend como header HTTP.
- 2 issues críticas de auth abertas (#37 2FA, #38 password reset).
