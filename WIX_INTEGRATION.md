# Integração Orbita com Wix - Guia Completo

## 📋 Visão Geral

Este guia descreve como integrar o Orbita (aplicação de gerenciamento de projetos com Google Calendar) ao seu site Wix da LS Solutions.

**URL do Orbita**: `https://orbita.manus.space`

## 🔐 Autenticação

### Google OAuth

O Orbita usa autenticação Google OAuth 2.0. Os usuários podem fazer login com suas contas Google.

**Credenciais já configuradas:**
- Client ID: `793961394576-ee921sl384qosh6qjgjb0kcib7m3ljad.apps.googleusercontent.com`
- Redirect URI: `https://orbita.manus.space/api/oauth/callback`

### SSO com Wix

Para integrar SSO entre Wix e Orbita:

1. Crie um script personalizado no Wix que capture o usuário logado
2. Passe o token de autenticação para o Orbita via iframe ou redirect
3. Configure webhook para sincronizar usuários entre plataformas

## 🛒 Integração de Vendas

### Opção 1: Iframe Embed (Recomendado)

Adicione um elemento HTML personalizado no Wix:

```html
<iframe 
  src="https://orbita.manus.space/planos" 
  width="100%" 
  height="1200"
  style="border: none; border-radius: 8px;"
  allow="payment"
></iframe>
```

**Vantagens:**
- Sem sair do seu site
- Mantém branding do Wix
- Integração simples

**Desvantagens:**
- Pode ter limitações de responsividade
- Cookies podem não sincronizar

### Opção 2: Link Direto

Adicione um botão no Wix que redireciona para:

```
https://orbita.manus.space/planos
```

**Vantagens:**
- Experiência nativa do Orbita
- Sem limitações técnicas
- Melhor performance

**Desvantagens:**
- Sai do seu site Wix
- Precisa de volta (link "Voltar ao Wix")

### Opção 3: Popup Modal

Use um modal do Wix para abrir o Orbita:

```javascript
// No Wix Code
$w("#button1").onClick(() => {
  $w("#modal1").openModal();
  // Carregar iframe dentro do modal
});
```

## 💳 Fluxo de Checkout

### Passo 1: Usuário Seleciona Plano

1. Acessa `/planos` no Orbita
2. Clica em "Começar agora" em um plano
3. Seleciona ciclo de faturamento (mensal/anual)

### Passo 2: Checkout Stripe

1. Redirecionado para Stripe Checkout
2. Insere dados do cartão
3. Completa pagamento

### Passo 3: Confirmação

1. Assinatura criada no banco de dados
2. Webhook notifica Wix (opcional)
3. Usuário redirecionado para `/dashboard?checkout=success`

## 📊 Planos de Preço

| Plano | Mensal | Anual | Usuários | Projetos |
|-------|--------|-------|----------|----------|
| Starter | R$29 | R$290 | 3 | 5 |
| Basic | R$59 | R$590 | 10 | 20 |
| Pro | R$89 | R$890 | Ilimitado | Ilimitado |

**Todos incluem:**
- Calendário integrado
- Google Calendar sincronizado
- 15 dias de trial gratuito

## 🔗 URLs Importantes

| Página | URL |
|--------|-----|
| Home | `https://orbita.manus.space/` |
| Planos | `https://orbita.manus.space/planos` |
| Dashboard | `https://orbita.manus.space/dashboard` |
| Assinatura | `https://orbita.manus.space/assinatura` |
| Calendário | `https://orbita.manus.space/calendar` |
| Google Calendar | `https://orbita.manus.space/calendar` (botão conectar) |

## 🔔 Webhooks

### Configurar Webhook no Orbita

Quando uma assinatura é criada/alterada/cancelada, o Orbita pode notificar seu Wix:

**Endpoint**: `https://seu-site-wix.com/webhook/orbita`

**Eventos:**
- `subscription.created` - Assinatura criada
- `subscription.updated` - Assinatura atualizada
- `subscription.canceled` - Assinatura cancelada

**Payload:**
```json
{
  "event": "subscription.created",
  "userId": 123,
  "planId": 1,
  "planName": "Pro",
  "billingCycle": "monthly",
  "status": "active",
  "timestamp": "2026-08-01T10:00:00Z"
}
```

## 📱 Responsividade

O Orbita é totalmente responsivo e funciona em:
- ✅ Desktop (1920px+)
- ✅ Tablet (768px - 1024px)
- ✅ Mobile (320px - 767px)

## 🎨 Branding

### Cores LS Solutions

O Orbita usa as cores da LS Solutions:
- **Amarelo**: `#FFC30D` (destaque)
- **Preto**: `#000000` (texto principal)
- **Verde**: `#00AA00` (sucesso)

### Customização

Para customizar cores/logo, entre em contato com o time de desenvolvimento.

## 🔐 Segurança

### Dados Sensíveis

- ✅ Senhas hasheadas com bcrypt
- ✅ Tokens JWT com expiração
- ✅ HTTPS obrigatório
- ✅ CORS configurado apenas para domínios autorizados

### Compliance

- ✅ LGPD (Lei Geral de Proteção de Dados)
- ✅ Política de Privacidade incluída
- ✅ Termos de Serviço disponíveis

## 🚀 Deploy

O Orbita está hospedado em:
- **Plataforma**: Manus Cloud
- **Domínio**: `orbita.manus.space`
- **SSL**: Automático (Let's Encrypt)
- **Uptime**: 99.9%

## 📞 Suporte

Para dúvidas ou problemas:

1. **Email**: support@lssolutions.com.br
2. **Chat**: Disponível no Orbita
3. **Documentação**: `https://orbita.manus.space/manual`

## ✅ Checklist de Implementação

- [ ] Copiar URL do Orbita
- [ ] Adicionar link/iframe no Wix
- [ ] Testar fluxo de checkout
- [ ] Configurar webhook (opcional)
- [ ] Treinar usuários
- [ ] Monitorar conversões
- [ ] Coletar feedback

## 🎯 Próximos Passos

1. **Teste em Produção**: Use cartão 4242 4242 4242 4242
2. **Configurar Webhook**: Notifique seu Wix sobre assinaturas
3. **Analytics**: Acompanhe conversões no Stripe Dashboard
4. **Otimização**: Teste diferentes posicionamentos no Wix

## 📚 Recursos Adicionais

- [Documentação Stripe](https://stripe.com/docs)
- [Documentação Google Calendar API](https://developers.google.com/calendar)
- [Guia de Segurança](./SECURITY.md)
- [Troubleshooting](./TROUBLESHOOTING.md)

---

**Versão**: 1.0  
**Última atualização**: 01/08/2026  
**Responsável**: Time LS Solutions
