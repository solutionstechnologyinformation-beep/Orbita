# Guia de Integração do Orbita no Domínio LSSolutions (Wix)

Este guia orienta o procedimento para disponibilizar o **Orbita** sob o domínio da **LS Solutions** (`www.lssolutions.com.br`), criando um acesso limpo e direto sem exibir referências à Manus na interface dos usuários.

---

## 1. Arquitetura Escolhida

Para preservar a integridade do sistema (sessões, cookies seguros, Google OAuth, banco de dados multi-tenant, mapas e processamento em tempo real), a melhor prática recomendada é o uso de um **subdomínio dedicado**:

* **Domínio Principal:** `https://www.lssolutions.com.br` (Hospedado no Wix)
* **Aplicação Orbita:** `https://app.lssolutions.com.br` (Hospedado na infraestrutura dedicada do Orbita)

Na barra de endereços, o usuário que acessar a aplicação verá `app.lssolutions.com.br`, eliminando qualquer menção à Manus.

---

## 2. Configuração de DNS no Painel do Domínio (Wix / Provedor DNS)

Para vincular o subdomínio à plataforma, acesse o gerenciador de DNS do seu domínio (`lssolutions.com.br`) e adicione os seguintes registros:

| Tipo | Nome / Host | Valor / Destino | Propósito |
|---|---|---|---|
| **CNAME** | `app` | `suplekanban-78v7rjaj.manus.space` | Aponta o subdomínio `app.lssolutions.com.br` para o ambiente do Orbita |
| **TXT** | `_orbita-verification.app` | `orbita-verify-...` *(gerado no painel)* | Validação de propriedade do domínio no painel de administração |

> **Nota:** O certificado SSL e o roteamento de HTTPS são provisionados automaticamente assim que o registro CNAME estiver propagado.

---

## 3. Inclusão do Link no Site Wix

Para que os clientes e equipes acessem o sistema diretamente pelo site principal:

1. Acesse o **Editor do Wix** para o site `www.lssolutions.com.br`.
2. No menu de navegação ou no rodapé, adicione um novo item de menu ou botão com o rótulo **Orbita** (ou **Área de Projetos**).
3. Configure o link para abrir em **Nova aba** (ou na mesma aba) apontando para o endereço exato:
   `https://app.lssolutions.com.br`
4. Publique as alterações no Wix.

---

## 4. Vantagens desta Abordagem

- **Isolamento e Segurança:** Cookies de sessão e tokens OAuth do Google funcionam perfeitamente sem bloqueios de CORS ou restrições de iframe.
- **Transparência de Marca:** A URL exibida ao cliente é inteiramente baseada em `lssolutions.com.br`.
- **Manutenção Simplificada:** Atualizações e correções no Orbita são aplicadas no backend sem necessidade de reinstalar plugins no Wix.
