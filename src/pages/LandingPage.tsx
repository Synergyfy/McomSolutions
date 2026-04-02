import ProductSuite from '../components/ProductSuite';
import FeatureShowcase from '../components/FeatureShowcase';
import Hero from '../components/Hero';
import BentoGrid from '../components/BentoGrid';
import Testimonials from '../components/Testimonials';
import GlobalNetwork from '../components/GlobalNetwork';
import IntegrationFlow from '../components/IntegrationFlow';
import { motion } from 'motion/react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { usePricing } from '../context/PricingContext';

export default function LandingPage() {
  const { plans } = usePricing();
  const goldPlan = plans.find(p => p.id === 'Gold');
  const platinumPlan = plans.find(p => p.id === 'Platinum');
  return (
    <main>
      <Hero />
      
      <ProductSuite />

      <FeatureShowcase />

      <BentoGrid />

      <IntegrationFlow />

      <GlobalNetwork />
      
      <Testimonials />

      {/* High-End Pricing Preview */}
      <section className="py-32 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="glass rounded-[4rem] p-12 md:p-20 flex flex-col lg:flex-row items-center justify-between gap-12 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-brand-blue/5 blur-[100px] rounded-full -z-10" />
            
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 text-brand-blue text-sm font-semibold mb-6">
                <Sparkles className="w-4 h-4" />
                Enterprise Ready
              </div>
              <h2 className="text-4xl md:text-5xl font-semibold mb-6 leading-tight">Flexible plans for every scale.</h2>
              <p className="text-xl text-gray-600 mb-8">
                From startups to global conglomerates, our pricing scales 
                with your success. No hidden fees, just pure performance.
              </p>
              <div className="flex gap-4">
                <button className="bg-brand-blue text-white px-8 py-4 rounded-full font-semibold transition-all shadow-glow active:scale-95">
                  View Pricing
                </button>
                <button className="text-gray-900 px-8 py-4 rounded-full font-semibold hover:bg-gray-100 transition-all flex items-center gap-2">
                  Talk to Sales <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="w-full lg:w-96 space-y-4">
              <div className="p-6 bg-white rounded-3xl border border-gray-100 shadow-xl">
                <div className="text-sm font-semibold text-gray-400 uppercase mb-4">{goldPlan?.name} Membership</div>
                <div className="text-4xl font-bold mb-2">£{goldPlan?.price.Normal}<span className="text-lg text-gray-400">/mo</span></div>
                <div className="h-1.5 w-full bg-blue-50 rounded-full overflow-hidden">
                  <div className="h-full w-3/4 bg-brand-blue" />
                </div>
              </div>
              <div className="p-6 bg-brand-dark text-white rounded-3xl shadow-2xl">
                <div className="text-sm font-semibold text-gray-400 uppercase mb-4">{platinumPlan?.name} Suite</div>
                <div className="text-4xl font-bold mb-2">£{platinumPlan?.price.Normal}<span className="text-lg text-gray-400">/mo</span></div>
                <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full w-full bg-brand-blue shadow-glow" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-24 bg-white border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-[0.3em] mb-16">
            Powering the world's most ambitious brands
          </h3>
          <div className="flex flex-wrap justify-center items-center gap-12 md:gap-24 opacity-40 grayscale hover:grayscale-0 transition-all duration-700">
            {['Microsoft', 'Amazon', 'Google', 'Adobe', 'Salesforce', 'Apple', 'Meta'].map(brand => (
              <span key={brand} className="text-2xl font-bold text-gray-400 tracking-tighter hover:text-brand-blue transition-colors cursor-default">{brand}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32 bg-brand-dark relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-mesh opacity-20" />
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <h2 className="text-4xl md:text-6xl font-bold text-white mb-8">Ready to build the future?</h2>
          <p className="text-xl text-gray-400 mb-12 leading-relaxed">
            Join thousands of enterprises already scaling with 24/7 GBS. 
            Start your 14-day free trial today. No credit card required.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <button className="w-full sm:w-auto bg-brand-blue text-white px-10 py-5 rounded-full font-semibold text-xl hover:bg-blue-600 transition-all shadow-glow-lg active:scale-95">
              Get Started Now
            </button>
            <button className="w-full sm:w-auto bg-white/10 text-white px-10 py-5 rounded-full font-semibold text-xl hover:bg-white/20 transition-all border border-white/10 active:scale-95">
              Contact Sales
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
