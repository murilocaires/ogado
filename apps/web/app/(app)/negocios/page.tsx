import { Suspense } from 'react';
import { Carregando } from '../../../components/AppShell';
import { NegociosScreen } from '../../../components/NegociosScreen';

export const metadata = { title: 'Negócios · O Gado' };

export default function NegociosPage() {
  return (
    <Suspense fallback={<Carregando />}>
      <NegociosScreen />
    </Suspense>
  );
}
