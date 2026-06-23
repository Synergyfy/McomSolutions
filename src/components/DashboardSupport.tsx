import React, { useState } from 'react';
import {
  HelpCircle, MessageCircle, FileText, Search,
  PlayCircle, BookOpen, ExternalLink, ArrowRight,
  Ticket, Clock, CheckCircle2
} from 'lucide-react';

const FAQS = [
  { q: "How do I launch a new platform?", a: "Navigate to the All Products tab, select a platform you have access to, and click Launch. If you don't have access, you'll need to purchase a package first." },
  { q: "When does my Silver Membership renew?", a: "You can view your renewal date on the My Membership tab. Your current billing cycle ends on 23 Jul 2026." },
  { q: "How do I increase my platform limits?", a: "Limits are tied to your package tiers. To increase limits, upgrade your package from the My Packages tab." },
];

const TICKETS = [
  { id: '#T-1042', subject: 'Storefront Integration Issue', status: 'In Progress', updated: '2 hours ago' },
  { id: '#T-1038', subject: 'Billing Query - May Invoice', status: 'Resolved', updated: '1 week ago' },
];

export default function DashboardSupport() {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Header with Search */}
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-[2.5rem] p-12 text-white relative overflow-hidden shadow-xl">
        <div className="absolute right-0 top-0 w-96 h-96 bg-orange-500/20 rounded-full blur-[80px]" />
        <div className="relative z-10 max-w-2xl">
          <h2 className="text-4xl font-black mb-4">How can we help you today?</h2>
          <p className="text-gray-300 text-lg mb-8">Search our knowledge base or get in touch with our support team.</p>
          
          <div className="relative">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search for articles, guides, or FAQs..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/10 border border-white/20 text-white placeholder:text-gray-400 rounded-full py-5 pl-16 pr-6 focus:outline-none focus:ring-2 focus:ring-orange-500 backdrop-blur-md text-lg transition-all"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Contact Options */}
        <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-3xl p-8 border border-gray-200 shadow-sm hover:shadow-md transition-shadow group cursor-pointer">
            <div className="w-14 h-14 bg-orange-100 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <MessageCircle className="w-7 h-7 text-orange-500" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Live Chat</h3>
            <p className="text-gray-500 text-sm mb-6">Chat with our support team in real-time. Priority routing for Silver members.</p>
            <div className="flex items-center gap-2 text-orange-500 font-bold text-sm">
              Start Chat <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          <div className="bg-white rounded-3xl p-8 border border-gray-200 shadow-sm hover:shadow-md transition-shadow group cursor-pointer">
            <div className="w-14 h-14 bg-sky-100 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Ticket className="w-7 h-7 text-sky-500" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Submit Ticket</h3>
            <p className="text-gray-500 text-sm mb-6">For complex technical issues or billing inquiries. Average response: 4 hours.</p>
            <div className="flex items-center gap-2 text-sky-500 font-bold text-sm">
              Open Ticket <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Recent Tickets */}
          <div className="md:col-span-2 bg-white rounded-3xl p-8 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900">Recent Tickets</h3>
              <button className="text-sm font-bold text-orange-500 hover:underline">View All</button>
            </div>
            <div className="divide-y divide-gray-100">
              {TICKETS.map(t => (
                <div key={t.id} className="flex items-center justify-between py-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-xs font-black text-gray-400">{t.id}</span>
                      <p className="font-bold text-gray-900 text-sm">{t.subject}</p>
                    </div>
                    <p className="text-xs text-gray-500 flex items-center gap-1"><Clock className="w-3 h-3" /> Updated {t.updated}</p>
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${t.status === 'Resolved' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {t.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Knowledge Base Sidebar */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-8 border border-gray-200 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-orange-500" /> Quick Guides
            </h3>
            <div className="space-y-4">
              <a href="#" className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors group">
                <div className="flex items-center gap-3">
                  <PlayCircle className="w-5 h-5 text-gray-400 group-hover:text-orange-500" />
                  <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900">Getting Started with MCOM</span>
                </div>
                <ExternalLink className="w-3 h-3 text-gray-300" />
              </a>
              <a href="#" className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors group">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-gray-400 group-hover:text-orange-500" />
                  <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900">Understanding Package Limits</span>
                </div>
                <ExternalLink className="w-3 h-3 text-gray-300" />
              </a>
              <a href="#" className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors group">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-gray-400 group-hover:text-orange-500" />
                  <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900">Billing & Invoices FAQ</span>
                </div>
                <ExternalLink className="w-3 h-3 text-gray-300" />
              </a>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-8 border border-gray-200 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-orange-500" /> Top FAQs
            </h3>
            <div className="space-y-6">
              {FAQS.map((faq, i) => (
                <div key={i}>
                  <p className="font-bold text-gray-900 text-sm mb-2">{faq.q}</p>
                  <p className="text-gray-500 text-sm leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
