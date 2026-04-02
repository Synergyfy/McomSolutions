import React from 'react';
import { motion } from 'motion/react';
import { Check } from 'lucide-react';
import { cn } from '../lib/utils';

export default function PricingPage() {
  return (
    <div className="pt-32 pb-24">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-20">
          <h1 className="text-5xl font-bold mb-6">Simple, Transparent Pricing</h1>
          <p className="text-xl text-gray-600">Choose the plan that's right for your business scale.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <PricingCard 
            title="Starter"
            price="49"
            description="Perfect for small teams and startups."
            features={['Up to 5 users', 'Basic GBS Loyalty', 'Standard Support', 'Core Analytics']}
          />
          <PricingCard 
            title="Professional"
            price="199"
            description="Advanced tools for growing enterprises."
            features={['Up to 50 users', 'All GBS Tools included', 'Priority Support', 'Advanced AI Insights', 'Custom Integrations']}
            featured
          />
          <PricingCard 
            title="Enterprise"
            price="Custom"
            description="Tailored solutions for global organizations."
            features={['Unlimited users', 'Full Ecosystem access', 'Dedicated Account Manager', 'SLA Guarantees', 'On-premise options']}
          />
        </div>
      </div>
    </div>
  );
}

function PricingCard({ title, price, description, features, featured = false }: any) {
  return (
    <div className={cn(
      "p-10 rounded-[2.5rem] flex flex-col transition-all duration-500",
      featured ? "bg-brand-blue text-white shadow-2xl shadow-blue-500/30 scale-105 z-10" : "glass text-gray-900"
    )}>
      <h3 className="text-2xl font-bold mb-2">{title}</h3>
      <p className={cn("mb-8", featured ? "text-blue-100" : "text-gray-500")}>{description}</p>
      
      <div className="mb-8">
        <span className="text-5xl font-bold">{price === 'Custom' ? price : `£${price}`}</span>
        {price !== 'Custom' && <span className={cn("text-lg", featured ? "text-blue-200" : "text-gray-400")}>/mo</span>}
      </div>

      <div className="space-y-4 mb-10 flex-1">
        {features.map((f: string, i: number) => (
          <div key={i} className="flex items-center gap-3">
            <div className={cn("w-5 h-5 rounded-full flex items-center justify-center", featured ? "bg-white/20" : "bg-blue-50")}>
              <Check className={cn("w-3 h-3", featured ? "text-white" : "text-brand-blue")} />
            </div>
            <span className="font-medium">{f}</span>
          </div>
        ))}
      </div>

      <button className={cn(
        "w-full py-4 rounded-full font-bold text-lg transition-all active:scale-95",
        featured ? "bg-white text-brand-blue hover:bg-blue-50" : "bg-brand-blue text-white hover:bg-blue-600"
      )}>
        {price === 'Custom' ? 'Contact Sales' : 'Get Started'}
      </button>
    </div>
  );
}
