import ProductSuite from '../components/ProductSuite';
import FeatureShowcase from '../components/FeatureShowcase';
import Hero from '../components/Hero';
import BentoGrid from '../components/BentoGrid';
import GlobalNetwork from '../components/GlobalNetwork';
import IntegrationFlow from '../components/IntegrationFlow';
import { motion } from 'motion/react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePricing } from '../context/PricingContext';

const FALLBACK_MEMBERSHIP_PLANS = [
  {
    id: 'Bronze',
    name: 'Bronze',
    description: 'Perfect for local brands and new startups.',
    price: 10,
    monthlyPrice: 10,
    features: ['Basic Dashboard', 'Local Directory Listing', 'Ecosystem Access'],
  },
  {
    id: 'Silver',
    name: 'Silver',
    description: 'Advanced tools for growing teams.',
    price: 75,
    monthlyPrice: 75,
    features: ['Standard Dashboard', 'Campaign Priority', 'Multi-Territory'],
  },
  {
    id: 'Gold',
    name: 'Gold',
    description: 'Scale your operations with priority access.',
    price: 350,
    monthlyPrice: 350,
    features: ['Full Dashboard', 'Cross-Platform Priority', 'AI Business Copilot'],
  },
];

export default function LandingPage() {
  const { plans } = usePricing();
  const membershipPlans = plans.length > 0 ? plans.slice(0, 3) : FALLBACK_MEMBERSHIP_PLANS;
  return (
    <main className="landing-page w-full max-w-full overflow-x-hidden">
      <Hero />

      <ProductSuite />

      <FeatureShowcase />

      <BentoGrid />

      <IntegrationFlow />

      <GlobalNetwork />

      {/* Membership Section */}
      <section className="py-20 md:py-32 bg-gray-50 overflow-hidden section-visibility-auto">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 text-brand-blue text-sm font-semibold mb-6">
              <Sparkles className="w-4 h-4" />
              Membership Tiers
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold mb-4 md:mb-6 leading-tight">
              Flexible plans for every scale.
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-gray-600 max-w-2xl mx-auto">
              From startups to global conglomerates, our membership tiers scale
              with your success. No hidden fees, just pure performance.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
            {membershipPlans.map((plan, index) => {
              const monthlyPrice = Number(plan.monthlyPrice ?? plan.price);
              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="relative rounded-3xl border border-slate-100 bg-white p-8 shadow-xl transition-all duration-300 hover:-translate-y-2 hover:border-orange-200 hover:shadow-2xl"
                >
                  <div className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-500">
                    {plan.name}
                  </div>
                  <div className="mb-2 text-4xl font-bold text-slate-950">
                    {Number.isFinite(monthlyPrice) && monthlyPrice > 0 ? `£${monthlyPrice}` : 'Contact us'}
                    {Number.isFinite(monthlyPrice) && monthlyPrice > 0 && <span className="text-lg font-normal text-slate-400">/mo</span>}
                  </div>
                  <p className="mb-6 min-h-10 text-sm text-slate-600">
                    {plan.description || 'Membership benefits for your growing business.'}
                  </p>
                  <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-orange-50">
                    <div
                      className="h-full bg-orange-500"
                      style={{ width: `${38 + index * 26}%` }}
                    />
                  </div>
                  <ul className="space-y-3 mb-8">
                    {(plan.features.length > 0 ? plan.features : ['Business dashboard', 'Ecosystem access', 'Growth tools']).slice(0, 3).map((feature, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-slate-700">
                        <div className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              );
            })}
          </div>

          {/* Pricing CTA */}
          <div className="flex items-center justify-center">
            <Link to="/getstarted/business?entry=signup" className="bg-brand-blue text-white px-8 sm:px-10 py-4 sm:py-5 rounded-full font-semibold text-base sm:text-lg transition-all shadow-glow active:scale-95 hover:bg-blue-600 flex items-center gap-2">
              Sign up to choose a tier
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-10 md:py-16 bg-white relative overflow-hidden section-visibility-auto">
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <h2 className="text-3xl sm:text-4xl md:text-6xl font-bold text-gray-900 mb-3 md:mb-4">Ready to build the future?</h2>
          <p className="text-base sm:text-lg md:text-xl text-gray-600 mb-5 md:mb-6 leading-relaxed">
            Join thousands of enterprises already scaling with 24/7 GBS.
            Start your 14-day free trial today. No credit card required.
          </p>
          <div className="flex flex-col items-center justify-center gap-3">
            <Link to="/getstarted/business?entry=signup" className="w-full sm:w-auto bg-brand-blue text-white px-10 py-4 rounded-full font-semibold text-lg hover:bg-blue-600 transition-all text-center shadow-glow-lg active:scale-95">
              Get Started Now
            </Link>
            <button className="w-full sm:w-auto px-8 py-2 font-semibold text-gray-600 hover:text-gray-900 transition-colors active:scale-95">
              Contact Sales
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
