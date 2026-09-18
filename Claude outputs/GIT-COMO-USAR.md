# Git neste projeto — guia prático

Escrito para quem nunca usou git. Se você só quer subir o que está pronto
agora, vá direto para a **Parte 1**. A **Parte 2** explica o que cada comando
faz, para os comandos deixarem de ser mágica.

---

## Parte 1 — Subir o que está pronto agora

Abra o terminal (Git Bash, ou o terminal do VS Code) e entre na pasta:

```bash
cd /c/Users/andre/Desktop/DSPHub00
```

### Passo 1: olhar antes de mexer

```bash
git status
```

Isso não altera nada — só mostra. Você vai ver duas listas:

- **Changes not staged for commit** — arquivos que existiam e que mudaram
- **Untracked files** — arquivos novos, que o git ainda nunca viu

Passe o olho. O que você **não** quer ver nessa lista: `.env`, `node_modules`,
qualquer arquivo com senha ou token. Neste projeto o `.gitignore` já bloqueia
esses, então eles não devem aparecer. Se aparecerem, pare e me avise.

### Passo 2: separar o que vai entrar

```bash
git add -A
```

O `-A` quer dizer "tudo". Isso ainda **não** salva nada — só monta o pacote.
Rode `git status` de novo e agora tudo aparece em verde, sob
"Changes to be committed". É a sua última chance de conferir.

Se algo entrou e não devia (por exemplo o `COMMIT_MSG.txt`, que é só um
rascunho):

```bash
git reset COMMIT_MSG.txt
```

Isso tira o arquivo do pacote. **Não apaga o arquivo** — só o deixa de fora.

### Passo 3: salvar o pacote com um bilhete

```bash
git commit -F COMMIT_MSG.txt
```

O `-F` lê a mensagem de um arquivo, que é mais fácil do que escrever um texto
longo no terminal. Se quiser escrever direto, use aspas:

```bash
git commit -m "Importacao do relatorio da Amazon e seeds"
```

Agora o pacote está salvo **no seu computador**. O GitHub ainda não sabe de
nada.

### Passo 4: mandar para o GitHub

```bash
git push origin main
```

`origin` é o apelido do GitHub neste projeto. `main` é o nome da linha do
tempo principal.

**Aqui é onde a maioria trava na primeira vez.** O GitHub não aceita mais a sua
senha normal: ele pede um *Personal Access Token*. Se aparecer uma janela
pedindo login, ou um erro de autenticação, veja a seção
"Quando pedir senha" mais abaixo.

### Passo 5: conferir

```bash
git log --oneline -3
```

Mostra os últimos 3 pacotes salvos. Abra também
<https://github.com/andreribeirocs/dsphub> no navegador: o seu commit deve
estar lá. Se estiver, acabou.

Pode apagar o rascunho:

```bash
rm COMMIT_MSG.txt
```

---

## Parte 2 — O que está acontecendo, de verdade

### Três lugares, não um

Isso é o que confunde no começo. O seu código vive em **três** lugares ao mesmo
tempo:

1. **A sua pasta** — os arquivos como estão agora, no disco
2. **O pacote (staging)** — o que você escolheu para o próximo salvamento
3. **O histórico** — a fila de pacotes já salvos

E existe um quarto lugar, fora do seu computador:

4. **O GitHub** — uma cópia do histórico, na internet

O `git add` move da pasta para o pacote. O `git commit` move do pacote para o
histórico. O `git push` copia o histórico para o GitHub. São três passos
separados de propósito: dá para mudar de ideia em cada um.

### Por que não salva tudo automaticamente

Porque um commit é um bilhete para o seu eu de daqui a seis meses. "Corrigi o
cálculo de horas do sweeper, que somava por linha e triplicava a jornada" vale
muito mais do que trinta salvamentos automáticos sem explicação. O trabalho de
escrever a mensagem é o valor, não o custo.

