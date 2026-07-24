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

// Nome do arquivo onde o histórico de alertas fica registrado.
// Cada execução do main.js acrescenta uma linha nova, sem apagar as
// anteriores — é esse arquivo que mostra a automação funcionando ao
// longo do tempo.
export const ARQUIVO_HISTORICO = "historico-alertas.csv";
