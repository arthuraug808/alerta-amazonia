// Módulo responsável por baixar os dados públicos de focos de calor do
// Programa Queimadas do INPE (BDQueimadas).
//
// Fonte oficial: https://terrabrasilis.dpi.inpe.br/queimadas/portal/dados-abertos/
// Os dados são gratuitos, atualizados diariamente e não exigem cadastro.
//
// Colunas do CSV oficial:
// id, lat, lon, data_hora_gmt, satelite, municipio, estado, pais,
// municipio_id, estado_id, pais_id, numero_dias_sem_chuva, precipitacao,
// risco_fogo, bioma, frp

const URL_BASE =
  "https://dataserver-coids.inpe.br/queimadas/queimadas/focos/csv/diario/Brasil";

export function montarUrlDoDia(data) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${URL_BASE}/focos_diario_br_${ano}${mes}${dia}.csv`;
}

// Parser simples de CSV — funciona bem para o formato do INPE, que não
// usa vírgulas dentro dos campos (nomes de município, números com ponto
// decimal, etc.). Não é um parser genérico de CSV.
export function parseCsv(textoCsv) {
  const linhas = textoCsv.trim().split("\n");
  const cabecalho = linhas[0].split(",").map((c) => c.trim());

  return linhas.slice(1).map((linha) => {
    const valores = linha.split(",").map((v) => v.trim());
    const registro = {};
    cabecalho.forEach((coluna, i) => {
      registro[coluna] = valores[i];
    });
    return registro;
  });
}

// Baixa e carrega o CSV de focos de calor de um dia específico.
// Se nenhuma data for passada, usa o dia de ontem — o dado do dia atual
// normalmente só fica completo e disponível na manhã seguinte.
export async function baixarFocosDoDia(data) {
  if (!data) {
    data = new Date();
    data.setDate(data.getDate() - 1);
  }

  const url = montarUrlDoDia(data);
  console.log(`Baixando dados de: ${url}`);

  const resposta = await fetch(url);
  if (!resposta.ok) {
    throw new Error(`Erro ao baixar dados do INPE: HTTP ${resposta.status}`);
  }

  const textoCsv = await resposta.text();
  return parseCsv(textoCsv);
}
