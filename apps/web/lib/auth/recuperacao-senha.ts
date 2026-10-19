import type { ApiFailure } from './api-client';

/** Textos das telas de recuperação de senha (RF-002). A API nunca dita a mensagem mostrada. */
export const MSG_RECUPERACAO = {
  confirmacaoEsqueci:
    'Se houver uma conta com este e-mail, enviamos um link para redefinir a senha. O link vale por 1 hora. Se não chegar, olhe também o spam.',
  offline: 'Você está sem internet. Para recuperar a senha é preciso internet.',
  linkInvalido: 'Este link para redefinir a senha é inválido ou expirou. Peça um novo.',
  senhaRequisitos: 'A senha ainda não cumpre os requisitos abaixo.',
  confirmacaoDiferente: 'As senhas não coincidem.',
  confirmacaoVazia: 'Repita a nova senha.',
  sucesso: 'Senha redefinida. Por segurança, você precisa entrar de novo com a nova senha.',
} as const;

export function mensagemFalhaRecuperacao(falha: ApiFailure): string {
  switch (falha.kind) {
    case 'rede':
      return 'Não foi possível conectar. Verifique a conexão e tente de novo.';
    case 'bloqueada':
      return 'A solicitação foi bloqueada. Recarregue a página e tente de novo.';
    case 'muitas-tentativas':
      return falha.retryAfterSeconds
        ? `Muitas tentativas, aguarde ${falha.retryAfterSeconds} segundos e tente de novo.`
        : 'Muitas tentativas, aguarde um pouco e tente de novo.';
    default:
      return 'Algo deu errado do nosso lado. Tente de novo em instantes.';
  }
}
