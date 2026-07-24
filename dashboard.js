// Gera um painel visual (dashboard.html) a partir do histórico de
// alertas. O arquivo é autocontido — sem dependências externas, sem
// servidor, sem internet — só abrir com dois cliques no navegador.
//
// É chamado automaticamente ao final de main.js e do teste com dados
// simulados, então o painel está sempre atualizado com a última leitura.

import { readFile, writeFile, access } from "node:fs/promises";
import { parseCsv } from "./coletor.js";
import { ARQUIVO_HISTORICO, MUNICIPIO_ALVO, ESTADO_ALVO } from "./config.js";

const ARQUIVO_DASHBOARD = "dashboard.html";
// O GitHub Pages publica automaticamente o arquivo "index.html" da raiz
// do repositório — por isso geramos uma cópia idêntica com esse nome,
// além do dashboard.html usado para abrir localmente.
const ARQUIVO_PAGES = "index.html";
const ORDEM_RISCO = ["SEM FOCOS", "BAIXO", "MODERADO", "ALTO"];
const MAX_BARRAS = 60;
const MAX_LINHAS_TABELA = 15;

function escaparHtml(texto) {
  return String(texto)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

async function lerHistorico() {
  try {
    await access(ARQUIVO_HISTORICO);
  } catch {
    return [];
  }

  const texto = await readFile(ARQUIVO_HISTORICO, "utf-8");
  const registros = parseCsv(texto);

  return registros.map((r) => ({
    dataReferencia: r.data_referencia,
    municipio: r.municipio,
    estado: r.estado,
    totalFocos: Number(r.total_focos) || 0,
    nivel: r.nivel,
    riscoFogoMedio: Number(r.risco_fogo_medio) || 0,
    registradoEm: r.registrado_em,
  }));
}

function calcularEstatisticas(registros) {
  if (registros.length === 0) return null;

  const maiorNivelIndex = registros.reduce((max, r) => {
    const i = ORDEM_RISCO.indexOf(r.nivel);
    return i > max ? i : max;
  }, 0);

  const mediaFocos =
    registros.reduce((soma, r) => soma + r.totalFocos, 0) / registros.length;

  return {
    totalDias: registros.length,
    maiorNivel: ORDEM_RISCO[maiorNivelIndex],
    mediaFocos: Math.round(mediaFocos * 10) / 10,
    primeiraData: registros[0].dataReferencia,
  };
}

function montarFaixaTemporal(registros) {
  const recentes = registros.slice(-MAX_BARRAS);
  const maxFocos = Math.max(1, ...recentes.map((r) => r.totalFocos));

  const barras = recentes
    .map((r) => {
      const altura = Math.max(6, Math.round((r.totalFocos / maxFocos) * 100));
      const tooltip = `${r.dataReferencia} — ${r.totalFocos} focos — ${r.nivel}`;
      return `<div class="barra" data-nivel="${escaparHtml(r.nivel)}" style="height:${altura}%" title="${escaparHtml(tooltip)}"></div>`;
    })
    .join("");

  return { barras, quantidade: recentes.length, total: registros.length };
}

function montarTabela(registros) {
  const recentes = [...registros].slice(-MAX_LINHAS_TABELA).reverse();

  return recentes
    .map(
      (r) => `<tr>
        <td>${escaparHtml(r.dataReferencia)}</td>
        <td>${r.totalFocos}</td>
        <td><span class="pill" data-nivel="${escaparHtml(r.nivel)}">${escaparHtml(r.nivel)}</span></td>
        <td>${r.riscoFogoMedio}</td>
      </tr>`
    )
    .join("");
}

function montarEstadoVazio() {
  return `
    <div class="vazio">
      <p class="vazio-titulo">NENHUM REGISTRO AINDA</p>
      <p class="vazio-texto">
        Rode <code>node main.js</code> para buscar dados reais do INPE, ou
        <code>node teste-com-dados-simulados.js</code> para gerar uma leitura
        de teste sem precisar de internet.
      </p>
    </div>
  `;
}

function montarConteudoPrincipal(registros) {
  if (registros.length === 0) return montarEstadoVazio();

  const ultimo = registros[registros.length - 1];
  const stats = calcularEstatisticas(registros);
  const faixa = montarFaixaTemporal(registros);
  const linhasTabela = montarTabela(registros);

  return `
    <section class="hero">
      <div class="hero-eyebrow">LEITURA MAIS RECENTE — ${escaparHtml(ultimo.dataReferencia)}</div>
      <div class="hero-principal">
        <div class="hero-nivel" data-nivel="${escaparHtml(ultimo.nivel)}">${escaparHtml(ultimo.nivel)}</div>
        <div class="hero-meta">
          <div class="hero-regiao">${escaparHtml(ultimo.municipio)} / ${escaparHtml(ultimo.estado)}</div>
          <div class="hero-stats">${ultimo.totalFocos} focos detectados &middot; risco médio ${ultimo.riscoFogoMedio}</div>
        </div>
      </div>
    </section>

    <section class="cartoes">
      <div class="cartao">
        <div class="cartao-label">DIAS MONITORADOS</div>
        <div class="cartao-valor">${stats.totalDias}</div>
      </div>
      <div class="cartao">
        <div class="cartao-label">MAIOR RISCO JÁ REGISTRADO</div>
        <div class="cartao-valor cartao-valor--palavra" data-nivel="${escaparHtml(stats.maiorNivel)}">${escaparHtml(stats.maiorNivel)}</div>
      </div>
      <div class="cartao">
        <div class="cartao-label">MÉDIA DE FOCOS POR LEITURA</div>
        <div class="cartao-valor">${stats.mediaFocos}</div>
      </div>
      <div class="cartao">
        <div class="cartao-label">PRIMEIRA LEITURA</div>
        <div class="cartao-valor cartao-valor--pequeno">${escaparHtml(stats.primeiraData)}</div>
      </div>
    </section>

    <section class="faixa-secao">
      <h2 class="secao-titulo">FAIXA TEMPORAL DE RISCO <span class="secao-nota">últimos ${faixa.quantidade} de ${faixa.total} registros</span></h2>
      <div class="faixa-strip">${faixa.barras}</div>
      <div class="faixa-legenda">
        <span class="legenda-item"><span class="legenda-swatch" data-nivel="SEM FOCOS"></span>Sem focos</span>
        <span class="legenda-item"><span class="legenda-swatch" data-nivel="BAIXO"></span>Baixo</span>
        <span class="legenda-item"><span class="legenda-swatch" data-nivel="MODERADO"></span>Moderado</span>
        <span class="legenda-item"><span class="legenda-swatch" data-nivel="ALTO"></span>Alto</span>
      </div>
    </section>

    <section class="tabela-secao">
      <h2 class="secao-titulo">REGISTROS RECENTES</h2>
      <table class="log">
        <thead>
          <tr><th>Data</th><th>Focos</th><th>Nível</th><th>Risco médio</th></tr>
        </thead>
        <tbody>${linhasTabela}</tbody>
      </table>
    </section>
  `;
}

function montarPaginaHtml(registros) {
  const geradoEm = new Date().toLocaleString("pt-BR");
  const conteudo = montarConteudoPrincipal(registros);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Alerta Amazônia — Painel de Monitoramento</title>
<style>
  :root {
    --bg-void: #0b1410;
    --surface: #121f19;
    --surface-raised: #182a22;
    --border: #24382e;
    --text-primary: #eaf2ec;
    --text-muted: #8ca398;
    --ember: #e8572a;
    --amber: #e3a93a;
    --canopy: #5fbe7a;
    --mono: ui-monospace, "SFMono-Regular", "Cascadia Code", Consolas, "Liberation Mono", monospace;
    --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    background: var(--bg-void);
    background-image:
      radial-gradient(ellipse 900px 500px at 15% -10%, rgba(95,190,122,0.10), transparent),
      radial-gradient(ellipse 700px 400px at 100% 0%, rgba(232,87,42,0.06), transparent);
    color: var(--text-primary);
    font-family: var(--sans);
    line-height: 1.5;
    padding: clamp(20px, 5vw, 56px);
  }

  .pagina { max-width: 920px; margin: 0 auto; animation: subir 0.5s ease-out; }
  @media (prefers-reduced-motion: reduce) { .pagina { animation: none; } }
  @keyframes subir { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

  .masthead { margin-bottom: 40px; }
  .masthead-eyebrow {
    font-family: var(--mono);
    font-size: 12px;
    letter-spacing: 0.12em;
    color: var(--text-muted);
    margin-bottom: 10px;
  }
  .masthead-titulo {
    font-family: var(--mono);
    font-size: clamp(26px, 4vw, 36px);
    font-weight: 700;
    letter-spacing: -0.01em;
    margin: 0 0 6px;
  }
  .masthead-sub { color: var(--text-muted); font-size: 15px; margin: 0; }

  .hero {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 28px clamp(20px, 4vw, 36px);
    margin-bottom: 24px;
  }
  .hero-eyebrow {
    font-family: var(--mono);
    font-size: 12px;
    letter-spacing: 0.1em;
    color: var(--text-muted);
    margin-bottom: 16px;
  }
  .hero-principal { display: flex; align-items: baseline; gap: 28px; flex-wrap: wrap; }
  .hero-nivel {
    font-family: var(--mono);
    font-size: clamp(32px, 6vw, 52px);
    font-weight: 700;
    letter-spacing: 0.01em;
    color: var(--canopy);
  }
  .hero-nivel[data-nivel="MODERADO"] { color: var(--amber); }
  .hero-nivel[data-nivel="ALTO"] { color: var(--ember); }
  .hero-nivel[data-nivel="SEM FOCOS"] { color: var(--text-muted); }
  .hero-regiao { font-size: 18px; font-weight: 600; }
  .hero-stats { font-family: var(--mono); font-size: 14px; color: var(--text-muted); margin-top: 4px; }

  .cartoes {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 12px;
    margin-bottom: 32px;
  }
  .cartao {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 16px 18px;
  }
  .cartao-label {
    font-family: var(--mono);
    font-size: 11px;
    letter-spacing: 0.08em;
    color: var(--text-muted);
    margin-bottom: 8px;
  }
  .cartao-valor { font-family: var(--mono); font-size: 24px; font-weight: 700; }
  .cartao-valor--pequeno { font-size: 15px; font-weight: 600; }
  .cartao-valor--palavra { font-size: 19px; }
  .cartao-valor[data-nivel="BAIXO"] { color: var(--canopy); }
  .cartao-valor[data-nivel="MODERADO"] { color: var(--amber); }
  .cartao-valor[data-nivel="ALTO"] { color: var(--ember); }

  .secao-titulo {
    font-family: var(--mono);
    font-size: 13px;
    letter-spacing: 0.08em;
    font-weight: 700;
    margin: 0 0 16px;
  }
  .secao-nota { color: var(--text-muted); font-weight: 400; text-transform: none; letter-spacing: normal; }

  .faixa-secao { margin-bottom: 32px; }
  .faixa-strip {
    display: flex;
    align-items: flex-end;
    gap: 3px;
    height: 90px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 12px;
  }
  .barra {
    flex: 1 1 auto;
    min-width: 3px;
    border-radius: 2px 2px 0 0;
    background: var(--text-muted);
    opacity: 0.85;
    transition: opacity 0.15s;
  }
  .barra:hover { opacity: 1; }
  .barra[data-nivel="BAIXO"] { background: var(--canopy); }
  .barra[data-nivel="MODERADO"] { background: var(--amber); }
  .barra[data-nivel="ALTO"] { background: var(--ember); }
  .barra[data-nivel="SEM FOCOS"] { background: var(--border); }

  .faixa-legenda { display: flex; gap: 18px; margin-top: 12px; flex-wrap: wrap; }
  .legenda-item {
    font-family: var(--mono);
    font-size: 12px;
    color: var(--text-muted);
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .legenda-swatch { width: 10px; height: 10px; border-radius: 2px; background: var(--border); display: inline-block; }
  .legenda-swatch[data-nivel="BAIXO"] { background: var(--canopy); }
  .legenda-swatch[data-nivel="MODERADO"] { background: var(--amber); }
  .legenda-swatch[data-nivel="ALTO"] { background: var(--ember); }

  table.log { width: 100%; border-collapse: collapse; font-family: var(--mono); font-size: 13px; }
  table.log th, table.log td {
    text-align: left;
    padding: 10px 14px;
    border-bottom: 1px solid var(--border);
  }
  table.log th { color: var(--text-muted); font-weight: 500; font-size: 11px; letter-spacing: 0.06em; }
  table.log tbody tr:hover { background: var(--surface-raised); }

  .pill {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 11px;
    border: 1px solid var(--border);
    color: var(--text-muted);
  }
  .pill[data-nivel="BAIXO"] { color: var(--canopy); border-color: var(--canopy); }
  .pill[data-nivel="MODERADO"] { color: var(--amber); border-color: var(--amber); }
  .pill[data-nivel="ALTO"] { color: var(--ember); border-color: var(--ember); }

  .vazio {
    background: var(--surface);
    border: 1px dashed var(--border);
    border-radius: 14px;
    padding: 40px 28px;
    text-align: center;
  }
  .vazio-titulo { font-family: var(--mono); letter-spacing: 0.08em; color: var(--text-muted); margin-bottom: 10px; }
  .vazio-texto { color: var(--text-muted); max-width: 480px; margin: 0 auto; }
  .vazio code {
    font-family: var(--mono);
    background: var(--surface-raised);
    padding: 2px 6px;
    border-radius: 4px;
    color: var(--text-primary);
  }

  footer { margin-top: 36px; font-size: 12px; color: var(--text-muted); }
  footer a { color: var(--canopy); }
  footer a:focus-visible, .barra:focus-visible { outline: 2px solid var(--canopy); outline-offset: 2px; }
</style>
</head>
<body>
  <div class="pagina">
    <div class="masthead">
      <div class="masthead-eyebrow">OBAL 2026 &middot; PROJETO DE INOVAÇÃO</div>
      <h1 class="masthead-titulo">Alerta Amazônia</h1>
      <p class="masthead-sub">Monitoramento automatizado de focos de calor — ${escaparHtml(MUNICIPIO_ALVO)} / ${escaparHtml(ESTADO_ALVO)}</p>
    </div>

    ${conteudo}

    <footer>
      Dados públicos do Programa Queimadas do
      <a href="https://terrabrasilis.dpi.inpe.br/queimadas/portal/dados-abertos/" target="_blank" rel="noopener">INPE</a>.
      Painel gerado automaticamente em ${geradoEm}.
    </footer>
  </div>
</body>
</html>`;
}

export async function atualizarDashboard() {
  const registros = await lerHistorico();
  const html = montarPaginaHtml(registros);
  await writeFile(ARQUIVO_DASHBOARD, html, "utf-8");
  await writeFile(ARQUIVO_PAGES, html, "utf-8");
  console.log(`Painel atualizado em ${ARQUIVO_DASHBOARD} e ${ARQUIVO_PAGES}`);
}
