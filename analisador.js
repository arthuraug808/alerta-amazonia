// Módulo responsável por filtrar os focos de calor pela região de
// interesse e calcular um nível de risco simples a partir da
// quantidade de focos.

import {
  MUNICIPIO_ALVO,
  ESTADO_ALVO,
  LIMITE_ALERTA_MODERADO,
  LIMITE_ALERTA_ALTO,
} from "./config.js";

export function filtrarPorRegiao(focos) {
  return focos.filter(
    (foco) =>
      (foco.municipio || "").toUpperCase() === MUNICIPIO_ALVO.toUpperCase() &&
      (foco.estado || "").toUpperCase() === ESTADO_ALVO.toUpperCase()
  );
}

// Calcula um nível de risco simples baseado na quantidade de focos
// detectados na região no dia, além da média do índice de risco de
// fogo já calculado pelo próprio INPE (coluna risco_fogo, de 0 a 1).
export function calcularNivelDeRisco(focosRegiao) {
  const totalFocos = focosRegiao.length;

  let nivel;
  if (totalFocos === 0) nivel = "SEM FOCOS";
  else if (totalFocos < LIMITE_ALERTA_MODERADO) nivel = "BAIXO";
  else if (totalFocos < LIMITE_ALERTA_ALTO) nivel = "MODERADO";
  else nivel = "ALTO";

  // O INPE usa -999 (e campo vazio) para "sem dado". Esses valores não
  // são risco: entram na média só os valores válidos, de 0 a 1.
  // Se nenhum foco tiver valor válido, o resultado fica 0.
  const validos = focosRegiao
    .map((foco) => parseFloat(foco.risco_fogo))
    .filter((risco) => !Number.isNaN(risco) && risco >= 0 && risco <= 1);
  const riscoFogoMedio =
    validos.length > 0
      ? Math.round((validos.reduce((soma, r) => soma + r, 0) / validos.length) * 100) / 100
      : 0;

  return { totalFocos, nivel, riscoFogoMedio };
}
