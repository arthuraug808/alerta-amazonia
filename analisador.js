// Módulo responsável por filtrar os focos de calor pela região de
// interesse e classificar o nível de alerta.
//
// O nível combina duas informações do INPE:
//   1. a quantidade de focos detectados na região no dia (nível base);
//   2. o índice de risco de fogo (0 a 1), que ajusta o nível em um degrau.
// Os limites ficam em config.js.

import {
  MUNICIPIO_ALVO,
  ESTADO_ALVO,
  LIMITE_ALERTA_MODERADO,
  LIMITE_ALERTA_ALTO,
  LIMITE_RISCO_ALTO,
  LIMITE_RISCO_BAIXO,
} from "./config.js";

const NIVEIS = ["BAIXO", "MODERADO", "ALTO"];

export function filtrarPorRegiao(focos) {
  return focos.filter(
    (foco) =>
      (foco.municipio || "").toUpperCase() === MUNICIPIO_ALVO.toUpperCase() &&
      (foco.estado || "").toUpperCase() === ESTADO_ALVO.toUpperCase()
  );
}

// Regra de classificação (a mesma usada no cartão "Alerta do dia" do
// painel; se mudar aqui, mude lá também).
//   - nenhum foco: "SEM FOCOS" (o risco não é considerado);
//   - nível base pela contagem: BAIXO, MODERADO ou ALTO;
//   - com risco válido: risco >= LIMITE_RISCO_ALTO sobe um nível,
//     risco < LIMITE_RISCO_BAIXO desce um nível (limites: BAIXO e ALTO);
//   - sem risco válido: vale só a contagem.
export function classificarNivel(totalFocos, riscoMedio, riscoDisponivel) {
  if (totalFocos === 0) return { nivel: "SEM FOCOS", nivelPorFocos: "SEM FOCOS" };

  const base = totalFocos < LIMITE_ALERTA_MODERADO ? 0 : totalFocos < LIMITE_ALERTA_ALTO ? 1 : 2;
  let ajuste = 0;
  if (riscoDisponivel) {
    if (riscoMedio >= LIMITE_RISCO_ALTO) ajuste = 1;
    else if (riscoMedio < LIMITE_RISCO_BAIXO) ajuste = -1;
  }
  const nivel = NIVEIS[Math.min(2, Math.max(0, base + ajuste))];
  return { nivel, nivelPorFocos: NIVEIS[base] };
}

// Calcula o nível de alerta a partir dos focos da região no dia.
export function calcularNivelDeRisco(focosRegiao) {
  const totalFocos = focosRegiao.length;

  // O INPE usa -999 (e campo vazio) para "sem dado". Esses valores não
  // são risco: entram na média só os valores válidos, de 0 a 1.
  // Se nenhum foco tiver valor válido, o risco médio fica 0 e o nível
  // vale só pela contagem de focos.
  const validos = focosRegiao
    .map((foco) => parseFloat(foco.risco_fogo))
    .filter((risco) => !Number.isNaN(risco) && risco >= 0 && risco <= 1);
  const riscoDisponivel = validos.length > 0;
  const riscoFogoMedio = riscoDisponivel
    ? Math.round((validos.reduce((soma, r) => soma + r, 0) / validos.length) * 100) / 100
    : 0;

  const { nivel, nivelPorFocos } = classificarNivel(totalFocos, riscoFogoMedio, riscoDisponivel);
  return { totalFocos, nivel, nivelPorFocos, riscoFogoMedio, riscoDisponivel };
}
