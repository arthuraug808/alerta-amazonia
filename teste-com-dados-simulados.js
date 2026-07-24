// Script de teste: simula um dia com focos de calor em Altamira/PA para
// validar a lógica de filtro, cálculo de risco e notificação, sem
// depender de acesso à internet.

import { filtrarPorRegiao, calcularNivelDeRisco } from "./analisador.js";
import { enviarAlerta } from "./notificador.js";
import { atualizarDashboard } from "./dashboard.js";

const dadosSimulados = [
  { municipio: "ALTAMIRA", estado: "PARÁ", risco_fogo: "0.8" },
  { municipio: "ALTAMIRA", estado: "PARÁ", risco_fogo: "0.9" },
  { municipio: "ALTAMIRA", estado: "PARÁ", risco_fogo: "0.7" },
  { municipio: "ALTAMIRA", estado: "PARÁ", risco_fogo: "0.6" },
  { municipio: "ALTAMIRA", estado: "PARÁ", risco_fogo: "0.85" },
  { municipio: "ALTAMIRA", estado: "PARÁ", risco_fogo: "0.75" },
  { municipio: "ITAITUBA", estado: "PARÁ", risco_fogo: "0.5" },
  { municipio: "NOVO PROGRESSO", estado: "PARÁ", risco_fogo: "0.4" },
];

const regiao = filtrarPorRegiao(dadosSimulados);
console.log(`Focos filtrados para a região: ${regiao.length} (esperado: 6)`);

const resultado = calcularNivelDeRisco(regiao);
console.log("Resultado do cálculo de risco:", resultado);

await enviarAlerta(resultado, "2026-07-19 (simulado)");
await atualizarDashboard();
