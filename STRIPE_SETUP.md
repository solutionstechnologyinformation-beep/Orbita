# Configuração do Stripe para Orbita

## Passo 1: Criar Produtos no Stripe

Execute o script para criar os produtos:
```bash
cd /home/ubuntu/suple-clone
npx ts-node server/stripe-products.ts
```

Isso criará 3 produtos com preços mensais e anuais:
- **Starter**: R$29/mês (R$290/ano)
- **Basic**: R$59/mês (R$590/ano)  
- **Pro**: R$89/mês (R$890/ano)

Copie os IDs dos produtos e preços retornados.

## Passo 2: Inserir IDs no Banco de Dados

Use o SQL abaixo para inserir os planos (substitua os IDs):

```sql
INSERT INTO subscription_plans (name, stripePriceId, stripeProductId, monthlyPrice, annualPrice, maxUsers, maxProjects, features, description, isActive, createdAt, updatedAt) VALUES
('Starter', 'price_XXXXX', 'prod_XXXXX', 2900, 29000, 3, 5, '["Até 3 usuários","Até 5 projetos","Calendário básico","Google Calendar integrado"]', 'Perfeito para começar', TRUE, NOW(), NOW()),
('Basic', 'price_XXXXX', 'prod_XXXXX', 5900, 59000, 10, 20, '["Até 10 usuários","Até 20 projetos","Calendário avançado","Google Calendar sincronizado"]', 'Para equipes em crescimento', TRUE, NOW(), NOW()),
('Pro', 'price_XXXXX', 'prod_XXXXX', 8900, 89000, 999, 999, '["Usuários ilimitados","Projetos ilimitados","Calendário completo","Google Calendar totalmente sincronizado"]', 'Para empresas', TRUE, NOW(), NOW());
```

## Passo 3: Configurar Webhook no Stripe Dashboard

1. Acesse https://dashboard.stripe.com/webhooks
2. Clique em "Add endpoint"
3. URL do endpoint: `https://orbita.manus.space/api/stripe/webhook`
4. Selecione os eventos:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Copie o "Signing secret" e defina em `STRIPE_WEBHOOK_SECRET`

## Passo 4: Testar Fluxo de Checkout

1. Acesse `/planos` no Orbita
2. Clique em "Começar agora" em qualquer plano
3. Você será redirecionado para o Stripe Checkout
4. Use o cartão de teste: `4242 4242 4242 4242`
5. Qualquer data futura e CVC
6. Após pagamento, você será redirecionado para `/dashboard?checkout=success`

## Passo 5: Verificar Assinatura

Acesse `/assinatura` para ver:
- Status da assinatura
- Plano ativo
- Histórico de faturas
- Opção de cancelamento

## Troubleshooting

- **Webhook não recebe eventos**: Verifique se a URL está correta e acessível
- **Erro 401 no webhook**: Confirme que `STRIPE_WEBHOOK_SECRET` está correto
- **Checkout não funciona**: Verifique se `stripePriceId` está correto no banco
- **Erro "Plano não encontrado"**: Confirme que os IDs foram inseridos corretamente no banco

## Integração com Wix

Para integrar o Orbita no seu site Wix:

1. **Iframe Embed**: Adicione um elemento HTML personalizado no Wix com:
```html
<iframe src="https://orbita.manus.space/planos" width="100%" height="800"></iframe>
```

2. **Link Direto**: Adicione um botão que redireciona para:
```
https://orbita.manus.space/planos
```

3. **SSO (Single Sign-On)**: Configure autenticação Google para sincronizar usuários entre Wix e Orbita

4. **Webhook de Notificação**: Configure webhooks para notificar o Wix quando uma assinatura for criada/cancelada
