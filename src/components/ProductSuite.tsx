import React from 'react';
import { motion } from 'motion/react';
import { PRODUCTS } from '../constants';
import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ProductSuite() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16">
          <div className="max-w-2xl">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              One Subscription. <br />
              <span className="text-brand-blue">Unlimited Potential.</span>
            </h2>
            <p className="text-xl text-gray-600">
              The 24/7 GBS umbrella connects your entire business operations 
              under a single, high-performance ecosystem.
            </p>
          </div>
          <Link to="/pricing" className="inline-flex items-center gap-2 text-brand-blue font-bold hover:underline mb-2">
            View all plans <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {PRODUCTS.map((product, index) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 }}
              className="group cursor-pointer"
            >
              <div className="relative aspect-square rounded-3xl p-6 mb-4 bg-gray-50 border border-gray-100 transition-all duration-300 group-hover:bg-white group-hover:shadow-2xl group-hover:shadow-blue-500/10 group-hover:-translate-y-1">
                <div className={`w-full h-full rounded-2xl ${product.color} text-white flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform duration-500`}>
                  <product.icon className="w-10 h-10" />
                </div>
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-8 h-8 rounded-full bg-blue-50 text-brand-blue flex items-center justify-center">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
              <div className="px-2">
                <div className="text-xs font-bold text-brand-blue uppercase mb-1 tracking-wider">{product.type}</div>
                <h3 className="font-bold text-gray-900 group-hover:text-brand-blue transition-colors line-clamp-1">{product.name}</h3>
                <p className="text-xs text-gray-500 line-clamp-1">{product.tagline}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
