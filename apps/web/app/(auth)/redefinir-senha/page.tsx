import { RedefinirSenhaScreen } from '../../../components/RedefinirSenhaScreen';

// O token vem na URL: nada de Referer para terceiros enquanto a página está aberta.
export const metadata = { title: 'Redefinir senha · Bovaro', referrer: 'no-referrer' as const };

export default function RedefinirSenhaPage() {
  return <RedefinirSenhaScreen />;
}
