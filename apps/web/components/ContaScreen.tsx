'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type Ref,
} from 'react';
import {
  areaHaSchema,
  failedPasswordRules,
  perfilRequestSchema,
  type FazendaDto,
  type FieldError,
  type UsuarioDto,
} from '@bovaro/contracts';
import type { ApiFailure } from '../lib/auth/api-client';
import { MSG_CONTA, mensagemFalha } from '../lib/auth/falhas';
import { useSessionController, useSessionState } from '../lib/auth/session-provider';
import { baixarArquivo } from '../lib/exportacao/baixar';
import { dataParaArquivo } from '../lib/exportacao/tabela';
import { lerCampo, paraCampo } from '../lib/format';
import { useOpcaoInstalacao } from '../lib/pwa/instalacao';
import { Carregando, PageHeader } from './AppShell';
import { ConfirmDialog, Dialog } from './Dialog';
import { GoogleLink, GoogleMark } from './GoogleButton';
import { Icon, type IconName } from './Icon';
import { InstalarApp } from './InstalarApp';
import { PasswordRules } from './PasswordRules';
import { SincronizacaoPainel } from './SincronizacaoPainel';
import { useSyncInfo, useSyncStatus } from './SyncProvider';
import { useToast } from './Toast';

/** Tela Conta (RF-004, RF-005, RF-007, RF-011, RF-078), copiada do protótipo; RF-006 (Google) na seção própria. */

const MSG = {
  senhaAtualErrada: 'A senha atual está incorreta.',
  senhaRequisitos: 'A senha ainda não cumpre os requisitos abaixo.',
  confirmacaoDiferente: 'A confirmação não confere com a nova senha.',
  emailEmUso: 'Não foi possível salvar com este e-mail.',
  versaoAntiga:
    'A fazenda foi alterada em outro aparelho. Mostramos os dados atuais: confira e salve de novo.',
  sairFalhou:
    'Não foi possível sair agora. Verifique a conexão e tente de novo. Nada foi apagado deste aparelho.',
  definirSenhaSemAtual: 'Você ainda não tem uma senha. Defina uma para entrar sem a conta Google.',
  googleSemSenha: 'Defina uma senha antes de desvincular o Google.',
  googleErro: 'Não foi possível entrar com o Google. Tente de novo.',
  googleJaVinculado: 'Esta conta Google já está vinculada a outro usuário.',
  googleVinculado: 'Conta Google vinculada.',
  googleDesvinculado: 'Conta Google desvinculada.',
  apagarFalhou: 'Não foi possível apagar a conta agora. Nada foi apagado. Tente de novo.',
} as const;

type Erros<K extends string> = Partial<Record<K, string>>;

function errosDoServidor<K extends string>(campos: FieldError[], nomes: readonly K[]): Erros<K> {
  const erros: Erros<K> = {};
  for (const campo of campos) {
    const nome = nomes.find((n) => n === campo.caminho);
    if (nome && !erros[nome]) erros[nome] = campo.mensagem;
  }
  return erros;
}

function foco(elemento: HTMLInputElement | null): void {
  elemento?.focus();
}

/** Campo BRANCO (entrada do usuário), com rótulo associado e erro ligado por `aria-describedby`. */
function Campo({
  label,
  value,
  onChange,
  erro,
  type = 'text',
  autoComplete,
  inputMode,
  sufixo,
  placeholder,
  inputRef,
}: {
  label: string;
  value: string;
  onChange: (valor: string) => void;
  erro?: string | undefined;
  type?: 'text' | 'email' | 'password';
  autoComplete?: string;
  inputMode?: 'decimal';
  sufixo?: string;
  placeholder?: string;
  inputRef?: Ref<HTMLInputElement>;
}) {
  const id = useId();
  const erroId = `${id}-erro`;
  return (
    <div className="lbl">
      <label htmlFor={id}>{label}</label>
      <div className="fld" data-invalid={erro ? 'true' : 'false'}>
        <input
          ref={inputRef}
          id={id}
          type={type}
          value={value}
          autoComplete={autoComplete}
          inputMode={inputMode}
          placeholder={placeholder}
          spellCheck={false}
          autoCapitalize="none"
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? erroId : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
        {sufixo && <span aria-hidden="true">{sufixo}</span>}
      </div>
      {erro && (
        <span className="err" id={erroId}>
          {erro}
        </span>
      )}
    </div>
  );
}

