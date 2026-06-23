import React from 'react';
import { motion } from 'motion/react';
import { KeyRound, UserCircle, Building2, CreditCard, Waypoints, Crown } from 'lucide-react';

const BENEFITS = [
  {
    icon: KeyRound,
    title: 'Single Sign-On',
    description: 'One set of credentials unlocks every platform in the MCOM ecosystem. No more juggling passwords across services.',
    color: 'bg-blue-500',
    accent: 'bg-blue-50 text-blue-600',
    span: 'md:col-span-2',
  },
  {
    icon: UserCircle,
    title: 'One Account',
    description: 'Your identity travels with you. A single account manages all your activity, preferences, and history.',
    color: 'bg-indigo-500',
    accent: 'bg-indigo-50 text-indigo-600',
    span: 'md:col-span-1',
  },
  {
    icon: Building2,
    title: 'One Business Profile',
    description: 'Maintain a single, verified business profile that powers your presence across every MCOM platform.',
    color: 'bg-cyan-500',
    accent: 'bg-cyan-50 text-cyan-600',
    span: 'md:col-span-1',
  },
  {
    icon: Crown,
    title: 'One Membership',
    description: 'Choose a membership tier that covers your access level across the entire ecosystem — no per-platform fees.',
    color: 'bg-amber-500',
    accent: 'bg-amber-50 text-amber-600',
    span: 'md:col-span-1',
  },
  {
    icon: CreditCard,
    title: 'One Payment System',
    description: 'Billing, invoices, and payment methods centralized in one place. Transparent and straightforward.',
    color: 'bg-emerald-500',
    accent: 'bg-emerald-50 text-emerald-600',
    span: 'md:col-span-1',
  },
  {
    icon: Waypoints,
    title: 'Connected Ecosystem',
    description: 'Every platform shares data, insights, and context. Your tools work together, not in isolation.',
    color: 'bg-violet-500',
    accent: 'bg-violet-50 text-violet-600',
    span: 'md:col-span-2',
  },
];

export default function BentoGrid() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-sm font-bold text-brand-blue uppercase tracking-[0.2em] mb-4">Why MCOM?</h2>
          <p className="text-4xl md:text-5xl font-bold text-gray-900 tracking-tight">
            Everything you need. <br className="hidden md:block" />
            All in one place.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {BENEFITS.map((benefit, index) => (
            <motion.div
              key={benefit.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.07, duration: 0.5 }}
              whileHover={{ scale: 1.02, y: -4 }}
              className={`${benefit.span} bento-card group cursor-default`}
            >
              <div className={`w-14 h-14 ${benefit.accent} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500`}>
                <benefit.icon className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">{benefit.title}</h3>
              <p className="text-gray-500 leading-relaxed">{benefit.description}</p>
              
              {/* Subtle corner glow on hover */}
              <div className={`absolute -top-20 -right-20 w-40 h-40 ${benefit.color} opacity-0 group-hover:opacity-10 blur-3xl rounded-full transition-opacity duration-700`} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
