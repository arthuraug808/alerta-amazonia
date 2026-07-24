// Módulo responsável por emitir os alertas.
//
// O alerta sempre aparece no console. Além disso, cada execução
// acrescenta uma linha no arquivo de histórico (config.ARQUIVO_HISTORICO),
// criando um registro automático ao longo do tempo — essa é a parte que
// evidencia a automação funcionando sozinha, dia após dia.

import { appendFile, access } from "node:fs/promises";
import { MUNICIPIO_ALVO, ESTADO_ALVO, ARQUIVO_HISTORICO } from "./config.js";

export function montarMensagem(resultado, dataReferencia) {
  return (
    `🔥 Alerta Amazônia — ${MUNICIPIO_ALVO}/${ESTADO_ALVO}\n` +
    `Data de referência: ${dataReferencia}\n` +
    `Focos de calor detectados: ${resultado.totalFocos}\n` +
    `Nível de risco: ${resultado.nivel}\n` +
    `Risco de fogo médio (INPE): ${resultado.riscoFogoMedio}`
  );
}

export function notificarConsole(mensagem) {
  console.log("\n" + "=".repeat(40));
  console.log(mensagem);
  console.log("=".repeat(40) + "\n");
}

// Acrescenta uma linha no arquivo de histórico. Cria o arquivo com
// cabeçalho na primeira vez que roda.
export async function notificarArquivo(resultado, dataReferencia) {
  const cabecalho =
    "data_referencia,municipio,estado,total_focos,nivel,risco_fogo_medio,registrado_em\n";
  const linha =
    [
      dataReferencia,
      MUNICIPIO_ALVO,
      ESTADO_ALVO,
      resultado.totalFocos,
      resultado.nivel,
      resultado.riscoFogoMedio,
      new Date().toISOString(),
    ].join(",") + "\n";

  let arquivoExiste = true;
  try {
    await access(ARQUIVO_HISTORICO);
  } catch {
    arquivoExiste = false;
  }

  const conteudo = arquivoExiste ? linha : cabecalho + linha;
  await appendFile(ARQUIVO_HISTORICO, conteudo, "utf-8");
  console.log(`Registro salvo em ${ARQUIVO_HISTORICO}`);
}

export async function enviarAlerta(resultado, dataReferencia) {
  const mensagem = montarMensagem(resultado, dataReferencia);
  notificarConsole(mensagem);
  await notificarArquivo(resultado, dataReferencia);
}