function Secao({
  icone,
  titulo,
  descricao,
  perigo,
  children,
}: {
  icone: IconName;
  titulo: string;
  descricao: string;
  perigo?: boolean;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section className={`sec${perigo ? ' dg' : ''}`} aria-labelledby={id}>
      <div className="hd">
        <span className="ico">
          <Icon name={icone} size={20} />
        </span>
        <div>
          <h3 id={id}>{titulo}</h3>
          <p>{descricao}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Rodape({
  dica,
  rotulo,
  ocupado,
  rotuloOcupado,
}: {
  dica: string;
  rotulo: string;
  ocupado: boolean;
  rotuloOcupado: string;
}) {
  return (
    <div className="ft">
      <span className="hint">{dica}</span>
      <button
        type="submit"
        className="btn sm"
        aria-disabled={ocupado}
        aria-busy={ocupado}
        onClick={(e) => {
          if (ocupado) e.preventDefault();
        }}
      >
        {ocupado ? rotuloOcupado : rotulo}
      </button>
    </div>
  );
}

function Alerta({ texto }: { texto: string | null }) {
  return texto ? (
    <div className="note erro" role="alert">
      {texto}
    </div>
  ) : null;
}

/* ---------- Perfil (RF-004) ---------- */

function PerfilSecao({ usuario }: { usuario: UsuarioDto }) {
  const controller = useSessionController();
  const toast = useToast();
  const [nome, setNome] = useState(usuario.nome ?? '');
  const [email, setEmail] = useState(usuario.email);
  const [erros, setErros] = useState<Erros<'nome' | 'email'>>({});
  const [falha, setFalha] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const refNome = useRef<HTMLInputElement>(null);
  const refEmail = useRef<HTMLInputElement>(null);

  function pedir(e: FormEvent): void {
    e.preventDefault();
    if (salvando) return;
    setFalha(null);
    const lido = perfilRequestSchema.safeParse({ nome, email });
    if (!lido.success) {
      const novos: Erros<'nome' | 'email'> = {};
      for (const issue of lido.error.issues) {
        const campo = issue.path[0];
        if ((campo === 'nome' || campo === 'email') && !novos[campo]) novos[campo] = issue.message;
      }
      setErros(novos);
      foco(novos.nome ? refNome.current : refEmail.current);
      return;
    }
    setErros({});
    void salvar();
  }

  async function salvar(): Promise<void> {
    if (!navigator.onLine) {
      setFalha(MSG_CONTA.offline);
      return;
    }
    const lido = perfilRequestSchema.safeParse({ nome, email });
    if (!lido.success) return;
    setSalvando(true);
    const res = await controller.updatePerfil(lido.data);
    setSalvando(false);
    if (res.ok) {
      setNome(res.data.usuario.nome ?? lido.data.nome);
      setEmail(res.data.usuario.email);
      toast('Dados atualizados.');
      return;
    }
    tratarFalha(res);
  }

  function tratarFalha(res: ApiFailure): void {
    if (res.kind === 'validacao') {
      const doServidor = errosDoServidor(res.campos, ['nome', 'email'] as const);
      if (doServidor.nome || doServidor.email) {
        setErros(doServidor);
        foco(doServidor.nome ? refNome.current : refEmail.current);
        return;
      }
    }
    if (res.kind === 'conflito') {
      setErros({ email: MSG.emailEmUso });
      foco(refEmail.current);
      return;
    }
    setFalha(mensagemFalha(res));
  }

  return (
    <form className="panel" onSubmit={pedir} noValidate aria-label="Perfil">
      <div className="bd">
        <div className="r2">
          <Campo
            label="Nome"
            value={nome}
            onChange={setNome}
            erro={erros.nome}
            autoComplete="name"
            inputRef={refNome}
          />
          <Campo
            label="E-mail"
            value={email}
            onChange={setEmail}
            erro={erros.email}
            type="email"
            autoComplete="email"
            inputRef={refEmail}
          />
        </div>
        <Alerta texto={falha} />
      </div>
      <Rodape
        dica="Usado no login e nas mensagens do sistema."
        rotulo="Salvar dados"
        ocupado={salvando}
        rotuloOcupado="Salvando…"
      />
    </form>
  );
}

/* ---------- Senha (RF-005) ---------- */

type CamposSenha = 'senhaAtual' | 'novaSenha' | 'confirmacao';

function SenhaSecao({ temSenha }: { temSenha: boolean }) {
  const controller = useSessionController();
  const toast = useToast();
  const regrasId = useId();
  const [novaTocada, setNovaTocada] = useState(false);
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erros, setErros] = useState<Erros<CamposSenha>>({});
  const [falha, setFalha] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const refs = {
    senhaAtual: useRef<HTMLInputElement>(null),
    novaSenha: useRef<HTMLInputElement>(null),
    confirmacao: useRef<HTMLInputElement>(null),
  };

  function focarPrimeiro(e: Erros<CamposSenha>): void {
    const ordem: CamposSenha[] = ['senhaAtual', 'novaSenha', 'confirmacao'];
    const primeiro = ordem.find((c) => e[c]);
    if (primeiro) foco(refs[primeiro].current);
  }

  function pedir(e: FormEvent): void {
    e.preventDefault();
    if (salvando) return;
    setFalha(null);
    const novos: Erros<CamposSenha> = {};
    if (temSenha && atual === '') novos.senhaAtual = 'Informe a senha atual.';
    if (nova === '') novos.novaSenha = 'Informe a nova senha.';
    else if (failedPasswordRules(nova).length > 0) novos.novaSenha = MSG.senhaRequisitos;
    if (confirmacao !== nova) novos.confirmacao = MSG.confirmacaoDiferente;
    setErros(novos);
    if (Object.keys(novos).length > 0) {
      focarPrimeiro(novos);
      return;
    }
    void salvar();
  }

  async function salvar(): Promise<void> {
    if (!navigator.onLine) {
      setFalha(MSG_CONTA.offline);
      return;
    }
    setSalvando(true);
    const res = await controller.changePassword(
      temSenha ? { senhaAtual: atual, novaSenha: nova } : { novaSenha: nova },
    );
    setSalvando(false);
    if (res.ok) {
      setAtual('');
      setNova('');
      setConfirmacao('');
      setErros({});
      toast(temSenha ? 'Senha atualizada.' : 'Senha definida.');
      return;
    }
    if (res.kind === 'credenciais') {
      setErros({ senhaAtual: MSG.senhaAtualErrada });
      foco(refs.senhaAtual.current);
      return;
    }
    if (res.kind === 'validacao') {
      const doServidor = errosDoServidor(res.campos, ['senhaAtual', 'novaSenha'] as const);
      if (doServidor.senhaAtual || doServidor.novaSenha) {
        setErros(doServidor);
        focarPrimeiro(doServidor);
        return;
      }
    }
    setFalha(mensagemFalha(res));
  }

  return (
    <form className="panel" onSubmit={pedir} noValidate aria-label="Senha">
      <div className="bd">
        {temSenha ? (
          <Campo
            label="Senha atual"
            value={atual}
            onChange={setAtual}
            erro={erros.senhaAtual}
            type="password"
            autoComplete="current-password"
            inputRef={refs.senhaAtual}
          />
        ) : (
          <div className="note">{MSG.definirSenhaSemAtual}</div>
        )}
        <div className="r2" onFocus={() => setNovaTocada(true)}>
          <Campo
            label="Nova senha"
            value={nova}
            onChange={setNova}
            erro={erros.novaSenha}
            type="password"
            autoComplete="new-password"
            inputRef={refs.novaSenha}
          />
          <Campo
            label="Confirmar nova senha"
            value={confirmacao}
            onChange={setConfirmacao}
            erro={erros.confirmacao}
            type="password"
            autoComplete="new-password"
            inputRef={refs.confirmacao}
          />
        </div>
        <PasswordRules senha={nova} id={regrasId} tocada={novaTocada} />
        <Alerta texto={falha} />
      </div>
      <Rodape
        dica="Use letras, números e símbolos para uma senha forte."
        rotulo={temSenha ? 'Alterar senha' : 'Definir senha'}
        ocupado={salvando}
        rotuloOcupado="Salvando…"
      />
    </form>
  );
}

/* ---------- Google (RF-006) ---------- */

function GoogleSecao({ vinculado }: { vinculado: boolean }) {
  const controller = useSessionController();
  const toast = useToast();
  const [confirmando, setConfirmando] = useState(false);
  const [desvinculando, setDesvinculando] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);

  async function desvincular(): Promise<void> {
    setConfirmando(false);
    if (!navigator.onLine) {
      setFalha(MSG_CONTA.offline);
      return;
    }
    setFalha(null);
    setDesvinculando(true);
    const res = await controller.unlinkGoogle();
    setDesvinculando(false);
    if (res.ok) {
      toast(MSG.googleDesvinculado);
      return;
    }
    setFalha(res.kind === 'conflito' ? MSG.googleSemSenha : mensagemFalha(res));
  }

  return (
    <div className="panel">
      <div className="bd">
        <div className="rowi">
          <span className="gmark">
            <GoogleMark />
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <b style={{ display: 'block' }}>Google</b>
            <span className="hint">
              {vinculado
                ? 'Você pode usar “Entrar com Google” na tela de acesso.'
                : 'Entre mais rápido, sem digitar senha.'}
            </span>
          </div>
          <span className={`sp${vinculado ? ' ok' : ''}`}>
            <i />
            {vinculado ? 'Vinculada' : 'Não vinculada'}
          </span>
        </div>
        <Alerta texto={falha} />
      </div>
      <div className="ft">
        <span className="hint">
          {vinculado
            ? 'Para desvincular, a conta precisa ter uma senha.'
            : 'Você será levado ao Google para autorizar.'}
        </span>
        {vinculado ? (
          <button
            type="button"
            className="btn sec sm"
            aria-disabled={desvinculando}
            aria-busy={desvinculando}
            onClick={() => {
              if (!desvinculando) setConfirmando(true);
            }}
          >
            {desvinculando ? 'Desvinculando…' : 'Desvincular'}
          </button>
        ) : (
          <GoogleLink texto="Vincular conta Google" modo="vincular" className="btn sm" />
        )}
      </div>
      {confirmando && (
        <ConfirmDialog
          titulo="Desvincular conta Google?"
          texto="Você continuará entrando com e-mail e senha."
          confirmar="Desvincular"
          onConfirm={() => void desvincular()}
          onCancel={() => setConfirmando(false)}
        />
      )}
    </div>
  );
}

