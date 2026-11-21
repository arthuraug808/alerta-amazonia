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

  return { dias, ufs, municipios };
}

const HTML = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Alerta Amazônia — Painel de focos de calor</title>
<style id="leaflet-css">__LEAFLET_CSS__</style>
<style>
  :root { --fundo:#f5f6f4; --cartao:#fff; --texto:#1d2521; --suave:#66716b; --verde:#1f6b4a; --borda:#dde1dd; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; background:var(--fundo); color:var(--texto); }
  header { background:var(--verde); color:#fff; padding:18px 24px; }
  header h1 { margin:0; font-size:20px; font-weight:600; }
  header p { margin:4px 0 0; font-size:13px; opacity:.85; }
  main { padding:20px 24px 40px; max-width:1200px; margin:0 auto; }
  .filtros { display:flex; flex-wrap:wrap; gap:12px; margin-bottom:16px; }
  .filtros label { display:flex; flex-direction:column; font-size:12px; color:var(--suave); gap:4px; min-width:200px; }
  select { padding:8px 10px; border:1px solid var(--borda); border-radius:6px; font-size:14px; background:#fff; }
  .kpis { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:12px; margin-bottom:16px; }
  .kpi { background:var(--cartao); border:1px solid var(--borda); border-radius:8px; padding:14px; }
  .kpi span { display:block; font-size:12px; color:var(--suave); }
  .kpi strong { font-size:24px; font-weight:600; }
  .grade { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
  @media (max-width:800px) { .grade { grid-template-columns:1fr; } }
  .cartao { background:var(--cartao); border:1px solid var(--borda); border-radius:8px; padding:14px; }
  .cartao h2 { font-size:14px; margin:0 0 10px; font-weight:600; }
  .cartao.largo { grid-column: 1 / -1; }
  .controle-mapa { display:flex; align-items:center; gap:8px; margin-bottom:10px; font-size:13px; color:var(--suave); }
  #mapa { height:480px; border-radius:6px; background:#eef1ef; }
  table { width:100%; border-collapse:collapse; font-size:14px; }
  th, td { text-align:left; padding:8px; border-bottom:1px solid var(--borda); }
  th { color:var(--suave); font-weight:500; font-size:12px; }
  td.num, th.num { text-align:right; }
  .nota { font-size:12px; color:var(--suave); margin-top:10px; }
  .legenda { display:flex; gap:12px; font-size:12px; color:var(--suave); margin-top:8px; flex-wrap:wrap; align-items:center; }
  .legenda i { display:inline-block; width:12px; height:12px; border-radius:2px; margin-right:4px; vertical-align:middle; border:1px solid rgba(0,0,0,.18); }
</style>
</head>
<body>
<header>
  <h1>Alerta Amazônia — focos de calor na Amazônia Legal</h1>
  <p>Dados do Programa Queimadas do INPE (BDQueimadas). Período disponível: <span id="periodo-dados"></span>.</p>
</header>
<main>
  <div class="filtros">
    <label>Estado
      <select id="uf"></select>
    </label>
    <label>Município
      <select id="mun"></select>
    </label>
    <label>Período
      <select id="per">
        <option value="tudo">Todo o período</option>
        <option value="30">Últimos 30 dias</option>
        <option value="90">Últimos 90 dias</option>
        <option value="365">Últimos 365 dias</option>
      </select>
    </label>
  </div>

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
        <thead><tr><th>Município</th><th>Estado</th><th class="num">Focos</th><th class="num">Risco médio</th></tr></thead>
        <tbody id="top"></tbody>
      </table>
      <p class="nota">O risco médio considera só os dias com valor válido. Dias sem valor não entram na média.</p>
    </div>
  </div>
</main>

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
  var perSel = document.getElementById('per');
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
    var p = perSel.value;
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

    if (graficoDia) graficoDia.destroy();
    graficoDia = new Chart(document.getElementById('g-dia'), {
      type: 'line',
      data: { labels: rotulos, datasets: [{ label: 'Focos', data: valores, borderColor: '#1f6b4a', backgroundColor: 'rgba(31,107,74,.15)', fill: true, pointRadius: 0, tension: .25 }] },
      options: { plugins: { legend: { display: false } }, scales: { x: { ticks: { maxTicksLimit: 8, autoSkip: true } }, y: { beginAtZero: true } } }
    });

    if (graficoMes) graficoMes.destroy();
    graficoMes = new Chart(document.getElementById('g-mes'), {
      type: 'bar',
      data: { labels: rotMes, datasets: [{ label: 'Focos', data: valMes, backgroundColor: '#c8702a' }] },
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
    porMun
      .slice()
      .sort(function (a, b) { return b.total - a.total; })
      .slice(0, 10)
      .forEach(function (m) {
        var tr = document.createElement('tr');
        [m.n, m.e].forEach(function (txt) {
          var td = document.createElement('td'); td.textContent = txt; tr.appendChild(td);
        });
        var focos = document.createElement('td'); focos.className = 'num'; focos.textContent = formatarNumero(m.total); tr.appendChild(focos);
        var risco = document.createElement('td'); risco.className = 'num'; risco.textContent = formatarRisco(m.risco); tr.appendChild(risco);
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
  perSel.addEventListener('change', function () { atualizar(false); });
  modoSel.addEventListener('change', function () { atualizar(false); });

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

  // Primeiro os dados, depois as bibliotecas: assim nenhum marcador
  // é procurado dentro do código das bibliotecas.
  const html = HTML
    .replace("__DADOS__", () => paraHtml(dados))
    .replace("__GEO__", () => paraHtml(geo))
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
