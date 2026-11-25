// Configurações do sistema de alerta.
//
// Edite os valores abaixo para focar na região que você quiser monitorar.
// Os nomes de município e estado devem ser escritos como aparecem nos
// dados do INPE (sem acentuação também é aceito, o código já normaliza
// para maiúsculas na comparação).

export const MUNICIPIO_ALVO = "ALTAMIRA";
export const ESTADO_ALVO = "PARÁ";

// A partir de quantos focos no dia o alerta deve mudar de nível?
export const LIMITE_ALERTA_MODERADO = 5;
export const LIMITE_ALERTA_ALTO = 15;

// O índice de risco de fogo do INPE (de 0 a 1) ajusta o nível definido
// pela quantidade de focos, em um degrau:
//   risco médio >= LIMITE_RISCO_ALTO   -> sobe um nível (no máximo ALTO)
//   risco médio <  LIMITE_RISCO_BAIXO  -> desce um nível (no mínimo BAIXO)
// Entre os dois valores, o nível não muda.
export const LIMITE_RISCO_ALTO = 0.8;
export const LIMITE_RISCO_BAIXO = 0.5;

// Nome do arquivo onde o histórico de alertas fica registrado.
// Cada execução do main.js acrescenta uma linha nova, sem apagar as
// anteriores — é esse arquivo que mostra a automação funcionando ao
// longo do tempo.
export const ARQUIVO_HISTORICO = "historico-alertas.csv";
