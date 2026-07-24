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

  let riscoFogoMedio = 0;
  if (totalFocos > 0) {
    const soma = focosRegiao.reduce(
      (acumulado, foco) => acumulado + parseFloat(foco.risco_fogo || 0),
      0
    );
    riscoFogoMedio = Math.round((soma / totalFocos) * 100) / 100;
  }

  return { totalFocos, nivel, riscoFogoMedio };
}