### O que é um commit

Uma fotografia de todos os arquivos naquele instante, com data, autor e uma
mensagem. Fotografias não somem: mesmo que você apague o arquivo depois, o
commit que o continha continua lá e dá para voltar.

É por isso que subir para o GitHub importa. Enquanto o commit existe só na sua
máquina, ele tem a mesma fragilidade do disco rígido.

---

## Parte 3 — O dia a dia

Depois que estiver no ar, o ciclo é sempre o mesmo, três comandos:

```bash
git status                    # o que mudou?
git add -A                    # quero salvar tudo isso
git commit -m "o que fiz"     # salva com um bilhete
git push origin main          # manda pro GitHub
```

Faça isso **ao terminar cada coisa**, não no fim do dia. Um commit por assunto
é mais útil do que um commit gigante por semana — quando algo quebrar, dá para
achar qual mudança causou.

### Antes de começar a trabalhar

Se outra pessoa (ou outra máquina sua) subiu algo, traga para a sua pasta antes
de mexer:

```bash
git pull origin main
```

---

## Quando der errado

### "Support for password authentication was removed"

O GitHub não aceita senha. Você precisa de um token:

1. Vá em <https://github.com/settings/tokens>
2. **Generate new token** → **classic**
3. Dê um nome (`DSPHub notebook`), marque a caixa **repo**
4. Escolha a validade e gere
5. **Copie o token na hora** — ele não aparece de novo

Quando o `git push` pedir:
- **Username**: `andreribeirocs`
- **Password**: cole o token (não a sua senha do GitHub)

Para não repetir isso toda vez:

```bash
git config --global credential.helper manager
```

No Windows isso guarda o token no Gerenciador de Credenciais.

### "Updates were rejected because the remote contains work that you do not have"

Alguém subiu algo que você não tem. Traga primeiro, depois mande:

```bash
git pull --rebase origin main
git push origin main
```

O `--rebase` põe os seus commits **depois** dos que já estavam lá, em vez de
criar um commit de mistura. Deixa o histórico mais limpo.

### "Please tell me who you are"

Primeira vez usando git nessa máquina. Diga o seu nome e e-mail:

```bash
git config --global user.name "Andre Ribeiro"
git config --global user.email "andreribeirocs@gmail.com"
```

### Push bloqueado por segredo detectado

O GitHub varre o que você envia e recusa tokens e senhas. Já aconteceu neste
projeto com um token do Twilio. Se acontecer:

1. Tire o segredo do arquivo e ponha num `.env` (que o `.gitignore` já ignora)
2. **Revogue o token no painel do serviço** — ele já vazou para o seu histórico
   local, e trocar o arquivo depois não desfaz isso
3. Refaça o commit

### "Fiz besteira, quero voltar"

Antes de commitar, desfazer as mudanças de um arquivo:

```bash
git checkout -- caminho/do/arquivo
```

Isso **apaga o que você escreveu** naquele arquivo desde o último commit. Não
tem desfazer. Use só quando tiver certeza.

Depois de commitar mas antes de dar push, desfazer o último commit mantendo os
arquivos como estão:

```bash
git reset --soft HEAD~1
```

Depois de já ter dado push, não reescreva o histórico — faça um commit novo que
corrige. Reescrever o que já é público quebra a cópia de todo mundo.

---

## O que este projeto já tem configurado

- **Repositório**: <https://github.com/andreribeirocs/dsphub>
- **Branch principal**: `main`
- **`.gitignore`**: já bloqueia `.env`, `.env.*` e `node_modules` na raiz e em
  `api/`

### Uma coisa a decidir

O repositório está **público** hoje — qualquer pessoa consegue ler o código.
Para um sistema que lida com dados de motoristas e pagamentos, vale considerar
deixá-lo privado: **Settings → General → Danger Zone → Change visibility**.
Não muda nada no seu dia a dia, só em quem consegue ver.
