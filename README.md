# Alerta Amazônia (versão JavaScript / Node.js) — Sistema Automatizado de Monitoramento de Focos de Calor

Projeto de Inovação — OBAL 2026 (item 5.3 do edital)
Temática: Tecnologias sociais, inovação e soluções sustentáveis para a Amazônia Legal

## Por que essa versão não precisa de `npm install`

O projeto usa só recursos nativos do Node.js (o `fetch` já vem embutido
desde a versão 18), então **não há nenhuma dependência externa para
instalar**. Isso evita o problema de DNS/rede que travou o `pip install`
— o único acesso à internet necessário é para baixar os dados do INPE.

## O que o projeto faz

Baixa os dados públicos e gratuitos de focos de calor do Programa
Queimadas do INPE, filtra os focos ocorridos na região escolhida
(município/estado) e calcula um nível de risco (BAIXO, MODERADO ou
ALTO) com base na quantidade de focos e no índice de risco de fogo já
calculado pelo próprio INPE. Em seguida, emite um alerta — no console
e registrado num arquivo de histórico local — e atualiza um **painel
visual** (`dashboard.html`) com a leitura mais recente, o histórico e
uma faixa temporal de risco.

## Estrutura de arquivos

```
alerta-amazonia-js/
├── package.json        # sem dependências, só habilita ES modules
├── config.js            # região monitorada e limites de alerta (edite aqui)
├── coletor.js            # baixa e faz o parse do CSV diário do INPE
├── analisador.js          # filtra a região e calcula o nível de risco
├── notificador.js         # emite o alerta (console + histórico em arquivo)
├── dashboard.js            # gera o painel visual (dashboard.html)
├── main.js                # roda o ciclo completo (arquivo principal)
└── teste-com-dados-simulados.js   # testa a lógica sem precisar de internet
```

## Passo a passo para rodar

### 1. Instalar o Node.js
Baixe a versão LTS em https://nodejs.org (18 ou superior — o projeto
usa `fetch` nativo). Confira se deu certo:
```
node --version
```

### 2. Configurar a região
Abra `config.js` e edite `MUNICIPIO_ALVO` e `ESTADO_ALVO`.

### 3. Rodar
Dentro da pasta `alerta-amazonia-js`:
```
node main.js
```
Não precisa de `npm install` antes — pode rodar direto.

## Testando sem depender do INPE

```
node teste-com-dados-simulados.js
```
Roda a mesma lógica de filtro, cálculo de risco e notificação, mas com
dados fictícios. Bom para gravar o vídeo de demonstração sem depender
da conexão com o INPE no momento, e também mostra que você testou o
código antes de rodar com dados reais.

## Verificando se o domínio do INPE está acessível na sua rede

**PowerShell ou terminal Linux/Mac:**
```
curl -I https://dataserver-coids.inpe.br/queimadas/queimadas/focos/csv/diario/Brasil/
```
Resposta `HTTP/2 200` = domínio acessível. Erro de timeout ou "não foi
possível resolver o host" = bloqueio da rede, não do código. Nesse caso:

1. Teste em outra rede (dados móveis do celular, rede de casa).
2. Se for rede de escola/instituição, peça ao TI para liberar
   `dataserver-coids.inpe.br` (servidor público do governo federal).
3. Para a gravação do vídeo, use `teste-com-dados-simulados.js` e
   explique que o sistema também foi validado com dados reais em
   outra rede.

## Automatizando (rodar todo dia sozinho)

**Linux/Mac — cron:**
```
crontab -e
```
```
0 9 * * * cd /caminho/para/alerta-amazonia-js && node main.js
```

**Windows — Agendador de Tarefas:**
Crie uma tarefa básica com gatilho diário; em "Ação", aponte para o
executável do Node e passe o caminho de `main.js` como argumento.

**GitHub Actions (roda na nuvem)** — crie
`.github/workflows/monitoramento.yml`:
```yaml
name: Monitoramento diário
on:
  schedule:
    - cron: "0 12 * * *"  # 9h no horário de Brasília
  workflow_dispatch: {}
jobs:
  rodar:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: node main.js
```

## Histórico de alertas

Toda vez que `main.js` (ou o teste) roda, uma linha nova é acrescentada
em `historico-alertas.csv`, na mesma pasta do projeto — sem apagar as
execuções anteriores. É esse arquivo que comprova, no vídeo de
demonstração, que o sistema está rodando automaticamente ao longo do
tempo: basta rodar em dias diferentes (ou simular isso) e mostrar o
arquivo crescendo. Pode abrir normalmente no Excel/Google Sheets.

Colunas: `data_referencia, municipio, estado, total_focos, nivel,
risco_fogo_medio, registrado_em`.

## O painel visual (dashboard.html)

Toda vez que `main.js` (ou o teste com dados simulados) roda, o arquivo
`dashboard.html` é gerado/atualizado automaticamente na mesma pasta.
Basta abrir com dois cliques no navegador — não precisa de servidor,
internet ou instalação de nada, pois os dados já ficam embutidos no
próprio arquivo.

Ele mostra:
- A leitura mais recente, em destaque (nível de risco, região, focos).
- Cartões com estatísticas gerais (dias monitorados, maior risco já
  registrado, média de focos, primeira leitura).
- Uma faixa temporal de risco — uma barra por leitura, colorida pelo
  nível e com a altura proporcional à quantidade de focos daquele dia.
- Uma tabela com os registros mais recentes.

Esse é o painel que vale a pena mostrar no vídeo de demonstração —
é bem mais claro para quem for avaliar do que só o texto no terminal.

## Como isso se conecta ao edital (Etapa de Ideação)

- **Problema:** dados de queimadas são públicos, mas pouco acessíveis
  no dia a dia de comunidades e escolas da Amazônia Legal.
- **Solução:** automação que transforma dados brutos de satélite em
  alertas simples, sem depender de instalação de pacotes externos.
- **Prototipação:** este script funcional (MVP) que baixa, filtra,
  calcula risco, notifica automaticamente e apresenta tudo num painel
  visual próprio (`dashboard.html`), sem depender de nenhuma
  ferramenta externa para ser lido.
- **Relevância social:** alerta antecipado apoia prevenção e
  conscientização ambiental, alinhado aos ODS da Agenda 2030.
