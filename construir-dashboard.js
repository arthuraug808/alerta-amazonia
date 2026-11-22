// Gera dashboard.html a partir de:
//   dados/focos-diarios.csv                  (focos por dia e município)
//   dados/municipios-amazonia-legal.geojson  (contornos dos municípios)
//   vendor/                                  (Chart.js e Leaflet)
//
// Uso: node construir-dashboard.js
// Também é chamado pelo main.js a cada execução diária.
//
// O resultado é um arquivo único: dados, contornos e bibliotecas ficam
// embutidos no HTML. O painel não usa nenhum servidor de mapa, então
// funciona offline e também aberto como arquivo local.

import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { MUNICIPIO_ALVO, ESTADO_ALVO, LIMITE_ALERTA_MODERADO, LIMITE_ALERTA_ALTO } from "./config.js";

const ENTRADA = "dados/focos-diarios.csv";
const MALHA = "dados/municipios-amazonia-legal.geojson";
// index.html é o arquivo que o GitHub Pages publica.
const SAIDAS = ["dashboard.html", "index.html"];

function gerarDados(csv) {
  const linhas = csv.trim().split(/\r?\n/);
  const cab = linhas[0].split(",");
  const col = (nome) => cab.indexOf(nome);
  const C = {
    data: col("data"), codigo: col("municipio_id"), municipio: col("municipio"),
    estado: col("estado"), uf: col("estado_id"), total: col("total_focos"),
    frp: col("frp_soma"), risco: col("risco_medio"), lat: col("lat"), lon: col("lon"),
  };

  const diasSet = new Set();
  for (const l of linhas.slice(1)) diasSet.add(l.split(",")[C.data]);
  const dias = [...diasSet].sort();
  const iDia = new Map(dias.map((d, i) => [d, i]));

  const municipios = {};
  const ufs = {};
  for (const l of linhas.slice(1)) {
    const v = l.split(",");
    const id = v[C.codigo];
    const total = Number(v[C.total]);
    const i = iDia.get(v[C.data]);
    if (!municipios[id]) {
      municipios[id] = { n: v[C.municipio], u: v[C.uf], e: v[C.estado], pesoGeo: 0, la: 0, lo: 0, s: [] };
      ufs[v[C.uf]] = v[C.estado];
    }
    const m = municipios[id];
    const lat = parseFloat(v[C.lat]);
    const lon = parseFloat(v[C.lon]);
    if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
      m.la += lat * total;
      m.lo += lon * total;
      m.pesoGeo += total;
    }
    const frp = Number(v[C.frp]);
    const risco = v[C.risco] === "" ? null : Number(v[C.risco]);
    m.s.push([i, total, Math.round(frp), risco]);
  }

  for (const m of Object.values(municipios)) {
    m.la = m.pesoGeo ? Number((m.la / m.pesoGeo).toFixed(4)) : null;
    m.lo = m.pesoGeo ? Number((m.lo / m.pesoGeo).toFixed(4)) : null;
    delete m.pesoGeo;
    m.s.sort((a, b) => a[0] - b[0]);
  }

  // Município monitorado (config.js), para o cartão "Alerta do dia".
  const norm = (t) => (t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
  const idAlvo = Object.keys(municipios).find(
    (id) => norm(municipios[id].n) === norm(MUNICIPIO_ALVO) && norm(municipios[id].e) === norm(ESTADO_ALVO)
  ) || null;
  return { dias, ufs, municipios, alvo: { id: idAlvo, moderado: LIMITE_ALERTA_MODERADO, alto: LIMITE_ALERTA_ALTO } };
}

