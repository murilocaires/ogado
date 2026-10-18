'use client';

import { useSearchParams } from 'next/navigation';
import { RecriaScreen } from './RecriaScreen';

/** Lê `?aba=cenarios` (link do Painel) e abre a aba certa da Recria. */
export function RecriaRoute() {
  const params = useSearchParams();
  return <RecriaScreen abaInicial={params.get('aba') === 'cenarios' ? 'cenarios' : 'simulador'} />;
}
