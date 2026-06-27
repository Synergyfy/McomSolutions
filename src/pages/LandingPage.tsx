import ProductSuite from '../components/ProductSuite';
import FeatureShowcase from '../components/FeatureShowcase';
import Hero from '../components/Hero';
import BentoGrid from '../components/BentoGrid';
import Testimonials from '../components/Testimonials';
import GlobalNetwork from '../components/GlobalNetwork';
import IntegrationFlow from '../components/IntegrationFlow';
import { motion } from 'motion/react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePricing } from '../context/PricingContext';

export default function LandingPage() {
  const { plans } = usePricing();
  return (
    <main>
      <Hero />

      <ProductSuite />

      <FeatureShowcase />

      <BentoGrid />

      <IntegrationFlow />

      <GlobalNetwork />

      <Testimonials />

      {/* Membership Section */}
      <section className="py-20 md:py-32 bg-gray-50">
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

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            {plans.map((plan, index) => {
              const isPlatinum = plan.id === 'Platinum';
              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className={`relative p-8 rounded-3xl border transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl ${isPlatinum
                      ? 'bg-brand-dark text-white border-white/10 shadow-2xl'
                      : 'bg-white border-gray-100 shadow-xl'
                    }`}
                >
                  {isPlatinum && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-brand-blue text-white text-xs font-bold rounded-full uppercase tracking-wider shadow-glow">
                      Most Popular
                    </div>
                  )}
                  <div className={`text-sm font-semibold uppercase mb-4 tracking-wider ${isPlatinum ? 'text-gray-400' : 'text-gray-400'}`}>
                    {plan.name}
                  </div>
                  <div className={`text-4xl font-bold mb-2 ${isPlatinum ? 'text-white' : 'text-gray-900'}`}>
                    £{plan.price.Normal}
                    <span className={`text-lg font-normal ${isPlatinum ? 'text-gray-500' : 'text-gray-400'}`}>/mo</span>
                  </div>
                  <p className={`text-sm mb-6 ${isPlatinum ? 'text-gray-400' : 'text-gray-500'}`}>
                    {plan.description}
                  </p>
                  <div className={`h-1.5 w-full rounded-full overflow-hidden mb-6 ${isPlatinum ? 'bg-white/10' : 'bg-blue-50'}`}>
                    <div
                      className={`h-full bg-brand-blue ${isPlatinum ? 'shadow-glow' : ''}`}
                      style={{ width: `${25 + index * 25}%` }}
                    />
                  </div>
                  <ul className="space-y-3 mb-8">
                    {plan.features.slice(0, 3).map((feature, i) => (
                      <li key={i} className={`flex items-center gap-2 text-sm ${isPlatinum ? 'text-gray-300' : 'text-gray-600'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${isPlatinum ? 'bg-brand-blue' : 'bg-brand-blue'}`} />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              );
            })}
          </div>

          {/* Pricing CTA */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <Link to="/pricing" className="bg-brand-blue text-white px-8 sm:px-10 py-4 sm:py-5 rounded-full font-semibold text-base sm:text-lg transition-all shadow-glow active:scale-95 hover:bg-blue-600 flex items-center gap-2">
              View Memberships
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link to="/pricing" className="text-gray-900 px-8 sm:px-10 py-4 sm:py-5 rounded-full font-semibold text-base sm:text-lg hover:bg-gray-100 transition-all flex items-center gap-2 border border-gray-200">
              View Packages
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-16 md:py-24 bg-white border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-[0.3em] mb-16">
            Powering the world's most ambitious brands
          </h3>
          <div className="flex flex-wrap justify-center items-center gap-8 sm:gap-12 md:gap-24 opacity-40 grayscale hover:grayscale-0 transition-all duration-700">
            {['Microsoft', 'Amazon', 'Google', 'Adobe', 'Salesforce', 'Apple', 'Meta'].map(brand => (
              <span key={brand} className="text-lg sm:text-2xl font-bold text-gray-400 tracking-tighter hover:text-brand-blue transition-colors cursor-default">{brand}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 md:py-32 bg-brand-dark relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-mesh opacity-20" />
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <h2 className="text-3xl sm:text-4xl md:text-6xl font-bold text-white mb-6 md:mb-8">Ready to build the future?</h2>
          <p className="text-base sm:text-lg md:text-xl text-gray-400 mb-8 md:mb-12 leading-relaxed">
            Join thousands of enterprises already scaling with 24/7 GBS.
            Start your 14-day free trial today. No credit card required.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <Link to="/getstarted" className="w-full sm:w-auto bg-brand-blue text-white px-10 py-5 rounded-full font-semibold text-xl hover:bg-blue-600 transition-all text-center shadow-glow-lg active:scale-95">
              Get Started Now
            </Link>
            <button className="w-full sm:w-auto bg-white/10 text-white px-10 py-5 rounded-full font-semibold text-xl hover:bg-white/20 transition-all border border-white/10 active:scale-95">
              Contact Sales
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
