import { redirect } from 'next/navigation';

/** O produto da E1 não depende da API: a raiz leva direto ao Painel. */
export default function HomePage(): never {
  redirect('/painel');
}
