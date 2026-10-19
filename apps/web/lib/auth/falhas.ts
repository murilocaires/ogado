import type { ApiFailure } from './api-client';

/** Mensagens das falhas comuns às ações da Conta. Casos específicos ficam na tela. */
export const MSG_CONTA = {
  offline: 'Você está sem internet. Para alterar os dados da conta é preciso internet.',
  rede: 'Não foi possível conectar. Verifique a conexão e tente de novo.',
  servidor: 'Algo deu errado do nosso lado. Tente de novo em instantes.',
  bloqueada: 'A solicitação foi bloqueada. Recarregue a página e tente de novo.',
  sessao: 'Sua sessão terminou. Entre de novo para continuar.',
} as const;

export function mensagemFalha(falha: ApiFailure): string {
  switch (falha.kind) {
    case 'rede':
      return MSG_CONTA.rede;
    case 'bloqueada':
      return MSG_CONTA.bloqueada;
    case 'nao-autenticado':
    case 'sessao-expirada':
      return MSG_CONTA.sessao;
    case 'muitas-tentativas':
      return falha.retryAfterSeconds
        ? `Muitas tentativas. Tente de novo em ${falha.retryAfterSeconds} segundos.`
        : 'Muitas tentativas. Aguarde um pouco e tente de novo.';
    default:
      return MSG_CONTA.servidor;
  }
}