/** Retorno do Google (?google=vinculado | ?erro=...): avisa uma vez e limpa a URL. */
function useRetornoGoogle(): { erro: string | null; alertaRef: Ref<HTMLDivElement> } {
  const toast = useToast();
  const [erro, setErro] = useState<string | null>(null);
  const alertaRef = useRef<HTMLDivElement>(null);
  const toastRef = useRef(toast);
  toastRef.current = toast;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const resultado = params.get('google');
    const falha = params.get('erro');
    let texto: string | null = null;
    if (falha === 'google') texto = MSG.googleErro;
    else if (falha === 'google-ja-vinculado') texto = MSG.googleJaVinculado;
    if (resultado !== 'vinculado' && !texto) return;
    if (!texto) toastRef.current(MSG.googleVinculado);
    setErro(texto);
    params.delete('google');
    params.delete('erro');
    const resto = params.toString();
    window.history.replaceState(
      window.history.state,
      '',
      window.location.pathname + (resto ? `?${resto}` : ''),
    );
  }, []);

  useEffect(() => {
    if (erro) alertaRef.current?.focus();
  }, [erro]);

  return { erro, alertaRef };
}

/* ---------- Fazenda (RF-011) ---------- */

type CamposFazenda = 'nome' | 'areaHa';

/** Texto pt-BR da área -> string canônica (ponto), `null` se vazio. Nunca arredonda em silêncio. */
function lerArea(texto: string): { ok: true; valor: string | null } | { ok: false; erro: string } {
  const leitura = lerCampo(texto);
  if (leitura.tipo === 'vazio') return { ok: true, valor: null };
  if (leitura.tipo === 'invalido') return { ok: false, erro: leitura.dica };
  if (leitura.valor.isNegative() && !leitura.valor.isZero()) {
    return { ok: false, erro: 'A área não pode ser negativa.' };
  }
  const canonica = leitura.valor.toFixed();
  const valida = areaHaSchema.safeParse(canonica);
  return valida.success
    ? { ok: true, valor: canonica }
    : { ok: false, erro: valida.error.issues[0]?.message ?? 'Área inválida.' };
}

