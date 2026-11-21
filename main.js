// Alerta Amazônia — Sistema Automatizado de Monitoramento de Focos de Calor
// Projeto de Inovação — OBAL 2026
//
// Ponto de entrada do programa. Executa o ciclo completo:
// 1. Baixa os dados públicos de focos de calor do INPE
// 2. Filtra para o município configurado em config.js e calcula o risco
// 3. Emite o alerta (console + historico-alertas.csv)
// 4. Atualiza o histórico de toda a Amazônia Legal (dados/focos-diarios.csv)
// 5. Gera o painel (dashboard.html e index.html)
//
// Roda todo dia sozinho pela GitHub Action (.github/workflows/monitoramento.yml).

import dns from "node:dns";
import { baixarFocosDoDia } from "./coletor.js";
import { filtrarPorRegiao, calcularNivelDeRisco } from "./analisador.js";
import { enviarAlerta } from "./notificador.js";
import { atualizarHistoricoRegional, formatarDataLocal } from "./historico-regional.js";
import { construirDashboard } from "./construir-dashboard.js";

// Em algumas redes (comum no Windows), o Node tenta resolver o domínio
// primeiro por IPv6 e falha silenciosamente quando a rede não suporta
// isso direito, dando "fetch failed" sem explicação. Isso força a
// ordem IPv4 primeiro, que costuma resolver o problema.
dns.setDefaultResultOrder("ipv4first");

// O alerta e o histórico usam o mesmo dia (ontem): baixa uma vez só.
const cacheDeDownloads = new Map();
async function baixarComCache(data) {
  const chave = formatarDataLocal(data);
  if (!cacheDeDownloads.has(chave)) {
    cacheDeDownloads.set(chave, await baixarFocosDoDia(data));
  }
  return cacheDeDownloads.get(chave);
}

function relatarErro(etapa, erro) {
  console.error(`Erro na etapa "${etapa}":`, erro.message);
  // "cause" costuma trazer o motivo real (ex: ENOTFOUND, ECONNREFUSED,
  // certificado, timeout) — essencial para diagnosticar problemas de rede.
  if (erro.cause) {
    console.error("Causa detalhada:", erro.cause);
  }
}

async function executarCicloDeMonitoramento() {
  let houveErro = false;

  // Etapas 1 a 3: alerta do município monitorado.
  try {
    const dataReferencia = new Date();
    dataReferencia.setDate(dataReferencia.getDate() - 1);
    const dataFormatada = formatarDataLocal(dataReferencia);

    const focosBrasil = await baixarComCache(dataReferencia);
    const focosRegiao = filtrarPorRegiao(focosBrasil);
    const resultado = calcularNivelDeRisco(focosRegiao);
    await enviarAlerta(resultado, dataFormatada);
  } catch (erro) {
    houveErro = true;
    relatarErro("alerta do município", erro);
  }

  // Etapas 4 e 5: histórico da Amazônia Legal e painel. Rodam mesmo que
  // o alerta tenha falhado, para um problema não travar o outro.
  try {
    await atualizarHistoricoRegional({ baixar: baixarComCache });
    await construirDashboard();
  } catch (erro) {
    houveErro = true;
    relatarErro("histórico regional e painel", erro);
  }

  // Código de saída diferente de zero faz a GitHub Action aparecer como
  // falha, em vez de passar em silêncio quando o INPE está fora do ar.
  if (houveErro) process.exitCode = 1;
}

executarCicloDeMonitoramento();
