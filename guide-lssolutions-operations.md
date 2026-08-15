# Manual Operacional: Subdomínio, Vendas e Gestão Multi-Tenant (LS Solutions / Orbita)

Este manual detalha o passo a passo para configurar o subdomínio no Wix, estruturar a comercialização de assinaturas e gerenciar as empresas clientes de forma isolada na plataforma **Orbita**.

---

## Parte 1 — Configuração do Subdomínio (`app.lssolutions.com.br`) no Wix

Para que o Orbita seja acessado sem exibir referências à Manus na barra de endereços, o recomendado é utilizar o subdomínio dedicado `app.lssolutions.com.br`. Como o Wix gerencia o domínio principal `www.lssolutions.com.br`, o apontamento do subdomínio é realizado diretamente nas configurações de DNS do painel do Wix.

### Passo a passo no Painel do Wix:
1. Acesse o [Painel do Wix](https://www.wix.com) e faça login na sua conta.
2. No menu principal, vá em **Configurações** > **Domínios**.
3. Localize o seu domínio `lssolutions.com.br` e clique nos três pontos (`...`) ao lado dele, selecionando **Gerenciar DNS** (ou **Configurações avançadas de DNS**).
4. Na seção de **Registros CNAME (Aliases)**, clique em **Adicionar Registro**.
5. Preencha os campos com os seguintes dados:
   - **Host / Nome:** `app`
   - **Valor / Aponta para:** `suplekanban-78v7rjaj.manus.space`
   - **TTL:** Automático (ou 1 hora)
6. Clique em **Salvar**.
7. Na página de administração do Orbita, adicione o domínio personalizado `app.lssolutions.com.br` para que o sistema valide a propriedade e emita automaticamente o certificado SSL seguro (HTTPS).

### Inclusão do Link no Site Principal:
1. Abra o **Editor do Wix** para o site `www.lssolutions.com.br`.
2. Adicione um novo botão ou item de menu rotulado como **"Acessar Sistema"** ou **"Orbita"**.
3. Configure o link para abrir em **Nova aba** apontando para `https://app.lssolutions.com.br`.
4. Publique as alterações no Wix.

---

## Parte 2 — Integração do Processo de Venda de Planos

A comercialização do Orbita pode ser centralizada no site institucional da LS Solutions no Wix, enquanto o gerenciamento técnico do acesso e dos dados dos clientes ocorre no painel do Orbita.

### Estrutura de Planos Recomendada:
| Plano | Valor Mensal Sugerido | Limites Operacionais | Recursos Inclusos |
|---|---|---|---|
| **Starter** | R$ 29 / mês | Até 5 usuários / 10 projetos | Kanban, Tarefas, Chat IA, Relatórios básicos |
| **Basic** | R$ 59 / mês | Até 15 usuários / 30 projetos | Tudo do Starter + Gantt, Sprints e Calendário |
| **Pro** | R$ 89 / mês | Usuários e projetos ilimitados | Acesso total + Suporte prioritário e Multi-tenant |

* **Trial Gratuito:** Todos os planos contam nativamente com **15 dias de teste gratuito** configuráveis no sistema.

### Fluxo de Venda e Assinatura:
1. **Vitrine no Wix:** O usuário acessa `www.lssolutions.com.br/planos`, visualiza as opções Starter, Basic e Pro e clica em "Contratar".
2. **Checkout e Pagamento:** O botão de compra do Wix direciona o cliente para o checkout seguro (Stripe ou gateway integrado).
3. **Provisionamento de Acesso:** 
   - Após a confirmação do pagamento ou início do trial, o sistema gera o acesso inicial para o administrador da empresa adquirente.
   - O cliente recebe por e-mail as credenciais temporárias para acessar `app.lssolutions.com.br`.

---

## Parte 3 — Gerenciamento das Empresas Adquirentes (Multi-Tenant)

O Orbita foi estruturado com uma arquitetura **multi-tenant estrita**, garantindo que cada empresa cliente possua um ambiente completamente isolado de dados, usuários e configurações.

### Como Gerenciar Empresas Clientes:
1. **Painel Master (Administrador Geral):**
   - Como proprietário da plataforma, você acessa o painel administrativo master em `app.lssolutions.com.br`.
   - Na aba **Empresas**, você pode cadastrar manualmente ou via webhook novas empresas adquirentes (ex: *Construtora ABC Ltda*, *Engenharia XYZ*).
   
2. **Atribuição de Administrador de Empresa (`company_admin`):**
   - Para cada nova empresa criada, você define um usuário responsável com o papel de Administrador da Empresa.
   - Esse administrador gerencia exclusivamente os usuários, equipes e projetos do seu próprio tenant, sem acesso aos dados de outras empresas.

3. **Ciclo de Vida da Assinatura:**
   - O painel exibe o status da assinatura de cada empresa (Ativa, Em Trial de 15 dias, Inadimplente ou Cancelada).
   - Caso uma assinatura expire ou seja cancelada, o acesso do tenant é pausado automaticamente até a regularização do pagamento.
