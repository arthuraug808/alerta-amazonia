// Mantém dados/focos-diarios.csv atualizado com os focos de toda a
// Amazônia Legal, agregados por dia e município. É esse arquivo que
// alimenta o painel (construir-dashboard.js).
//
// A cada execução, baixa os últimos dias do INPE e SUBSTITUI no arquivo
// as linhas desses dias (nunca duplica). Reprocessar alguns dias para
// trás serve para dois casos: completar um dia que estava parcial e
// recuperar um dia em que o download falhou.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { baixarFocosDoDia } from "./coletor.js";

export const ARQUIVO_FOCOS = "dados/focos-diarios.csv";
export const ARQUIVO_MUNICIPIOS = "dados/amazonia-legal-municipios.csv";
export const DIAS_PARA_ATUALIZAR = 3;

const CABECALHO =
  "data,municipio_id,municipio,estado,estado_id,total_focos,frp_soma,risco_medio,lat,lon";

// Data no fuso do computador, no formato AAAA-MM-DD. (toISOString usa UTC
// e pode devolver o dia seguinte à noite no Brasil.)
export function formatarDataLocal(data) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

// Lista dos municípios da Amazônia Legal (código IBGE -> nomes).
export async function carregarMunicipiosLegais(caminho = ARQUIVO_MUNICIPIOS) {
  const linhas = (await readFile(caminho, "utf-8")).trim().split(/\r?\n/);
  const cab = linhas[0].split(",").map((c) => c.trim());
  const col = {
    codigo: cab.indexOf("codigo_ibge"),
    municipio: cab.indexOf("municipio"),
    ufCodigo: cab.indexOf("uf_codigo"),
    ufNome: cab.indexOf("uf_nome"),
  };
  if (Object.values(col).some((i) => i < 0)) {
    throw new Error(`${caminho}: cabeçalho inesperado (${linhas[0]})`);
  }
  const mapa = new Map();
  for (const linha of linhas.slice(1)) {
    const v = linha.split(",");
    mapa.set(v[col.codigo].trim(), {
      municipio: v[col.municipio].trim(),
      ufCodigo: v[col.ufCodigo].trim(),
      ufNome: v[col.ufNome].trim(),
    });
  }
  return mapa;
}