function FazendaSecao({ fazenda }: { fazenda: FazendaDto }) {
  const controller = useSessionController();
  const toast = useToast();
  const [nome, setNome] = useState(fazenda.nome ?? '');
  const [area, setArea] = useState(fazenda.areaHa === null ? '' : paraCampo(fazenda.areaHa));
  const [versao, setVersao] = useState(fazenda.version);
  const [erros, setErros] = useState<Erros<CamposFazenda>>({});
  const [falha, setFalha] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const refNome = useRef<HTMLInputElement>(null);
  const refArea = useRef<HTMLInputElement>(null);

  function validar(): { nome: string; areaHa: string | null } | null {
    const novos: Erros<CamposFazenda> = {};
    const nomeLimpo = nome.trim();
    if (nomeLimpo === '') novos.nome = 'Informe o nome da fazenda.';
    else if (nomeLimpo.length > 120)
      novos.nome = 'O nome da fazenda deve ter no máximo 120 caracteres.';
    const areaLida = lerArea(area);
    if (!areaLida.ok) novos.areaHa = areaLida.erro;
    setErros(novos);
    if (novos.nome || novos.areaHa || !areaLida.ok) {
      foco(novos.nome ? refNome.current : refArea.current);
      return null;
    }
    return { nome: nomeLimpo, areaHa: areaLida.valor };
  }

  function pedir(e: FormEvent): void {
    e.preventDefault();
    if (salvando) return;
    setFalha(null);
    setAviso(null);
    if (validar()) void salvar();
  }

  function aplicar(f: FazendaDto): void {
    setNome(f.nome ?? '');
    setArea(f.areaHa === null ? '' : paraCampo(f.areaHa));
    setVersao(f.version);
  }

  async function salvar(): Promise<void> {
    if (!navigator.onLine) {
      setFalha(MSG_CONTA.offline);
      return;
    }
    const corpo = validar();
    if (!corpo) return;
    setSalvando(true);
    const res = await controller.updateFazenda({ ...corpo, version: versao });
    setSalvando(false);
    if (res.ok) {
      aplicar(res.data.fazenda);
      toast('Fazenda atualizada.');
      return;
    }
    if (res.kind === 'conflito') {
      // Outro aparelho gravou antes: mostra o que está valendo e deixa a pessoa decidir de novo.
      if (res.atual) aplicar(res.atual);
      void controller.verify();
      setAviso(MSG.versaoAntiga);
      return;
    }
    if (res.kind === 'validacao') {
      const doServidor = errosDoServidor(res.campos, ['nome', 'areaHa'] as const);
      if (doServidor.nome || doServidor.areaHa) {
        setErros(doServidor);
        foco(doServidor.nome ? refNome.current : refArea.current);
        return;
      }
    }
    setFalha(mensagemFalha(res));
  }

  return (
    <form className="panel" onSubmit={pedir} noValidate aria-label="Fazenda">
      <div className="bd">
        <div className="r2">
          <Campo
            label="Nome da fazenda"
            value={nome}
            onChange={setNome}
            erro={erros.nome}
            inputRef={refNome}
          />
          <Campo
            label="Área pastável"
            value={area}
            onChange={setArea}
            erro={erros.areaHa}
            inputMode="decimal"
            sufixo="ha"
            inputRef={refArea}
          />
        </div>
        {aviso && (
          <div className="note" role="status">
            {aviso}
          </div>
        )}
        <Alerta texto={falha} />
      </div>
      <Rodape
        dica="A área é usada nos cálculos de lotação e de resultado por hectare."
        rotulo="Salvar"
        ocupado={salvando}
        rotuloOcupado="Salvando…"
      />
    </form>
  );
}

