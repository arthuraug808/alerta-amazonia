// Alerta Amazônia — Sistema Automatizado de Monitoramento de Focos de Calor
// Projeto de Inovação — OBAL 2026
//
// Ponto de entrada do programa. Executa o ciclo completo:
// 1. Baixa os dados públicos de focos de calor do INPE
// 2. Filtra para a região configurada em config.js
// 3. Calcula o nível de risco
// 4. Emite o alerta (console + histórico em arquivo)
//
// Este script pode ser executado manualmente ou agendado para rodar
// automaticamente todo dia (Agendador de Tarefas do Windows, cron do
// Linux/Mac, ou uma GitHub Action agendada) — é essa parte agendada
// que caracteriza a automação do projeto.

import dns from "node:dns";
import { baixarFocosDoDia } from "./coletor.js";
import { filtrarPorRegiao, calcularNivelDeRisco } from "./analisador.js";
import { enviarAlerta } from "./notificador.js";
import { atualizarDashboard } from "./dashboard.js";

// Em algumas redes (comum no Windows), o Node tenta resolver o domínio
// primeiro por IPv6 e falha silenciosamente quando a rede não suporta
// isso direito, dando "fetch failed" sem explicação. Isso força a
// ordem IPv4 primeiro, que costuma resolver o problema.
dns.setDefaultResultOrder("ipv4first");

async function executarCicloDeMonitoramento() {
  const dataReferencia = new Date();
  dataReferencia.setDate(dataReferencia.getDate() - 1);
  const dataFormatada = dataReferencia.toISOString().split("T")[0];

  const focosBrasil = await baixarFocosDoDia(dataReferencia);
  const focosRegiao = filtrarPorRegiao(focosBrasil);
  const resultado = calcularNivelDeRisco(focosRegiao);

  await enviarAlerta(resultado, dataFormatada);
  await atualizarDashboard();
}

executarCicloDeMonitoramento().catch((erro) => {
  console.error("Erro ao executar o monitoramento:", erro.message);
  // "cause" costuma trazer o motivo real (ex: ENOTFOUND, ECONNREFUSED,
  // certificado, timeout) — essencial para diagnosticar problemas de rede.
  if (erro.cause) {
    console.error("Causa detalhada:", erro.cause);
  }
});
