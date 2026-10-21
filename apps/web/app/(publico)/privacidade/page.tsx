import { LegalPage } from '../../../components/LegalPage';
import { lerDocumentoLegal } from '../../../lib/legal/conteudo';

export const metadata = {
  title: 'Política de Privacidade · Bovaro',
  description: 'Como o Bovaro trata os seus dados pessoais (LGPD).',
};

export const dynamic = 'force-static';

export default function PrivacidadePage() {
  return <LegalPage atual="privacidade" markdown={lerDocumentoLegal('politica-de-privacidade')} />;
}