/* ---------- Meus dados (RNF-009) ---------- */

function MeusDadosSecao({ email }: { email: string }) {
  const controller = useSessionController();
  const toast = useToast();
  const [baixando, setBaixando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);
  const ocupado = useRef(false);

  async function baixar(): Promise<void> {
    if (ocupado.current) return;
    setFalha(null);
    if (!navigator.onLine) {
      setFalha(MSG_CONTA.offline);
      return;
    }
    ocupado.current = true;
    setBaixando(true);
    const res = await controller.exportData();
    ocupado.current = false;
    setBaixando(false);
    if (!res.ok) {
      setFalha(mensagemFalha(res));
      return;
    }
    const arquivo = {
      nome: `bovaro-meus-dados-${dataParaArquivo()}.json`,
      tipo: 'application/json;charset=utf-8',
      conteudo: JSON.stringify(res.data, null, 2),
    };
    baixarArquivo(arquivo);
    toast(`Arquivo ${arquivo.nome} baixado.`);
  }

  async function enviar(): Promise<void> {
    if (ocupado.current) return;
    setFalha(null);
    if (!navigator.onLine) {
      setFalha(MSG_CONTA.offline);
      return;
    }
    ocupado.current = true;
    setEnviando(true);
    const res = await controller.sendDataByEmail();
    ocupado.current = false;
    setEnviando(false);
    if (!res.ok) {
      setFalha(mensagemFalha(res));
      return;
    }
    toast(`Pedido enviado. Se tudo deu certo, a cópia chega em ${email} em alguns minutos.`);
  }

  return (
    <div className="panel">
      <div className="bd">
        <p style={{ margin: 0, color: 'var(--tinta-2)', fontSize: 14, lineHeight: 1.5 }}>
          Uma cópia dos dados da sua conta em JSON: perfil, fazenda, lotes, cenários e as entradas
          da recria. Traz só o que não foi excluído; senhas e dados de acesso não fazem parte.
        </p>
        <Alerta texto={falha} />
      </div>
      <div className="ft">
        <span className="hint">
          Precisa de internet. Limites por hora: 10 downloads e 3 envios por e-mail.
        </span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn sec sm"
            aria-disabled={enviando}
            aria-busy={enviando}
            onClick={() => void enviar()}
          >
            {enviando ? 'Enviando…' : 'Enviar meus dados por e-mail'}
          </button>
          <button
            type="button"
            className="btn sec sm"
            aria-disabled={baixando}
            aria-busy={baixando}
            onClick={() => void baixar()}
          >
            <Icon name="baixar" size={18} />
            {baixando ? 'Preparando…' : 'Baixar meus dados (JSON)'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Termos e privacidade (RNF-009) ---------- */

function dataAceite(iso: string | null): string | null {
  if (!iso) return null;
  const data = new Date(iso);
  return Number.isNaN(data.getTime()) ? null : data.toLocaleDateString('pt-BR');
}

function TermosSecao({ usuario, onRevogar }: { usuario: UsuarioDto; onRevogar: () => void }) {
  const quando = dataAceite(usuario.aceiteTermosEm);
  return (
    <div className="panel">
      <div className="bd">
        <p style={{ margin: 0, lineHeight: 1.5 }} data-testid="aceite-atual">
          {usuario.aceiteTermosVersao ? (
            <>
              Você aceitou a versão <b>{usuario.aceiteTermosVersao}</b>
              {quando ? ` em ${quando}` : ''}.
            </>
          ) : (
            'Você ainda não aceitou os termos.'
          )}
        </p>
        <p style={{ margin: '8px 0 0', fontSize: 14.5 }}>
          <Link href="/termos" target="_blank" rel="noopener noreferrer" className="legal-link">
            Termos de Uso
          </Link>
          {' · '}
          <Link
            href="/privacidade"
            target="_blank"
            rel="noopener noreferrer"
            className="legal-link"
          >
            Política de Privacidade
          </Link>
        </p>
      </div>
      <div className="ft">
        <span className="hint">
          Revogar o consentimento equivale a apagar a conta: sem o aceite não é possível usar o
          serviço.
        </span>
        <button type="button" className="btn danger sm" onClick={onRevogar}>
          Revogar consentimento
        </button>
      </div>
    </div>
  );
}

/* ---------- Sair (RF-002, RF-078) ---------- */

function SairDialog({ onClose, onFalha }: { onClose: () => void; onFalha: () => void }) {
  const router = useRouter();
  const controller = useSessionController();
  const sync = useSyncStatus();
  const { totalPendentes } = useSyncInfo();
  const [saindo, setSaindo] = useState(false);
  const ocupado = useRef(false);
  const comPendencias = sync !== 'sincronizado' || totalPendentes > 0;

  async function sair(): Promise<void> {
    if (ocupado.current) return;
    ocupado.current = true;
    setSaindo(true);
    const res = await controller.logout();
    ocupado.current = false;
    setSaindo(false);
    if (res.ok) {
      router.replace('/entrar');
      return;
    }
    onFalha();
    onClose();
  }

  return (
    <Dialog
      titulo="Sair deste aparelho?"
      role="alertdialog"
      estreito
      confirmacao
      focoInicial="[data-cancelar]"
      onClose={() => {
        if (!ocupado.current) onClose();
      }}
    >
      <p style={{ margin: 0, color: 'var(--tinta-2)', lineHeight: 1.5 }}>
        Ao sair, os dados guardados neste aparelho são apagados. O que já está na sua conta volta
        quando você entrar de novo.
      </p>
      {comPendencias && (
        <div className="note erro" role="alert" style={{ marginTop: 12 }}>
          {totalPendentes > 0
            ? `Atenção: ${totalPendentes} ${totalPendentes === 1 ? 'lançamento ainda não foi enviado' : 'lançamentos ainda não foram enviados'} para a nuvem. Se sair agora, ${totalPendentes === 1 ? 'ele será perdido' : 'eles serão perdidos'}.`
            : 'Atenção: há alterações que ainda não foram sincronizadas com a nuvem. Se sair agora, elas serão perdidas.'}
        </div>
      )}
      <div className="actions">
        <button
          type="button"
          className="btn sec"
          data-cancelar
          aria-disabled={saindo}
          onClick={() => {
            if (!saindo) onClose();
          }}
        >
          Continuar logado
        </button>
        <button
          type="button"
          className="btn danger"
          aria-busy={saindo}
          aria-disabled={saindo}
          onClick={() => void sair()}
        >
          {saindo ? 'Saindo…' : 'Sair'}
        </button>
      </div>
    </Dialog>
  );
}

/* ---------- Apagar conta (RF-007) ---------- */

export function ApagarDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const controller = useSessionController();
  const inputId = useId();
  const [texto, setTexto] = useState('');
  const [apagando, setApagando] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);
  const ocupado = useRef(false);
  const liberado = texto.trim().toLowerCase() === 'deletar';

  async function apagar(): Promise<void> {
    if (!liberado || ocupado.current) return;
    if (!navigator.onLine) {
      setFalha(MSG_CONTA.offline);
      return;
    }
    ocupado.current = true;
    setApagando(true);
    setFalha(null);
    const res = await controller.deleteAccount();
    ocupado.current = false;
    setApagando(false);
    if (res.ok) {
      router.replace('/entrar');
      return;
    }
    setFalha(
      res.kind === 'servidor' || res.kind === 'contrato' ? MSG.apagarFalhou : mensagemFalha(res),
    );
  }

  return (
    <Dialog
      titulo="Apagar sua conta?"
      role="alertdialog"
      estreito
      confirmacao
      focoInicial="input"
      onClose={() => {
        if (!ocupado.current) onClose();
      }}
    >
      <p style={{ margin: '0 0 12px', color: 'var(--tinta-2)', lineHeight: 1.5 }}>
        Esta ação é <b>permanente</b>. Serão apagados seu perfil, a fazenda, todos os lotes de
        compra e venda e todos os cenários.
      </p>
      <div className="lbl">
        <label htmlFor={inputId}>
          Para confirmar, escreva <b>deletar</b>
        </label>
        <div className="fld">
          <input
            id={inputId}
            value={texto}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            onChange={(e) => setTexto(e.target.value)}
          />
        </div>
      </div>
      {falha && (
        <div className="note erro" role="alert" style={{ marginTop: 12 }}>
          {falha}
        </div>
      )}
      <div className="actions">
        <button type="button" className="btn sec" disabled={apagando} onClick={onClose}>
          Cancelar
        </button>
        <button
          type="button"
          className="btn danger"
          disabled={!liberado || apagando}
          aria-busy={apagando}
          onClick={() => void apagar()}
        >
          {apagando ? 'Apagando…' : 'Apagar conta'}
        </button>
      </div>
    </Dialog>
  );
}

/* ---------- Tela ---------- */

function iniciais(nome: string): string {
  const letras = nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0))
    .join('')
    .toUpperCase();
  return letras || 'P';
}

