# Política de Privacidade

> **Rascunho.** Este texto deve ser revisado por profissional jurídico antes de qualquer uso comercial.

**Versão 2026-10-20**

**Vigência:** a partir de 20 de outubro de 2026.

Esta Política explica, em linguagem simples, quais dados pessoais o **O Gado** guarda, para que, com quem compartilha e quais são os seus direitos, conforme a Lei Geral de Proteção de Dados (LGPD, Lei 13.709/2018). Ela vale junto com os [Termos de Uso](/termos).

## 1. Quem é o responsável pelos dados

O controlador dos dados é **[IDENTIFICAÇÃO DO CONTROLADOR — preencher]**.

Contato para assuntos de privacidade e para exercer seus direitos: **[E-MAIL DE CONTATO DO CONTROLADOR — preencher]**.

## 2. Quais dados coletamos

**Dados da conta**

- **E-mail**: para identificar você e permitir o login.
- **Nome**: opcional. Você informa em Conta > Perfil. Se entrar com o Google, recebemos o nome da sua conta Google.
- **Senha**: nunca guardamos a senha em si. Guardamos somente um **hash** (uma "impressão digital" irreversível, gerada com o algoritmo argon2id).
- **Identidade Google** (só se você usar o Google): o identificador `sub` do Google, o e-mail e o nome vindos do Google. Não recebemos a sua senha do Google.
- **Aceite dos Termos**: a versão aceita e a data e hora do aceite.
- **Datas de criação e de atualização** da conta.

**Dados da sua fazenda**, que você mesmo cadastra:

- nome e área da fazenda;
- lotes de compra e venda (por exemplo, quantidades, pesos e valores);
- cenários e entradas da recria.

**Dados técnicos**

- **Sessão**: guardamos um identificador de sessão (com o segredo apenas em hash), a data de criação, da última verificação e de expiração.
- **Endereço IP**: é usado **apenas na memória do servidor**, para limitar tentativas em excesso (por exemplo, muitos logins errados). **Não é gravado no banco de dados e não aparece nos nossos registros (logs).** Os logs também não guardam e-mail, senha, cookie nem o conteúdo das requisições.
- **Recuperação de senha**: guardamos um código temporário (somente em hash), com validade de 1 hora e uso único. Pedir um novo link, trocar a senha ou mudar o e-mail invalida os links anteriores; redefinir a senha encerra as sessões anteriores.

**Não coletamos** dados de localização, contatos, câmera, microfone nem dados sensíveis.

## 3. Para que usamos e em que base legal

| Finalidade | Dados | Base legal (LGPD, art. 7º) |
| --- | --- | --- |
| Criar e manter a sua conta, e deixar você entrar | e-mail, nome, hash da senha, identidade Google, sessão | execução do contrato (inciso V) |
| Guardar e calcular os dados da sua fazenda | nome, área, lotes, cenários, recria | execução do contrato (inciso V) |
| Enviar e-mails que você pede (recuperação de senha, cópia dos seus dados) | e-mail e, na cópia dos dados, os dados da sua conta | execução do contrato (inciso V) e atendimento ao seu direito de acesso |
| Proteger o serviço contra abuso e invasão | IP (só em memória), sessões | legítimo interesse (inciso IX), limitado ao necessário |
| Registrar que você leu e aceitou estes documentos | versão e data do aceite | consentimento (inciso I) |

Você pode **revogar o consentimento** a qualquer momento (veja a seção 9). Como o aceite é condição para usar o serviço, revogar equivale a apagar a conta.

**Não vendemos seus dados, não fazemos publicidade e não criamos perfis de comportamento.**

## 4. Com quem compartilhamos (operadores e terceiros)

Usamos empresas que tratam dados em nosso nome, só para o serviço funcionar:

- **Vercel**: hospeda o site (as telas do aplicativo).
- **Railway**: hospeda a API e o banco de dados PostgreSQL, onde ficam os dados da conta e da fazenda. Os servidores ficam nos **Estados Unidos**.
- **Google**: faz o login "Entrar com Google", se você escolher essa opção.
- **Resend**: envia os e-mails do serviço: o de recuperação de senha e, se você pedir em **Conta > Meus dados > Enviar meus dados por e-mail**, a mensagem com a cópia dos seus dados em anexo (arquivo JSON). Ele recebe o seu e-mail e o conteúdo da mensagem, inclusive o anexo.

Não compartilhamos dados com mais ninguém, exceto se a lei ou uma ordem judicial exigir.

### Transferência internacional

Como a API e o banco ficam em servidores nos Estados Unidos, e alguns dos fornecedores acima também operam fora do Brasil, seus dados são **transferidos para fora do país**. Isso é necessário para executar o serviço que você contratou (LGPD, art. 33, inciso IX). Você pode pedir mais informações pelo contato da seção 1.