const HTML = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Alerta Amazônia — Painel de focos de calor</title>
<style id="leaflet-css">__LEAFLET_CSS__</style>
<style id="fonte">__FONTE__</style>
<style>
  :root { --titulo:"Poppins", "Segoe UI", system-ui, sans-serif; --fundo:#f3f5f2; --cartao:#ffffff; --texto:#17211c; --suave:#5d6a63; --borda:#e1e6e1; --verde:#1f6b4a; --verde-esc:#12392a; --laranja:#d9531e; --mapa:#e9eeea; --sombra:0 1px 2px rgba(20,40,30,.06), 0 4px 14px rgba(20,40,30,.05); }
  @media (prefers-color-scheme: dark) { :root { --fundo:#0f1613; --cartao:#17211c; --texto:#e8efea; --suave:#9fb0a6; --borda:#263329; --verde:#3fae7e; --verde-esc:#0b1f17; --mapa:#1b2620; --sombra:0 1px 2px rgba(0,0,0,.4); } }
  * { box-sizing: border-box; }
  [hidden] { display:none !important; }
  body { margin:0; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; background:var(--fundo); color:var(--texto); line-height:1.4; }
  header { background:linear-gradient(135deg, var(--verde-esc), #1f6b4a); color:#fff; padding:26px 24px 56px; }
  .topo { max-width:1200px; margin:0 auto; }
  .marca { display:flex; align-items:center; gap:14px; }
  .logo { width:63px; height:54px; flex:none; filter:drop-shadow(0 4px 10px rgba(0,0,0,.28)); }
  header h1 { margin:0; font-family:var(--titulo); font-size:32px; font-weight:700; letter-spacing:-.01em; line-height:1.1; }
  header h1 span { color:#ffb347; }
  header .sub { margin:5px 0 0; font-size:14px; opacity:.85; }
  .selos { display:flex; flex-wrap:wrap; gap:8px; margin-top:16px; }
  .selos span { background:rgba(255,255,255,.12); border:1px solid rgba(255,255,255,.2); padding:4px 11px; border-radius:999px; font-size:12px; }
  main { padding:0 24px 32px; max-width:1200px; margin:-34px auto 0; }
  .filtros { position:sticky; top:0; z-index:500; display:flex; flex-wrap:wrap; gap:12px; align-items:flex-end; background:var(--cartao); border:1px solid var(--borda); border-radius:12px; padding:12px 14px; margin-bottom:16px; box-shadow:var(--sombra); }
  .filtros label { display:flex; flex-direction:column; font-size:12px; color:var(--suave); gap:4px; min-width:190px; }
  select { padding:8px 10px; border:1px solid var(--borda); border-radius:8px; font-size:14px; background:var(--cartao); color:var(--texto); }
  .chips { display:flex; gap:4px; background:var(--fundo); padding:3px; border-radius:10px; }
  .chips button { border:0; background:transparent; color:var(--suave); padding:7px 12px; border-radius:8px; font-size:13px; cursor:pointer; }
  .chips button.ativo { background:var(--cartao); color:var(--texto); font-weight:600; box-shadow:var(--sombra); }
  .limpar { margin-left:auto; border:1px solid var(--borda); background:transparent; color:var(--suave); padding:8px 12px; border-radius:8px; font-size:13px; cursor:pointer; }
  .alerta { display:flex; align-items:center; justify-content:space-between; gap:16px; border-radius:12px; padding:16px 20px; margin-bottom:16px; color:#fff; box-shadow:var(--sombra); }
  .alerta .rotulo { display:block; font-size:12px; opacity:.85; text-transform:uppercase; letter-spacing:.06em; }
  .alerta .nivel { display:block; font-family:var(--titulo); font-size:32px; line-height:1.15; }
  .alerta .detalhe { font-size:13px; opacity:.92; }
  .alerta svg { width:min(260px,40%); height:48px; flex:none; }
  .n0 { background:#5d6a63; } .n1 { background:#2f8f5b; } .n2 { background:#c98200; } .n3 { background:#b3261e; }
  .kpis { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:12px; margin-bottom:16px; }
  .kpi { background:var(--cartao); border:1px solid var(--borda); border-radius:12px; padding:14px 16px; box-shadow:var(--sombra); }
  .kpi span { display:block; font-size:12px; color:var(--suave); }
  .kpi strong { font-family:var(--titulo); font-size:28px; font-weight:700; }
  .grade { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
  .cartao { background:var(--cartao); border:1px solid var(--borda); border-radius:12px; padding:16px; box-shadow:var(--sombra); }
  .cartao h2 { font-family:var(--titulo); font-size:14px; margin:0 0 12px; font-weight:700; }
  .cartao.largo { grid-column: 1 / -1; }
  .controle-mapa { display:flex; align-items:center; gap:8px; margin-bottom:10px; font-size:13px; color:var(--suave); }
  #mapa { height:min(70vh,520px); border-radius:10px; background:var(--mapa); isolation:isolate; }
  table { width:100%; border-collapse:collapse; font-size:14px; }
  th, td { text-align:left; padding:9px 8px; border-bottom:1px solid var(--borda); }
  th { color:var(--suave); font-weight:500; font-size:12px; }
  td.num, th.num { text-align:right; }
  td.rank { width:28px; color:var(--suave); }
  tr.clicavel { cursor:pointer; }
  tr.clicavel:hover { background:var(--fundo); }
  .suave { color:var(--suave); font-weight:400; }
  .barra { height:6px; background:var(--fundo); border-radius:3px; margin-top:4px; min-width:120px; }
  .barra i { display:block; height:100%; background:var(--laranja); border-radius:3px; }
  .nota { font-size:12px; color:var(--suave); margin-top:10px; }
  .legenda { display:flex; gap:12px; font-size:12px; color:var(--suave); margin-top:10px; flex-wrap:wrap; align-items:center; }
  .legenda i { display:inline-block; width:12px; height:12px; border-radius:3px; margin-right:4px; vertical-align:middle; border:1px solid rgba(0,0,0,.18); }
  footer { max-width:1200px; margin:0 auto; padding:0 24px 32px; font-size:12px; color:var(--suave); }
  @media (max-width:800px) { .grade { grid-template-columns:1fr; } .filtros { position:static; } .alerta { flex-direction:column; align-items:flex-start; } .alerta svg { width:100%; } .limpar { margin-left:0; } }
</style>
</head>
<body>
<header>
  <div class="topo">
    <div class="marca">
      <svg class="logo" viewBox="0 0 56 48" aria-hidden="true">
        <defs><linearGradient id="gl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff9a3c"/><stop offset="1" stop-color="#d9391e"/></linearGradient></defs>
        <rect width="56" height="48" rx="13" fill="url(#gl)"/>
        <g fill="none" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round">
          <g stroke="#fff"><polyline points="10,38 20,11 30,38"/><line x1="14" y1="29" x2="26" y2="29"/></g>
          <g stroke="#12392a"><polyline points="26,38 36,11 46,38"/><line x1="30" y1="29" x2="42" y2="29"/></g>
        </g>
      </svg>
      <div>
        <h1>Alerta <span>Amazônia</span></h1>
        <p class="sub">Monitoramento diário de focos de calor na Amazônia Legal</p>
      </div>
    </div>
    <div class="selos"><span>Fonte: INPE (BDQueimadas)</span><span>Dados de <b id="periodo-dados"></b></span></div>
  </div>
</header>
<main>
  <div class="filtros">
    <label>Estado<select id="uf"></select></label>
    <label>Município<select id="mun"></select></label>
    <div class="chips" id="chips">
      <button data-p="30">30 dias</button><button data-p="90">90 dias</button><button data-p="365">1 ano</button><button data-p="tudo" class="ativo">Tudo</button>
    </div>
    <button id="limpar" class="limpar">Limpar filtros</button>
  </div>

  <section class="alerta" id="alerta"></section>

  <div class="kpis">
    <div class="kpi"><span>Focos no período</span><strong id="k-focos">—</strong></div>
    <div class="kpi"><span>Municípios com focos</span><strong id="k-mun">—</strong></div>
    <div class="kpi"><span>Dias com focos</span><strong id="k-dias">—</strong></div>
    <div class="kpi"><span>Risco de fogo médio</span><strong id="k-risco">—</strong></div>
  </div>

  <div class="grade">
    <div class="cartao"><h2>Focos por dia</h2><canvas id="g-dia"></canvas></div>
    <div class="cartao"><h2>Focos por mês</h2><canvas id="g-mes"></canvas></div>
    <div class="cartao largo">
      <h2>Mapa por município</h2>
      <div class="controle-mapa">
        <label for="modo">Colorir por</label>
        <select id="modo">
          <option value="focos">Número de focos</option>
          <option value="risco">Risco de fogo médio</option>
        </select>
      </div>
      <div id="mapa"></div>
      <div class="legenda" id="legenda"></div>
      <p class="nota">Clique em um município para selecioná-lo. Os contornos são simplificados. Mojuí dos Campos (criado em 2013) não consta nessa malha e aparece como círculo; a área dele deve estar dentro do contorno de Santarém.</p>
    </div>
    <div class="cartao largo">
      <h2>Municípios com mais focos no período</h2>
      <table>
        <thead><tr><th>#</th><th>Município</th><th class="num">Focos</th><th class="num">Risco médio</th></tr></thead>
        <tbody id="top"></tbody>
      </table>
      <p class="nota">O risco médio considera só os dias com valor válido. Dias sem valor não entram na média.</p>
    </div>
  </div>
</main>
<footer>
  Fontes: focos de calor do Programa Queimadas (INPE/BDQueimadas); malha municipal do repositório tbrugz/geodata-br; código dos municípios do IBGE. O risco de fogo médio ignora valores sem dado. Fonte dos títulos: Poppins (licença OFL). Projeto Alerta Amazônia, OBAL 2026.
</footer>

<script id="chartjs">__CHARTJS__</script>
<script id="leafletjs">__LEAFLETJS__</script>
<script id="dados" type="application/json">__DADOS__</script>
<script id="geo" type="application/json">__GEO__</script>
<script id="app">
(function () {
  var D = JSON.parse(document.getElementById('dados').textContent);
  var G = JSON.parse(document.getElementById('geo').textContent);
  var N = D.dias.length;
  var ufSel = document.getElementById('uf');
  var munSel = document.getElementById('mun');
  var perAtual = 'tudo';
  var modoSel = document.getElementById('modo');

  var CORES_FOCOS = ['#fde9a8', '#f9c25a', '#f2893a', '#d9531e', '#9b1c14'];
  var COR_SEM_RISCO = '#9aa39e';
  var COR_SEM_FOCOS = '#f4f5f3';
  var COR_FORA = '#e3e6e3';

  document.getElementById('periodo-dados').textContent =
    formatarData(D.dias[0]) + ' a ' + formatarData(D.dias[N - 1]);

  function formatarData(iso) {
    var p = iso.split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  }
  function formatarNumero(n) { return n.toLocaleString('pt-BR'); }
  function formatarRisco(r) { return r === null ? '—' : r.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  // ---------- Filtros ----------
  ufSel.add(new Option('Amazônia Legal (todos os estados)', ''));
  Object.keys(D.ufs)
    .sort(function (a, b) { return D.ufs[a].localeCompare(D.ufs[b], 'pt'); })
    .forEach(function (c) { ufSel.add(new Option(D.ufs[c], c)); });

  function atualizarMunicipios() {
    var uf = ufSel.value;
    munSel.innerHTML = '';
    munSel.add(new Option('Todos os municípios', ''));
    Object.keys(D.municipios)
      .filter(function (id) { return !uf || D.municipios[id].u === uf; })
      .sort(function (a, b) { return D.municipios[a].n.localeCompare(D.municipios[b].n, 'pt'); })
      .forEach(function (id) { munSel.add(new Option(D.municipios[id].n, id)); });
  }

  function idsSelecionados() {
    if (munSel.value) return [munSel.value];
    var uf = ufSel.value;
    return Object.keys(D.municipios).filter(function (id) { return !uf || D.municipios[id].u === uf; });
  }

  function inicioPeriodo() {
    var p = perAtual;
    if (p === 'tudo') return 0;
    return Math.max(0, N - parseInt(p, 10));
  }

  // ---------- Agregação ----------
  function agregar(ids, ini) {
    var total = new Array(N).fill(0);
    var riscoSoma = 0, riscoPeso = 0, focos = 0;
    var porMun = [];

    ids.forEach(function (id) {
      var m = D.municipios[id];
      var tm = 0, rs = 0, rp = 0;
      m.s.forEach(function (r) {
        var i = r[0], t = r[1], risco = r[3];
        if (i < ini) return;
        total[i] += t;
        tm += t;
        if (risco !== null) { rs += risco * t; rp += t; }
      });
      if (tm > 0) {
        focos += tm;
        riscoSoma += rs; riscoPeso += rp;
        porMun.push({ id: id, n: m.n, e: m.e, la: m.la, lo: m.lo, total: tm, risco: rp > 0 ? rs / rp : null });
      }
    });

    return { total: total, focos: focos, riscoMedio: riscoPeso > 0 ? riscoSoma / riscoPeso : null, porMun: porMun };
  }

  // ---------- Gráficos ----------
  var graficoDia, graficoMes;
  function desenharGraficos(agr, ini) {
    var rotulos = [], valores = [];
    for (var i = ini; i < N; i++) { rotulos.push(formatarData(D.dias[i])); valores.push(agr.total[i]); }

    var meses = {};
    for (var j = ini; j < N; j++) {
      var mes = D.dias[j].slice(0, 7);
      meses[mes] = (meses[mes] || 0) + agr.total[j];
    }
    var chaves = Object.keys(meses).sort();
    var rotMes = chaves.map(function (c) { var p = c.split('-'); return p[1] + '/' + p[0]; });
    var valMes = chaves.map(function (c) { return meses[c]; });

    var tema = getComputedStyle(document.documentElement);
    var cor = function (n) { return tema.getPropertyValue(n).trim(); };
    Chart.defaults.color = cor('--suave');
    Chart.defaults.borderColor = cor('--borda');
    var media = valores.map(function (_, k) {
      var a = Math.max(0, k - 6), s = 0;
      for (var q = a; q <= k; q++) s += valores[q];
      return Math.round(s / (k - a + 1));
    });
    if (graficoDia) graficoDia.destroy();
    graficoDia = new Chart(document.getElementById('g-dia'), {
      type: 'line',
      data: { labels: rotulos, datasets: [
        { label: 'Focos por dia', data: valores, borderColor: 'rgba(217,83,30,.35)', backgroundColor: 'rgba(217,83,30,.10)', fill: true, pointRadius: 0, borderWidth: 1, tension: .2 },
        { label: 'Média de 7 dias', data: media, borderColor: cor('--verde'), pointRadius: 0, borderWidth: 2.5, tension: .3 }
      ] },
      options: { interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } }, scales: { x: { ticks: { maxTicksLimit: 8, autoSkip: true } }, y: { beginAtZero: true } } }
    });

    if (graficoMes) graficoMes.destroy();
    graficoMes = new Chart(document.getElementById('g-mes'), {
      type: 'bar',
      data: { labels: rotMes, datasets: [{ label: 'Focos', data: valMes, backgroundColor: cor('--laranja'), borderRadius: 4 }] },
      options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
  }

  // ---------- Escalas de cor do mapa ----------
  // Cortes por quintil do número de focos (só municípios com focos).
  function calcularCortes(valores) {
    if (valores.length === 0) return [];
    var v = valores.slice().sort(function (a, b) { return a - b; });
    var cortes = [];
    for (var k = 1; k < 5; k++) {
      var c = v[Math.min(v.length - 1, Math.floor(v.length * k / 5))];
      if (cortes.length === 0 || c > cortes[cortes.length - 1]) cortes.push(c);
    }
    while (cortes.length && cortes[cortes.length - 1] >= v[v.length - 1]) cortes.pop();
    return cortes;
  }
  function classeFocos(valor, cortes) {
    var i = 0;
    while (i < cortes.length && valor > cortes[i]) i++;
    return i;
  }
  function corClasse(i, n) {
    var idx = n === 1 ? 2 : Math.round(i * 4 / (n - 1));
    return CORES_FOCOS[idx];
  }
  function corDe(info, modo, cortes) {
    if (modo === 'risco') {
      if (info.risco === null) return COR_SEM_RISCO;
      if (info.risco >= 0.8) return '#b3261e';
      if (info.risco >= 0.5) return '#f2783c';
      return '#f6c343';
    }
    return corClasse(classeFocos(info.total, cortes), cortes.length + 1);
  }
  function rotulosFocos(cortes) {
    if (cortes.length === 0) return ['focos no período'];
    var r = ['até ' + formatarNumero(cortes[0])];
    for (var i = 1; i < cortes.length; i++) {
      r.push(formatarNumero(cortes[i - 1] + 1) + ' a ' + formatarNumero(cortes[i]));
    }
    r.push('mais de ' + formatarNumero(cortes[cortes.length - 1]));
    return r;
  }

  function desenharLegenda(modo, cortes) {
    var itens = [];
    if (modo === 'risco') {
      itens = [
        ['#f6c343', 'risco baixo (< 0,5)'],
        ['#f2783c', 'risco médio (0,5 a 0,8)'],
        ['#b3261e', 'risco alto (≥ 0,8)'],
        [COR_SEM_RISCO, 'sem dado de risco']
      ];
    } else {
      var rot = rotulosFocos(cortes);
      for (var i = 0; i < rot.length; i++) itens.push([corClasse(i, rot.length), rot[i]]);
    }
    itens.push([COR_SEM_FOCOS, 'sem focos no período']);
    itens.push([COR_FORA, 'fora do filtro']);

    var box = document.getElementById('legenda');
    box.innerHTML = '';
    itens.forEach(function (it) {
      var span = document.createElement('span');
      var quadro = document.createElement('i');
      quadro.style.background = it[0];
      span.appendChild(quadro);
      span.appendChild(document.createTextNode(it[1]));
      box.appendChild(span);
    });
  }

  // ---------- Mapa ----------
  // Sem servidor de mapa: o fundo são os contornos dos municípios.
  var mapa = L.map('mapa', { preferCanvas: true, zoomSnap: 0.25, zoomDelta: 0.5 });
  mapa.setView([-5, -55], 4);
  mapa.attributionControl.addAttribution('Malha municipal: tbrugz/geodata-br · Focos: INPE (BDQueimadas)');

  var camadas = {};      // id do município -> polígono
  var limites = {};      // id do município -> limites do polígono
  var selecionados = {}; // ids dentro do filtro atual
  var porId = {};        // id -> resumo do período (só municípios com focos)
  var extras = L.layerGroup().addTo(mapa); // círculos de municípios sem contorno

  function textoTooltip(id) {
    var m = D.municipios[id];
    var div = document.createElement('div');
    var titulo = document.createElement('strong');
    titulo.textContent = m.n + ' (' + m.e + ')';
    div.appendChild(titulo);
    var linha = document.createElement('div');
    var info = porId[id];
    if (!selecionados[id]) linha.textContent = 'Fora do filtro atual';
    else if (!info) linha.textContent = 'Sem focos no período';
    else linha.textContent = 'Focos: ' + formatarNumero(info.total) + ' · Risco médio: ' + formatarRisco(info.risco);
    div.appendChild(linha);
    return div;
  }

  function selecionarMunicipio(id) {
    var m = D.municipios[id];
    if (!m) return;
    if (munSel.value === id) {
      munSel.value = '';
    } else {
      if (ufSel.value !== m.u) { ufSel.value = m.u; atualizarMunicipios(); }
      munSel.value = id;
    }
    atualizar(true);
  }

  L.geoJSON(G, {
    style: function () { return { color: '#ffffff', weight: 0.4, fillColor: COR_FORA, fillOpacity: 0.6 }; },
    onEachFeature: function (feature, layer) {
      var id = feature.properties.i;
      camadas[id] = layer;
      limites[id] = layer.getBounds();
      layer.bindTooltip(function () { return textoTooltip(id); }, { sticky: true });
      layer.on('click', function () { selecionarMunicipio(id); });
    }
  }).addTo(mapa);

  function desenharMapa(agr, ids, reenquadrar) {
    var modo = modoSel.value;
    selecionados = {};
    ids.forEach(function (id) { selecionados[id] = true; });
    porId = {};
    agr.porMun.forEach(function (m) { porId[m.id] = m; });

    var cortes = modo === 'focos' ? calcularCortes(agr.porMun.map(function (m) { return m.total; })) : [];
    desenharLegenda(modo, cortes);

    var destaque = munSel.value;
    Object.keys(camadas).forEach(function (id) {
      var camada = camadas[id];
      if (!selecionados[id]) {
        camada.setStyle({ color: '#ffffff', weight: 0.4, fillColor: COR_FORA, fillOpacity: 0.6 });
        return;
      }
      var info = porId[id];
      var marcado = id === destaque;
      camada.setStyle({
        color: marcado ? '#1d2521' : '#ffffff',
        weight: marcado ? 2.2 : 0.4,
        fillColor: info ? corDe(info, modo, cortes) : COR_SEM_FOCOS,
        fillOpacity: 0.92
      });
      if (marcado) camada.bringToFront();
    });

    // Municípios sem contorno na malha: círculo na posição média dos focos.
    extras.clearLayers();
    agr.porMun.forEach(function (m) {
      if (camadas[m.id] || m.la === null || m.lo === null) return;
      L.circleMarker([m.la, m.lo], {
        radius: 7, color: '#1d2521', weight: 1, fillColor: corDe(m, modo, cortes), fillOpacity: 0.92
      }).bindTooltip(function () { return textoTooltip(m.id); }, { sticky: true }).addTo(extras);
    });

    if (!reenquadrar) return;
    var alvo = null;
    function estender(item) {
      if (!alvo) alvo = L.latLngBounds(item);
      else alvo.extend(item);
    }
    ids.forEach(function (id) {
      var b = limites[id];
      if (b) estender(L.latLngBounds(b.getSouthWest(), b.getNorthEast()));
      else {
        var m = D.municipios[id];
        if (m && m.la !== null && m.lo !== null) estender([[m.la, m.lo]]);
      }
    });
    if (alvo) {
      if (alvo.getSouthWest().equals(alvo.getNorthEast())) mapa.setView(alvo.getCenter(), 9);
      else mapa.fitBounds(alvo, { padding: [10, 10], maxZoom: 9 });
    }
  }

  // ---------- Tabela ----------
  function preencherTabela(porMun) {
    var corpo = document.getElementById('top');
    corpo.innerHTML = '';
    var top = porMun.slice().sort(function (a, b) { return b.total - a.total; }).slice(0, 10);
    var maximo = top.length ? top[0].total : 1;
    top.forEach(function (m, i) {
      var tr = document.createElement('tr');
      tr.className = 'clicavel';
      tr.title = 'Clique para ver no mapa';
      var rank = document.createElement('td'); rank.className = 'rank'; rank.textContent = String(i + 1); tr.appendChild(rank);
      var nome = document.createElement('td');
      var forte = document.createElement('strong'); forte.textContent = m.n; nome.appendChild(forte);
      var uf = document.createElement('span'); uf.className = 'suave'; uf.textContent = ' · ' + m.e; nome.appendChild(uf);
      tr.appendChild(nome);
      var focos = document.createElement('td'); focos.className = 'num';
      var numero = document.createElement('span'); numero.textContent = formatarNumero(m.total); focos.appendChild(numero);
      var barra = document.createElement('div'); barra.className = 'barra';
      var cheio = document.createElement('i'); cheio.style.width = Math.max(3, Math.round(m.total / maximo * 100)) + '%'; barra.appendChild(cheio);
      focos.appendChild(barra); tr.appendChild(focos);
      var risco = document.createElement('td'); risco.className = 'num'; risco.textContent = formatarRisco(m.risco); tr.appendChild(risco);
      tr.addEventListener('click', function () { selecionarMunicipio(m.id); });
      corpo.appendChild(tr);
    });
  }

  // ---------- Atualização geral ----------
  function atualizar(reenquadrar) {
    var ini = inicioPeriodo();
    var ids = idsSelecionados();
    var agr = agregar(ids, ini);
    var diasComFocos = agr.total.filter(function (t, i) { return i >= ini && t > 0; }).length;

    document.getElementById('k-focos').textContent = formatarNumero(agr.focos);
    document.getElementById('k-mun').textContent = formatarNumero(agr.porMun.length);
    document.getElementById('k-dias').textContent = formatarNumero(diasComFocos);
    document.getElementById('k-risco').textContent = formatarRisco(agr.riscoMedio);

    desenharGraficos(agr, ini);
    desenharMapa(agr, ids, reenquadrar);
    preencherTabela(agr.porMun);
  }

  ufSel.addEventListener('change', function () { munSel.value = ''; atualizarMunicipios(); atualizar(true); });
  munSel.addEventListener('change', function () { atualizar(true); });
  document.getElementById('chips').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    perAtual = b.getAttribute('data-p');
    Array.prototype.forEach.call(this.children, function (c) { c.classList.toggle('ativo', c === b); });
    atualizar(false);
  });
  document.getElementById('limpar').addEventListener('click', function () {
    ufSel.value = ''; atualizarMunicipios(); munSel.value = ''; atualizar(true);
  });
  modoSel.addEventListener('change', function () { atualizar(false); });

  // Cartão do município monitorado (config.js): independe dos filtros.
  function desenharAlerta() {
    var box = document.getElementById('alerta');
    var a = D.alvo, m = a && a.id ? D.municipios[a.id] : null;
    if (!m) { box.hidden = true; return; }
    var serie = new Array(N).fill(0);
    m.s.forEach(function (r) { serie[r[0]] = r[1]; });
    var hoje = serie[N - 1];
    var nivel = hoje === 0 ? 'SEM FOCOS' : hoje < a.moderado ? 'BAIXO' : hoje < a.alto ? 'MODERADO' : 'ALTO';
    var media7 = serie.slice(N - 8, N - 1).reduce(function (s, v) { return s + v; }, 0) / 7;
    var ult30 = serie.slice(N - 30), max30 = Math.max.apply(null, ult30) || 1;
    var pts = ult30.map(function (v, k) { return (k * 100 / 29).toFixed(1) + ',' + (30 - v / max30 * 28).toFixed(1); }).join(' ');
    box.className = 'alerta ' + { 'SEM FOCOS': 'n0', BAIXO: 'n1', MODERADO: 'n2', ALTO: 'n3' }[nivel];
    box.innerHTML = '';
    var esq = document.createElement('div');
    var t = document.createElement('span'); t.className = 'rotulo'; t.textContent = 'Alerta do dia · ' + m.n + ' (' + m.e + ')'; esq.appendChild(t);
    var n = document.createElement('strong'); n.className = 'nivel'; n.textContent = nivel; esq.appendChild(n);
    var d = document.createElement('span'); d.className = 'detalhe';
    d.textContent = formatarNumero(hoje) + ' focos em ' + formatarData(D.dias[N - 1]) + ' · média dos 7 dias anteriores: ' + formatarNumero(Math.round(media7));
    esq.appendChild(d);
    box.appendChild(esq);
    box.insertAdjacentHTML('beforeend', '<svg viewBox="0 0 100 32" preserveAspectRatio="none" aria-label="Focos nos últimos 30 dias"><polyline points="' + pts + '" fill="none" stroke="currentColor" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg>');
  }

  desenharAlerta();
  atualizarMunicipios();
  atualizar(true);
})();
</script>
</body>
</html>
`;

async function carregarMalha() {
  try {
    return JSON.parse(await readFile(MALHA, "utf-8"));
  } catch {
    console.warn(`Aviso: ${MALHA} não encontrado. O mapa usará círculos no lugar dos contornos.`);
    return { type: "FeatureCollection", features: [] };
  }
}

async function lerVendor(nome) {
  try {
    return await readFile(`vendor/${nome}`, "utf-8");
  } catch {
    throw new Error(`Arquivo vendor/${nome} não encontrado. Rode o script na pasta do projeto.`);
  }
}

export async function construirDashboard() {
  const dados = gerarDados(await readFile(ENTRADA, "utf-8"));
  const geo = await carregarMalha();

  const paraHtml = (obj) => JSON.stringify(obj).replace(/</g, "\\u003c");
  const seguroScript = (codigo) => codigo.replace(/<\/script/gi, "<\\/script");
  const seguroStyle = (codigo) => codigo.replace(/<\/style/gi, "<\\/style");

  const chartjs = seguroScript(await lerVendor("chart.umd.min.js"));
  const leafletjs = seguroScript(await lerVendor("leaflet.js"));
  const leafletcss = seguroStyle(await lerVendor("leaflet.css"));

  // Fonte dos títulos embutida no HTML (funciona offline). Se o arquivo
  // faltar, o painel usa a fonte padrão do sistema e continua funcionando.
  let fonte = "";
  try {
    const b64 = (await readFile("vendor/poppins-700.woff2")).toString("base64");
    fonte = `@font-face{font-family:"Poppins";font-weight:700;font-style:normal;font-display:swap;src:url(data:font/woff2;base64,${b64}) format("woff2");}`;
  } catch {
    console.warn("Aviso: vendor/poppins-700.woff2 não encontrado. O painel usará a fonte padrão do sistema.");
  }

  // Primeiro os dados, depois as bibliotecas: assim nenhum marcador
  // é procurado dentro do código das bibliotecas.
  const html = HTML
    .replace("__DADOS__", () => paraHtml(dados))
    .replace("__GEO__", () => paraHtml(geo))
    .replace("__FONTE__", () => fonte)
    .replace("__LEAFLET_CSS__", () => leafletcss)
    .replace("__CHARTJS__", () => chartjs)
    .replace("__LEAFLETJS__", () => leafletjs);

  for (const saida of SAIDAS) await writeFile(saida, html, "utf-8");
  console.log(
    `Gerado: ${SAIDAS.join(" e ")} (${dados.dias.length} dias, ${Object.keys(dados.municipios).length} municípios, ` +
    `${geo.features.length} contornos, ${(html.length / 1e6).toFixed(1)} MB)`
  );
}

// Roda sozinho só quando chamado direto: node construir-dashboard.js
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  construirDashboard().catch((erro) => {
    console.error("Erro:", erro.message);
    process.exit(1);
  });
}