/** Seção "Instalar o app" (RF-070): some quando o app já está instalado ou o navegador não oferece. */
function InstalarSecao() {
  const opcao = useOpcaoInstalacao();
  if (opcao === 'nenhuma') return null;
  return (
    <Secao
      icone="home"
      titulo="Instalar o app"
      descricao="Abra o Bovaro como um aplicativo, até sem internet."
    >
      <div className="panel">
        <div className="bd">
          <p style={{ margin: 0, color: 'var(--tinta-2)', fontSize: 14, lineHeight: 1.5 }}>
            O app abre em janela própria e continua calculando e guardando seus lançamentos sem
            sinal. O que você lançar sem internet sobe quando a conexão voltar.
          </p>
        </div>
        <div className="ft">
          <span className="hint">Funciona no Chrome, Edge e, no iPhone, pelo Safari.</span>
          <InstalarApp />
        </div>
      </div>
    </Secao>
  );
}

function ContaAutenticada({ usuario, fazenda }: { usuario: UsuarioDto; fazenda: FazendaDto }) {
  const [saindo, setSaindo] = useState(false);
  const [apagando, setApagando] = useState(false);
  const [sairFalhou, setSairFalhou] = useState(false);
  const retornoGoogle = useRetornoGoogle();
  const nome = usuario.nome?.trim() || 'Produtor';
  const resumoFazenda = [
    fazenda.nome,
    fazenda.areaHa === null ? '' : `${paraCampo(fazenda.areaHa)} ha`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <PageHeader titulo="Conta" sub="Gerencie seus dados, acesso e fazenda." />

      <section className="hero" aria-label="Minha conta">
        <div className="phero">
          <div className="avatar" aria-hidden="true">
            {iniciais(nome)}
          </div>
          <div className="who">
            <div className="th">Minha conta</div>
            <h2>{nome}</h2>
            <p>{usuario.email}</p>
            <div className="chips2">
              {resumoFazenda && (
                <span className="c2">
                  <i />
                  {resumoFazenda}
                </span>
              )}
              {usuario.temSenha && (
                <span className="c2 ok">
                  <i />
                  Senha definida
                </span>
              )}
              {usuario.googleVinculado && (
                <span className="c2 ok">
                  <i />
                  Google vinculado
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              setSairFalhou(false);
              setSaindo(true);
            }}
          >
            Sair da conta
          </button>
        </div>
      </section>

      {sairFalhou && (
        <div className="note erro" role="alert" style={{ marginTop: 14 }}>
          {MSG.sairFalhou}
        </div>
      )}

      {retornoGoogle.erro && (
        <div
          ref={retornoGoogle.alertaRef}
          tabIndex={-1}
          className="note erro"
          role="alert"
          style={{ marginTop: 14 }}
        >
          {retornoGoogle.erro}
        </div>
      )}

      <div style={{ marginTop: 6 }}>
        <Secao icone="user" titulo="Perfil" descricao="Seu nome e o e-mail de acesso.">
          <PerfilSecao usuario={usuario} />
        </Secao>
        <Secao
          icone="lock"
          titulo="Senha"
          descricao="Mantenha sua conta protegida com uma senha só sua."
        >
          <SenhaSecao temSenha={usuario.temSenha} />
        </Secao>
        <Secao
          icone="swap"
          titulo="Entrar com Google"
          descricao="Vincule para entrar com um toque."
        >
          <GoogleSecao vinculado={usuario.googleVinculado} />
        </Secao>
        <Secao icone="home" titulo="Fazenda" descricao="Dados usados nos seus cálculos.">
          <FazendaSecao fazenda={fazenda} />
        </Secao>
        <Secao
          icone="swap"
          titulo="Sincronização"
          descricao="O que já subiu para a nuvem e o que precisa da sua decisão."
        >
          <SincronizacaoPainel />
        </Secao>
        <InstalarSecao />
        <Secao
          icone="baixar"
          titulo="Meus dados"
          descricao="Leve uma cópia de tudo o que está na sua conta."
        >
          <MeusDadosSecao email={usuario.email} />
        </Secao>
        <Secao
          icone="lock"
          titulo="Termos e privacidade"
          descricao="A versão dos termos que você aceitou e como retirar o consentimento."
        >
          <TermosSecao usuario={usuario} onRevogar={() => setApagando(true)} />
        </Secao>
        <Secao icone="trash" titulo="Zona de perigo" descricao="Ações sem volta." perigo>
          <div className="panel danger">
            <div className="bd">
              <div>
                <b>Apagar minha conta</b>
                <p
                  style={{
                    margin: '4px 0 0',
                    color: 'var(--tinta-2)',
                    fontSize: 14,
                    lineHeight: 1.5,
                  }}
                >
                  Seus dados, a fazenda, os lotes e os cenários serão removidos de forma permanente.
                </p>
              </div>
            </div>
            <div className="ft">
              <span className="hint">Você precisará escrever “deletar” para confirmar.</span>
              <button type="button" className="btn danger sm" onClick={() => setApagando(true)}>
                Apagar conta
              </button>
            </div>
          </div>
        </Secao>
      </div>

      {saindo && (
        <SairDialog onClose={() => setSaindo(false)} onFalha={() => setSairFalhou(true)} />
      )}
      {apagando && <ApagarDialog onClose={() => setApagando(false)} />}
    </>
  );
}