## 5. Cookies e armazenamento no seu aparelho

- **Cookie de sessão** (essencial): mantém você logado. É HttpOnly (o JavaScript da página não consegue lê-lo), enviado só por conexão segura e restrito ao nosso site. Sem ele não há login.
- **Banco local do navegador (IndexedDB)**: guarda no seu aparelho uma cópia dos seus lotes e cenários salvos, as alterações pendentes, o controle da sincronização e os códigos internos da conta dona desses dados. O simulador de recria não salvo é um rascunho em memória. As gravações são coordenadas entre abas para preservar seus lançamentos. Isso permite usar o app **sem internet**. Na atualização, os dados da versão anterior são transferidos do armazenamento local para esse banco, preservando as alterações ainda não enviadas. A cópia preservada pode incluir rascunhos da versão anterior.
- **Armazenamento local e da aba (localStorage/sessionStorage)**: guardam a identidade da conta (apenas códigos internos) e controles de funcionamento do aplicativo. Não guardamos senha nem segredo de sessão nesses locais ou no IndexedDB.
- **Service worker e cache**: guardam as telas e os arquivos do aplicativo no aparelho para ele abrir offline e poder ser instalado. Não guardam respostas da API com dados da sua conta.
- Ao sair da conta ou apagar a conta, os dados locais do aparelho são removidos.

**Não usamos** cookies de publicidade, rastreadores, pixels nem ferramentas de análise de terceiros.

## 6. Por quanto tempo guardamos

- Seus dados ficam guardados **enquanto a conta existir**.
- Ao **apagar a conta**, removemos de forma definitiva do banco de dados o seu perfil, a identidade Google, a fazenda, os lotes, os cenários, a entrada da recria, as sessões e os códigos de recuperação de senha.
- Podem existir **cópias de segurança (backups)** do banco, feitas por nós. Elas são mantidas em quantidade limitada, em rodízio das mais recentes, e as antigas são substituídas. Por isso, dados apagados podem continuar nessas cópias até serem substituídas.

## 7. Como protegemos

- Senhas guardadas apenas como hash argon2id.
- Conexão criptografada (HTTPS) entre você e o serviço.
- Cookie de sessão HttpOnly, com expiração por inatividade e um teto máximo de duração.
- Cada conta só enxerga os dados da própria fazenda.
- Limite de tentativas de login, de cadastro e de recuperação de senha.
- Registros (logs) sem dados pessoais.

Nenhum sistema é 100% seguro. Se houver um incidente que possa causar risco ou dano relevante a você, avisaremos você e a Autoridade Nacional de Proteção de Dados (ANPD), como a lei exige.

## 8. Menores de idade

O O Gado é para pessoas com **18 anos ou mais**. Não coletamos intencionalmente dados de crianças e adolescentes. Se você acredita que um menor criou uma conta, fale conosco para apagarmos.

## 9. Seus direitos e como exercê-los

Pelo art. 18 da LGPD, você pode, a qualquer momento:

| Direito | Como fazer no O Gado |
| --- | --- |
| Confirmar que tratamos seus dados e **acessar** uma cópia | **Conta > Meus dados > Baixar meus dados** (arquivo JSON) |
| **Portabilidade** | O mesmo arquivo, em formato aberto. Você também pode **receber o arquivo por e-mail** (**Conta > Meus dados > Enviar meus dados por e-mail**, enviado só para o e-mail da sua conta; o envio passa pelo Resend). Há ainda exportação de lotes e cenários em CSV/XLSX |
| **Corrigir** dados | **Conta > Perfil** (nome e e-mail) e **Conta > Fazenda** (nome e área), além de editar lotes e cenários |
| **Eliminar** dados | **Conta > Apagar minha conta** |
| **Revogar o consentimento** | **Conta > Termos e privacidade > Revogar consentimento**, que leva ao fluxo de apagar a conta |
| Saber com quem compartilhamos | Seção 4 desta Política |
| Pedir informações ou **reclamar** | Pelo contato da seção 1. Você também pode reclamar à ANPD (www.gov.br/anpd) |

O download e a exclusão são feitos por você, direto no aplicativo. Para os demais pedidos, escreva para o contato da seção 1.

## 10. Mudanças nesta Política

Quando mudarmos o tratamento dos seus dados, atualizamos esta Política, mudamos a data de versão no topo e pedimos um **novo aceite** na sua próxima entrada.

## 11. Contato e foro

Contato: **[E-MAIL DE CONTATO DO CONTROLADOR — preencher]**.

Esta Política segue as leis do Brasil. O foro é o mesmo descrito nos Termos de Uso.
