/**
 * Stripe Products Configuration
 * 
 * Este arquivo contém a configuração dos produtos e preços no Stripe.
 * Execute este script uma vez para criar os produtos no Stripe:
 * 
 * npx ts-node server/stripe-products.ts
 */

import stripe from "stripe";

const stripeClient = new stripe(process.env.STRIPE_SECRET_KEY || "");

const PLANS = [
  {
    name: "Starter",
    description: "Plano Starter - Perfeito para começar",
    monthlyPrice: 2900, // R$29.00 em centavos
    annualPrice: 29000, // R$290.00 em centavos
    maxUsers: 3,
    maxProjects: 5,
  },
  {
    name: "Basic",
    description: "Plano Basic - Para equipes em crescimento",
    monthlyPrice: 5900, // R$59.00 em centavos
    annualPrice: 59000, // R$590.00 em centavos
    maxUsers: 10,
    maxProjects: 20,
  },
  {
    name: "Pro",
    description: "Plano Pro - Para empresas",
    monthlyPrice: 8900, // R$89.00 em centavos
    annualPrice: 89000, // R$890.00 em centavos
    maxUsers: 999,
    maxProjects: 999,
  },
];

async function createStripeProducts() {
  console.log("🚀 Criando produtos no Stripe...\n");

  for (const plan of PLANS) {
    try {
      // Criar produto
      const product = await stripeClient.products.create({
        name: plan.name,
        description: plan.description,
        metadata: {
          maxUsers: plan.maxUsers.toString(),
          maxProjects: plan.maxProjects.toString(),
        },
      });

      console.log(`✅ Produto criado: ${plan.name} (${product.id})`);

      // Criar preço mensal
      const monthlyPrice = await stripeClient.prices.create({
        product: product.id,
        unit_amount: plan.monthlyPrice,
        currency: "brl",
        recurring: {
          interval: "month",
          interval_count: 1,
          trial_period_days: 15,
        },
        metadata: {
          billingCycle: "monthly",
        },
      });

      console.log(`   └─ Preço mensal: ${monthlyPrice.id}`);

      // Criar preço anual
      const annualPrice = await stripeClient.prices.create({
        product: product.id,
        unit_amount: plan.annualPrice,
        currency: "brl",
        recurring: {
          interval: "year",
          interval_count: 1,
          trial_period_days: 15,
        },
        metadata: {
          billingCycle: "annual",
        },
      });

      console.log(`   └─ Preço anual: ${annualPrice.id}\n`);

      // Salvar no banco de dados (você deve fazer isso manualmente ou via admin)
      console.log(`📝 Salve estas informações no banco de dados:`);
      console.log(`   stripePriceId (mensal): ${monthlyPrice.id}`);
      console.log(`   stripeProductId: ${product.id}`);
      console.log(`   stripePriceId (anual): ${annualPrice.id}\n`);
    } catch (error) {
      console.error(`❌ Erro ao criar produto ${plan.name}:`, error);
    }
  }

  console.log("✨ Produtos criados com sucesso!");
  console.log("\n📌 Próximos passos:");
  console.log("1. Copie os IDs dos produtos e preços acima");
  console.log("2. Insira-os na tabela subscription_plans do banco de dados");
  console.log("3. Use o preço mensal como stripePriceId padrão");
}

// Executar se for chamado diretamente
if (require.main === module) {
  createStripeProducts().catch(console.error);
}

export { createStripeProducts };
