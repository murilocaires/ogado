import { Suspense } from 'react';
import { Carregando } from '../../../components/AppShell';
import { RecriaRoute } from '../../../components/RecriaRoute';

export const metadata = { title: 'Recria · O Gado' };

export default function RecriaPage() {
  return (
    <Suspense fallback={<Carregando />}>
      <RecriaRoute />
    </Suspense>
  );
}