// Agrega os focos do Brasil de UM dia, mantendo só a Amazônia Legal.
// Só entram linhas cuja data (data_hora_gmt) é a do dia pedido, para
// nunca sobrescrever outro dia com dados parciais.
export function agregarDia(registros, dataIso, municipios) {
  const acc = new Map();
  let foraDaRegiao = 0;
  let outraData = 0;

  for (const r of registros) {
    const id = (r.municipio_id || "").trim();
    const ref = municipios.get(id);
    if (!ref) { foraDaRegiao++; continue; }

    const dataLinha = (r.data_hora_gmt || "").slice(0, 10).replace(/\//g, "-");
    if (dataLinha !== dataIso) { outraData++; continue; }

    let m = acc.get(id);
    if (!m) {
      m = { id, ref, total: 0, frp: 0, riscoSoma: 0, riscoN: 0, lat: 0, lon: 0, geoN: 0 };
      acc.set(id, m);
    }
    m.total++;

    const frp = parseFloat(r.frp);
    if (!Number.isNaN(frp)) m.frp += frp;

    // risco_fogo fora de 0 a 1 (ex.: -999) é "sem dado" e fica fora da média.
    const risco = parseFloat(r.risco_fogo);
    if (!Number.isNaN(risco) && risco >= 0 && risco <= 1) {
      m.riscoSoma += risco;
      m.riscoN++;
    }

    const lat = parseFloat(r.lat);
    const lon = parseFloat(r.lon);
    if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
      m.lat += lat;
      m.lon += lon;
      m.geoN++;
    }
  }

  const ordenados = [...acc.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const linhas = ordenados.map((m) =>
    [
      dataIso,
      m.id,
      m.ref.municipio,
      m.ref.ufNome,
      m.ref.ufCodigo,
      m.total,
      Math.round(m.frp * 100) / 100,
      m.riscoN > 0 ? Math.round((m.riscoSoma / m.riscoN) * 100) / 100 : "",
      m.geoN > 0 ? (m.lat / m.geoN).toFixed(4) : "",
      m.geoN > 0 ? (m.lon / m.geoN).toFixed(4) : "",
    ].join(",")
  );
  const focos = ordenados.reduce((soma, m) => soma + m.total, 0);

  return { linhas, focos, foraDaRegiao, outraData };
}

// Troca no arquivo as linhas das datas recebidas e mantém o resto.
// Devolve o total de focos que cada data tinha antes (para o log).
export async function mesclarNoArquivo(linhasPorData, caminho = ARQUIVO_FOCOS) {
  let existentes = [];
  try {
    existentes = (await readFile(caminho, "utf-8")).trim().split(/\r?\n/).slice(1);
  } catch {
    // Arquivo ainda não existe: começa do zero.
  }

  const antes = new Map();
  const mantidas = existentes.filter((linha) => {
    const data = linha.slice(0, 10);
    if (!linhasPorData.has(data)) return true;
    const total = Number(linha.split(",")[5]);
    antes.set(data, (antes.get(data) || 0) + total);
    return false;
  });

  const todas = mantidas.concat([...linhasPorData.values()].flat()).map((linha) => {
    const [data, id] = linha.split(",", 2);
    return [`${data}|${id}`, linha];
  });
  todas.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

  await mkdir("dados", { recursive: true });
  await writeFile(caminho, [CABECALHO, ...todas.map((t) => t[1])].join("\n") + "\n", "utf-8");
  return antes;
}

// Baixa os últimos dias e atualiza o histórico.
// "baixar" pode ser trocado (testes e cache); "hoje" também.
export async function atualizarHistoricoRegional({
  baixar = baixarFocosDoDia,
  hoje = new Date(),
  diasParaAtualizar = DIAS_PARA_ATUALIZAR,
} = {}) {
  const municipios = await carregarMunicipiosLegais();
  const linhasPorData = new Map();
  const totais = new Map();
  const falhas = [];

  // Do dia mais antigo ao mais recente, para o log sair em ordem.
  for (let n = diasParaAtualizar; n >= 1; n--) {
    const dia = new Date(hoje);
    dia.setDate(dia.getDate() - n);
    const dataIso = formatarDataLocal(dia);

    try {
      const registros = await baixar(dia);
      const r = agregarDia(registros, dataIso, municipios);
      if (r.focos === 0) {
        // Arquivo vazio ou fora do padrão: não apaga o que já existe.
        falhas.push(`${dataIso}: nenhum foco da Amazônia Legal no arquivo, dia mantido como estava`);
        continue;
      }
      linhasPorData.set(dataIso, r.linhas);
      totais.set(dataIso, r.focos);
      if (r.outraData > 0) {
        console.warn(`${dataIso}: ${r.outraData} linhas de outra data foram ignoradas`);
      }
    } catch (erro) {
      falhas.push(`${dataIso}: ${erro.message}`);
    }
  }

  if (linhasPorData.size === 0) {
    throw new Error(
      "Nenhum dia pôde ser atualizado no histórico regional.\n  " + falhas.join("\n  ")
    );
  }

  const antes = await mesclarNoArquivo(linhasPorData);

  for (const [data, total] of totais) {
    const anterior = antes.get(data);
    if (anterior === undefined) {
      console.log(`Histórico regional ${data}: adicionado, ${total} focos`);
    } else {
      console.log(`Histórico regional ${data}: substituído, ${anterior} -> ${total} focos`);
      if (total < anterior * 0.7) {
        console.warn(`  ATENÇÃO: o total de ${data} caiu bastante em relação ao que já estava salvo.`);
      }
    }
  }
  for (const falha of falhas) console.warn(`Histórico regional, aviso: ${falha}`);

  return { atualizados: [...linhasPorData.keys()], falhas };
}
