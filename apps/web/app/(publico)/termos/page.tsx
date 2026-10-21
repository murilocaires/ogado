import { LegalPage } from '../../../components/LegalPage';
import { lerDocumentoLegal } from '../../../lib/legal/conteudo';

export const metadata = {
  title: 'Termos de Uso · Bovaro',
  description: 'As regras para usar o Bovaro.',
};

export const dynamic = 'force-static';

export default function TermosPage() {
  return <LegalPage atual="termos" markdown={lerDocumentoLegal('termos-de-uso')} />;
}
