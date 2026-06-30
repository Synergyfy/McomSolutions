import React from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { PRODUCTS } from '../constants';
import { CheckCircle2, ArrowLeft, ExternalLink, Sparkles, ArrowRight, Layers, Zap, Shield } from 'lucide-react';
import { cn } from '../lib/utils';

export default function ProductDetail() {
  const { id } = useParams();
  const product = PRODUCTS.find(p => p.id === id);
  const relatedProducts = PRODUCTS.filter(p => p.id !== id).slice(0, 3);

  if (!product) return <Navigate to="/" />;

  return (
    <div className="pt-32 pb-24 bg-mesh">
      <div className="max-w-7xl mx-auto px-6">
        <Link to="/" className="inline-flex items-center gap-2 text-gray-500 hover:text-brand-blue transition-colors mb-12 group font-bold">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back to Ecosystem
        </Link>

        {/* Hero Section */}
        <div className="grid lg:grid-cols-2 gap-20 items-center mb-32">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <div className={cn(
              "w-20 h-20 rounded-3xl flex items-center justify-center text-white mb-8 shadow-glow-lg",
              product.color
            )}>
              <product.icon className="w-10 h-10" />
            </div>
            
            <h1 className="text-6xl font-bold text-gray-900 mb-6 leading-tight tracking-tight">
              {product.name}
            </h1>
            <p className="text-2xl text-brand-blue font-bold mb-8">
              {product.tagline}
            </p>
            <p className="text-xl text-gray-600 leading-relaxed mb-12 font-medium">
              {product.description}
            </p>

            <div className="flex flex-wrap gap-6">
              <button className="bg-brand-blue text-white px-10 py-5 rounded-full font-bold text-lg hover:bg-blue-600 transition-all shadow-glow-lg flex items-center gap-3 active:scale-95">
                Launch {product.name.split(' ').pop()}
                <ExternalLink className="w-5 h-5" />
              </button>
              <button className="bg-white text-gray-900 px-10 py-5 rounded-full font-bold text-lg border border-gray-200 hover:bg-gray-50 transition-all active:scale-95">
                Request Demo
              </button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative"
          >
            <div className="aspect-square glass rounded-[4rem] p-12 flex items-center justify-center relative overflow-hidden shadow-2xl">
              <div className={cn("absolute inset-0 opacity-10", product.color)} />
              <product.icon className={cn("w-64 h-64 opacity-10", product.color.replace('bg-', 'text-'))} />
              
              {/* High-Fidelity Mockup UI */}
              <div className="absolute inset-12 bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 p-8 flex flex-col gap-6 overflow-hidden">
                <div className="flex items-center justify-between">
                  <div className="h-10 w-40 bg-gray-100 rounded-xl" />
                  <div className="w-10 h-10 bg-gray-50 rounded-full" />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="h-32 bg-blue-50 rounded-2xl border border-blue-100 p-4">
                    <div className="w-8 h-8 bg-brand-blue/20 rounded-lg mb-3" />
                    <div className="h-3 w-2/3 bg-brand-blue/20 rounded" />
                  </div>
                  <div className="h-32 bg-gray-50 rounded-2xl border border-gray-100 p-4">
                    <div className="w-8 h-8 bg-gray-200 rounded-lg mb-3" />
                    <div className="h-3 w-2/3 bg-gray-200 rounded" />
                  </div>
                </div>
                <div className="flex-1 bg-gray-50 rounded-2xl p-6 space-y-4">
                  <div className="h-4 w-full bg-gray-200 rounded" />
                  <div className="h-4 w-5/6 bg-gray-200 rounded" />
                  <div className="h-4 w-4/6 bg-gray-200 rounded" />
                  <div className="h-4 w-full bg-gray-200 rounded" />
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* How it Works Section */}
        <section className="mb-32">
          <div className="text-center mb-20">
            <h2 className="text-4xl font-bold mb-4">How it Works</h2>
            <p className="text-gray-500 text-lg">Three simple steps to enterprise excellence.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-12">
            <StepCard 
              number="01" 
              icon={Layers} 
              title="Integrate" 
              desc="Connect your existing data sources via McomQ Link in minutes." 
            />
            <StepCard 
              number="02" 
              icon={Zap} 
              title="Automate" 
              desc="Let our AI engine handle compliance, rewards, and auditing." 
            />
            <StepCard 
              number="03" 
              icon={Shield} 
              title="Scale" 
              desc="Monitor growth across all regions from your unified dashboard." 
            />
          </div>
        </section>

        {/* Features & Use Cases */}
        <div className="grid lg:grid-cols-2 gap-12 mb-32">
          <div className="glass rounded-[3rem] p-12 shadow-xl">
            <h3 className="text-3xl font-bold mb-10 flex items-center gap-4">
              <Sparkles className="text-brand-blue w-8 h-8" />
              Advanced Capabilities
            </h3>
            <div className="grid gap-8">
              {product.features.map((feature, i) => (
                <div key={i} className="flex items-start gap-5 group">
                  <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center shrink-0 group-hover:bg-green-500 transition-colors">
                    <CheckCircle2 className="w-5 h-5 text-green-500 group-hover:text-white transition-colors" />
                  </div>
                  <span className="text-xl text-gray-700 font-medium">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass rounded-[3rem] p-12 shadow-xl">
            <h3 className="text-3xl font-bold mb-10">Industry Use Cases</h3>
            <div className="grid gap-6">
              {product.useCases.map((useCase, i) => (
                <div key={i} className="p-6 bg-gray-50 rounded-[2rem] border border-gray-100 font-bold text-xl text-gray-700 hover:bg-white hover:shadow-lg transition-all cursor-default">
                  {useCase}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Related Products */}
        <section>
          <h3 className="text-3xl font-bold mb-12 text-center">Explore More Solutions</h3>
          <div className="grid md:grid-cols-3 gap-8">
            {relatedProducts.map((p, i) => (
              <Link key={p.id} to={`/product/${p.id}`} className="glass p-8 rounded-[2.5rem] hover:shadow-2xl transition-all group">
                <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-white mb-6 shadow-lg", p.color)}>
                  <p.icon className="w-6 h-6" />
                </div>
                <h4 className="text-xl font-bold mb-2 group-hover:text-brand-blue transition-colors">{p.name}</h4>
                <p className="text-gray-500 text-sm mb-6">{p.tagline}</p>
                <div className="flex items-center gap-2 text-brand-blue font-bold text-sm">
                  View Details <ArrowRight className="w-4 h-4" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function StepCard({ number, icon: Icon, title, desc }: any) {
  return (
    <div className="relative p-10 glass rounded-[2.5rem] border-transparent hover:border-brand-blue/20 transition-all group">
      <div className="text-6xl font-black text-gray-100 absolute top-6 right-10 group-hover:text-brand-blue/10 transition-colors">{number}</div>
      <div className="w-16 h-16 bg-blue-50 text-brand-blue rounded-2xl flex items-center justify-center mb-8 shadow-sm group-hover:scale-110 transition-transform">
        <Icon className="w-8 h-8" />
      </div>
      <h4 className="text-2xl font-bold mb-4">{title}</h4>
      <p className="text-gray-500 leading-relaxed">{desc}</p>
    </div>
  );
}
