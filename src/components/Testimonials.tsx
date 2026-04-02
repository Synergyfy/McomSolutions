import React from 'react';
import { motion } from 'motion/react';
import { Quote } from 'lucide-react';

const TESTIMONIALS = [
  {
    quote: "24/7 GBS has completely transformed how we handle global compliance. The Audit tool is a game-changer.",
    author: "Sarah Chen",
    role: "Head of Operations, Global Retail",
    image: "https://picsum.photos/seed/sarah/100/100"
  },
  {
    quote: "The Mcom ecosystem allowed us to launch our multi-vendor mall in record time. The integration is seamless.",
    author: "Marcus Thorne",
    role: "CTO, Digital Ventures",
    image: "https://picsum.photos/seed/marcus/100/100"
  },
  {
    quote: "Loyalty is no longer a guessing game. GBS Loyalty gives us the data we need to keep our customers coming back.",
    author: "Elena Rodriguez",
    role: "Marketing Director, Luxe Hotels",
    image: "https://picsum.photos/seed/elena/100/100"
  }
];

export default function Testimonials() {
  return (
    <section className="py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">Loved by Industry Leaders</h2>
          <p className="text-xl text-gray-600">See why the world's best companies choose 24/7 GBS.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {TESTIMONIALS.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="glass p-10 rounded-[2.5rem] flex flex-col justify-between"
            >
              <div>
                <Quote className="w-10 h-10 text-brand-blue/20 mb-6" />
                <p className="text-lg text-gray-700 italic leading-relaxed mb-8">"{t.quote}"</p>
              </div>
              <div className="flex items-center gap-4">
                <img 
                  src={t.image} 
                  alt={t.author} 
                  className="w-12 h-12 rounded-full border-2 border-white shadow-lg"
                  referrerPolicy="no-referrer"
                />
                <div>
                  <div className="font-bold text-gray-900">{t.author}</div>
                  <div className="text-xs text-gray-500 font-bold uppercase tracking-wider">{t.role}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
