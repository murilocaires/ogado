import { LegalPage } from '../../../components/LegalPage';
import { lerDocumentoLegal } from '../../../lib/legal/conteudo';

export const metadata = {
  title: 'Termos de Uso · O Gado',
  description: 'As regras para usar o O Gado.',
};

export const dynamic = 'force-static';

export default function TermosPage() {
  return <LegalPage atual="termos" markdown={lerDocumentoLegal('termos-de-uso')} />;
}
