import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { Product } from '../constants';
import { cn } from '../lib/utils';

interface ProductCardProps {
  product: Product;
  index: number;
}

export default function ProductCard({ product, index }: ProductCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1 }}
      className="group relative"
    >
      <Link to={`/product/${product.id}`} className="block">
        <div className="relative h-full glass rounded-[2rem] p-8 transition-all duration-500 hover:shadow-2xl hover:shadow-blue-500/10 hover:-translate-y-2 border-transparent hover:border-brand-blue/20">
          <div className={cn(
            "w-16 h-16 rounded-2xl flex items-center justify-center text-white mb-8 transition-transform duration-500 group-hover:scale-110 shadow-lg",
            product.color
          )}>
            <product.icon className="w-8 h-8" />
          </div>
          
          <div className="mb-4">
            <span className="text-xs font-bold text-brand-blue uppercase tracking-widest mb-2 block">
              {product.type === 'GBS' ? 'Core GBS Tool' : 'Mcom Solution'}
            </span>
            <h3 className="text-2xl font-bold text-gray-900 group-hover:text-brand-blue transition-colors">
              {product.name}
            </h3>
          </div>
          
          <p className="text-gray-600 mb-8 line-clamp-2 leading-relaxed">
            {product.tagline}
          </p>
          
          <div className="flex items-center gap-2 text-brand-blue font-bold group-hover:gap-3 transition-all">
            Learn More <ArrowRight className="w-4 h-4" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
