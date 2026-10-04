import React, { useState } from 'react';
import {
  HelpCircle, MessageCircle, FileText, Search,
  PlayCircle, BookOpen, ExternalLink, ArrowRight,
  Ticket, Clock, Plus, X, Send, CheckCircle2, AlertCircle, Loader2
} from 'lucide-react';
import { useProfile, useSupportTickets, useCreateSupportTicket } from '../services/business/hooks';

export default function DashboardSupport() {
  const { data: profile } = useProfile();
  const { data: tickets = [], isLoading: ticketsLoading } = useSupportTickets();
  const { mutateAsync: createTicket, isPending: isSubmitting } = useCreateSupportTicket();

  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showAllTickets, setShowAllTickets] = useState(false);
  const [subject, setSubject] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [message, setMessage] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const renewalDate = profile?.membershipExpiresAt
    ? new Date(profile.membershipExpiresAt)
    : (profile?.createdAt ? new Date(new Date(profile.createdAt).setMonth(new Date(profile.createdAt).getMonth() + 1)) : null);
  const renewalDateStr = renewalDate
    ? renewalDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'Monthly Renewal Cycle';

  const memberLevel = profile?.membershipLevel || 'Bronze';

  const faqs = [
    {
      q: "How do I launch a new platform?",
      a: "Navigate to the All Products tab, select a platform you have access to, and click Launch. If you don't have access, you'll need to purchase a package first."
    },
    {
      q: `When does my ${memberLevel} Membership renew?`,
      a: `You can view your renewal date on the My Membership tab. Your current billing cycle ends on ${renewalDateStr}.`
    },
    {
      q: "How do I increase my platform limits?",
      a: "Limits are tied to your package tiers. To increase limits, upgrade your package from the My Packages tab."
    },
  ];

  const handleOpenModal = (presetSubject = '', presetPriority = 'Medium') => {
    setSubject(presetSubject);
    setPriority(presetPriority);
    setMessage('');
    setErrorMsg('');
    setSubmitSuccess(false);
    setShowModal(true);
  };

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      setErrorMsg('Please enter both a subject and message.');
      return;
    }
    try {
      setErrorMsg('');
      await createTicket({ subject: subject.trim(), message: message.trim(), priority });
      setSubmitSuccess(true);
      setTimeout(() => {
        setShowModal(false);
        setSubmitSuccess(false);
        setSubject('');
        setMessage('');
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || err.message || 'Failed to submit ticket');
    }
  };

  const filteredFaqs = faqs.filter(
    f => f.q.toLowerCase().includes(searchQuery.toLowerCase()) || f.a.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredTickets = tickets.filter((t: any) =>
    (t.subject || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.status || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const displayedTickets = showAllTickets ? filteredTickets : filteredTickets.slice(0, 5);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Header with Search */}
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-[2.5rem] p-6 md:p-12 text-white relative overflow-hidden shadow-xl">
        <div className="absolute right-0 top-0 w-96 h-96 bg-orange-500/20 rounded-full blur-[80px]" />
        <div className="relative z-10 max-w-2xl">
          <h2 className="text-3xl md:text-4xl font-black mb-3 md:mb-4">How can we help you today?</h2>
          <p className="text-gray-300 text-base md:text-lg mb-6 md:mb-8">Search our knowledge base or get in touch with our support team.</p>
          
          <div className="relative">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search for articles, guides, or FAQs..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/10 border border-white/20 text-white placeholder:text-gray-400 rounded-full py-4 md:py-5 pl-14 md:pl-16 pr-6 focus:outline-none focus:ring-2 focus:ring-orange-500 backdrop-blur-md text-base md:text-lg transition-all"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Contact Options */}
        <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div 
            onClick={() => handleOpenModal('Live Support Inquiry', 'High')}
            className="bg-white rounded-3xl p-5 md:p-8 border border-gray-200 shadow-sm hover:shadow-md transition-shadow group cursor-pointer"
          >
            <div className="w-14 h-14 bg-orange-100 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <MessageCircle className="w-7 h-7 text-orange-500" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Live Chat & Support</h3>
            <p className="text-gray-500 text-sm mb-6">Chat directly with our support team. Priority routing for {memberLevel} members.</p>
            <div className="flex items-center gap-2 text-orange-500 font-bold text-sm">
              Start Chat <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          <div 
            onClick={() => handleOpenModal()}
            className="bg-white rounded-3xl p-5 md:p-8 border border-gray-200 shadow-sm hover:shadow-md transition-shadow group cursor-pointer"
          >
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
          <div className="md:col-span-2 bg-white rounded-3xl p-5 md:p-8 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Recent Support Tickets</h3>
                <p className="text-xs text-gray-500">Track and view updates on your queries</p>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => handleOpenModal()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-orange-50 hover:bg-orange-100 text-orange-600 rounded-full text-xs font-bold transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> New Ticket
                </button>
                {filteredTickets.length > 5 && (
                  <button 
                    onClick={() => setShowAllTickets(!showAllTickets)} 
                    className="text-sm font-bold text-orange-500 hover:underline"
                  >
                    {showAllTickets ? 'Show Less' : 'View All'}
                  </button>
                )}
              </div>
            </div>

            {ticketsLoading ? (
              <div className="py-8 flex items-center justify-center gap-2 text-gray-500 text-sm font-semibold">
                <Loader2 className="w-5 h-5 animate-spin text-orange-500" /> Loading tickets...
              </div>
            ) : displayedTickets.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-gray-500 font-medium text-sm mb-3">No support tickets found.</p>
                <button
                  onClick={() => handleOpenModal()}
                  className="px-5 py-2.5 bg-orange-500 text-white rounded-full text-xs font-bold hover:bg-orange-600 transition-colors shadow-sm"
                >
                  Create Your First Ticket
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {displayedTickets.map((t: any) => {
                  const displayId = t.id ? `#T-${t.id.slice(-4).toUpperCase()}` : '#T-0001';
                  const dateStr = t.createdAt
                    ? new Date(t.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                    : 'Recent';
                  const status = t.status || 'Open';
                  const isResolved = status.toLowerCase() === 'resolved' || status.toLowerCase() === 'closed';

                  return (
                    <div key={t.id} className="flex flex-col sm:flex-row sm:items-center justify-between py-4 gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-xs font-black text-gray-400 shrink-0">{displayId}</span>
                          <p className="font-bold text-gray-900 text-sm truncate">{t.subject}</p>
                          {t.priority && (
                            <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full shrink-0">
                              {t.priority}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Submitted on {dateStr}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 self-end sm:self-center">
                        <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${isResolved ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                          {status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Knowledge Base Sidebar */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-5 md:p-8 border border-gray-200 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-4 md:mb-6 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-orange-500" /> Quick Guides
            </h3>
            <div className="space-y-4">
              <a href="#packages" className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors group">
                <div className="flex items-center gap-3">
                  <PlayCircle className="w-5 h-5 text-gray-400 group-hover:text-orange-500" />
                  <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900">Getting Started with MCOM</span>
                </div>
                <ExternalLink className="w-3 h-3 text-gray-300" />
              </a>
              <a href="#billing" className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors group">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-gray-400 group-hover:text-orange-500" />
                  <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900">Understanding Package Limits</span>
                </div>
                <ExternalLink className="w-3 h-3 text-gray-300" />
              </a>
              <a href="#memberships" className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors group">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-gray-400 group-hover:text-orange-500" />
                  <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900">Billing & Invoices FAQ</span>
                </div>
                <ExternalLink className="w-3 h-3 text-gray-300" />
              </a>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-5 md:p-8 border border-gray-200 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-4 md:mb-6 flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-orange-500" /> Top FAQs
            </h3>
            <div className="space-y-6">
              {filteredFaqs.map((faq, i) => (
                <div key={i}>
                  <p className="font-bold text-gray-900 text-sm mb-2">{faq.q}</p>
                  <p className="text-gray-500 text-sm leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* Ticket Creation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl relative border border-gray-100">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-6 right-6 p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600 font-bold">
                <Ticket className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Submit Support Ticket</h3>
                <p className="text-xs text-gray-500">We usually respond within a few hours</p>
              </div>
            </div>

            {submitSuccess ? (
              <div className="py-8 text-center space-y-3">
                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto animate-bounce" />
                <h4 className="text-lg font-bold text-gray-900">Ticket Submitted Successfully!</h4>
                <p className="text-sm text-gray-500">Our support engineers have received your inquiry.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmitTicket} className="space-y-4">
                {errorMsg && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Subject / Summary
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Question regarding API integration or subscription renewal"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Priority Level
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm bg-white"
                  >
                    <option value="Low">Low - General query</option>
                    <option value="Medium">Medium - Standard issue</option>
                    <option value="High">High - Impeding business operations</option>
                    <option value="Urgent">Urgent - Platform outage / Critical issue</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Message / Details
                  </label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Describe what you are experiencing or what assistance you need..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm resize-none"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-5 py-2.5 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2.5 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold transition-colors flex items-center gap-2 disabled:opacity-50 shadow-md shadow-orange-500/20"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" /> Send Ticket
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