export function ContaScreen() {
  const sessao = useSessionState();

  if (sessao.status === 'verificando') {
    return (
      <>
        <PageHeader titulo="Conta" />
        <Carregando />
      </>
    );
  }

  if (sessao.status === 'autenticado') {
    return <ContaAutenticada usuario={sessao.usuario} fazenda={sessao.fazenda} />;
  }

  return (
    <>
      <PageHeader titulo="Conta" sub="Gerencie seus dados, acesso e fazenda." />
      {(sessao.status === 'anonimo' || sessao.status === 'expirada') && (
        <section className="card" aria-label="Entrar ou criar conta">
          <h2>Guarde seus dados na nuvem</h2>
          <p style={{ margin: '0 0 16px', color: 'var(--tinta-2)', lineHeight: 1.5 }}>
            Entre ou crie uma conta para guardar seus lotes e cenários na nuvem e usá-los em outros
            aparelhos. Sem conta, tudo continua salvo neste navegador.
          </p>
          <div className="top-actions">
            <Link href="/entrar" className="btn">
              Entrar
            </Link>
            <Link href="/cadastrar" className="btn sec">
              Criar conta
            </Link>
          </div>
        </section>
      )}
      {sessao.status === 'offline-nao-verificado' && (
        <div className="note" role="status">
          Você está sem internet. Para ver e alterar os dados da conta é preciso internet. Pode
          continuar usando o resto: tudo fica salvo neste aparelho.
        </div>
      )}
      <InstalarSecao />
    </>
  );
}
