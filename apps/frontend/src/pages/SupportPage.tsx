import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowRight,
  BookOpen,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  Headphones,
  KeyRound,
  LifeBuoy,
  Mail,
  Search,
  ShieldCheck,
  Ticket,
  UserRound,
  Wrench,
} from 'lucide-react';

const SUPPORT_EMAIL = 'support@centralhubsolution.com';

const categories = [
  {
    icon: CreditCard,
    title: 'Membership & billing',
    description: 'Plans, renewals, invoices and payment questions.',
    accent: 'bg-blue-50 text-brand-blue',
  },
  {
    icon: Ticket,
    title: 'Access passes',
    description: 'Buying, renewing or gifting a pass and redeeming codes.',
    accent: 'bg-orange-50 text-orange-600',
  },
  {
    icon: UserRound,
    title: 'Account & sign-in',
    description: 'Login issues, password resets and profile details.',
    accent: 'bg-emerald-50 text-emerald-600',
  },
  {
    icon: Building2,
    title: 'Business onboarding',
    description: 'Getting your business set up on the ecosystem.',
    accent: 'bg-purple-50 text-purple-600',
  },
  {
    icon: Wrench,
    title: 'Technical issues',
    description: 'Something not loading or working as expected.',
    accent: 'bg-amber-50 text-amber-600',
  },
  {
    icon: LifeBuoy,
    title: 'Affiliate programme',
    description: 'Tasks, referrals and affiliate dashboard help.',
    accent: 'bg-rose-50 text-rose-600',
  },
];

const faqs = [
  {
    question: 'How do I choose or change my membership?',
    answer:
      'Sign in and open the membership area from your dashboard. You can compare tiers there and choose the plan that fits your business. Upgrades take effect through the checkout flow and your entitlements update automatically.',
    tag: 'Membership',
  },
  {
    question: 'How do access passes work?',
    answer:
      'An access pass unlocks one or more ecosystem platforms for a fixed period. Passes are one-off purchases with no auto-renewal. You can buy a pass for your business, gift one by email, or buy a code to redeem later.',
    tag: 'Access passes',
  },
  {
    question: 'Where do I redeem a gift or access code?',
    answer:
      'Sign in, open your dashboard and go to Access Passes. Enter the code in the redeem box. Your pass starts the moment it is redeemed, unless you already have an active membership — in that case it is reserved and starts when your membership ends.',
    tag: 'Access passes',
  },
  {
    question: 'I have been charged but cannot see my access.',
    answer:
      'First check the Access Passes or Membership area of your dashboard. Payment providers can take a moment to confirm. If it still is not showing, contact support with the email address on your account, the plan name and the approximate time of payment.',
    tag: 'Billing',
  },
  {
    question: 'How do I reset my password?',
    answer:
      'Use the “Forgot password” link on the sign-in page. We will send a one-time code to your registered email address so you can set a new password. If the email does not arrive, check your spam folder and make sure you are using the address linked to your account.',
    tag: 'Account',
  },
  {
    question: 'Can I update my business profile details?',
    answer:
      'Yes. Sign in and open your business dashboard. Business details such as contact information and location can be updated from your profile settings. Some verified details may need to be reviewed by our team before they go live.',
    tag: 'Business',
  },
  {
    question: 'How do I launch a connected product?',
    answer:
      'Open All Products in your dashboard to see the platforms available to your account. If a product is included in your membership or an active access pass, you can launch it from there. If you do not have access yet, the listing will show the pass or plan needed.',
    tag: 'Products',
  },
  {
    question: 'How can I contact a human?',
    answer:
      'Email support@centralhubsolution.com or use the contact page. Signed-in business members can also raise a ticket from the Support Centre in their dashboard for tracked responses.',
    tag: 'Support',
  },
];

export default function SupportPage() {
  const [query, setQuery] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [isLoggedIn] = useState(
    () => typeof window !== 'undefined' && Boolean(localStorage.getItem('auth_token')),
  );

  const filteredFaqs = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return faqs;
    return faqs.filter(
      (faq) =>
        faq.question.toLowerCase().includes(term) ||
        faq.answer.toLowerCase().includes(term) ||
        faq.tag.toLowerCase().includes(term),
    );
  }, [query]);

  return (
    <main className="min-h-screen bg-white pb-24 pt-32 text-slate-900">
      <section className="px-5 sm:px-6 md:px-10">
        <div className="mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-slate-950 px-6 py-12 text-white shadow-2xl shadow-slate-900/20 sm:px-10 sm:py-16 md:px-14 md:py-20">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl"
          >
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-orange-300 backdrop-blur">
              <Headphones size={14} />
              Support centre
            </div>
            <h1 className="text-4xl font-semibold leading-[1.05] tracking-[-0.04em] sm:text-5xl md:text-6xl">
              How can we help?
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">
              Search the answers below, browse common topics, or get in touch with the team. Most questions are
              answered without waiting for a reply.
            </p>

            <div className="relative mt-7 max-w-2xl">
              <Search className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search for an answer…"
                className="w-full rounded-full border border-white/15 bg-white/10 py-4 pl-14 pr-5 text-sm text-white outline-none backdrop-blur transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-400/30 sm:text-base"
              />
            </div>
          </motion.div>
        </div>
      </section>

      <section className="px-5 py-14 sm:px-6 sm:py-20 md:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-600">01 / Browse topics</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">
                Pick the area you need.
              </h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-slate-500">
              Each topic covers the most common questions. If you cannot find it, contact us below.
            </p>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map(({ icon: Icon, title, description, accent }) => (
              <div
                key={title}
                className="rounded-2xl border border-slate-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-xl hover:shadow-orange-900/5"
              >
                <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${accent}`}>
                  <Icon size={20} />
                </span>
                <h3 className="mt-4 font-semibold text-slate-950">{title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-slate-500">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 sm:px-6 md:px-10">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.35fr_0.65fr] lg:gap-14">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-600">02 / Frequently asked</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">
              Answers to common questions.
            </h2>

            <div className="mt-7 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {filteredFaqs.length === 0 ? (
                <div className="p-8 text-center">
                  <Search className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-3 font-semibold text-slate-800">No matches for “{query}”</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Try a different search or contact support below.
                  </p>
                </div>
              ) : (
                filteredFaqs.map((faq, index) => {
                  const isOpen = openFaq === index;
                  return (
                    <div key={faq.question} className="border-b border-slate-100 last:border-b-0">
                      <button
                        type="button"
                        onClick={() => setOpenFaq(isOpen ? null : index)}
                        className="flex w-full items-start justify-between gap-4 p-5 text-left transition hover:bg-slate-50 sm:p-6"
                        aria-expanded={isOpen}
                      >
                        <span>
                          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-orange-600">
                            {faq.tag}
                          </span>
                          <span className="text-sm font-semibold leading-6 text-slate-950 sm:text-base">
                            {faq.question}
                          </span>
                        </span>
                        <ChevronDown
                          size={18}
                          className={`mt-1 shrink-0 text-slate-400 transition-transform ${
                            isOpen ? 'rotate-180 text-orange-600' : ''
                          }`}
                        />
                      </button>
                      {isOpen ? (
                        <p className="px-5 pb-5 text-sm leading-7 text-slate-600 sm:px-6 sm:pb-6">
                          {faq.answer}
                        </p>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-[1.5rem] border border-orange-100 bg-[#fffaf5] p-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-orange-600 shadow-sm">
                <Mail size={20} />
              </span>
              <h3 className="mt-4 text-lg font-semibold text-slate-950">Still need help?</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Email the support team and include the email address on your account plus a short description of the
                issue.
              </p>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#ff6900] px-4 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/20 transition hover:bg-orange-600"
              >
                <Mail size={16} />
                Email support
              </a>
              <p className="mt-3 break-all text-center text-xs font-semibold text-orange-700">{SUPPORT_EMAIL}</p>
            </div>

            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6">
              <div className="flex items-center gap-2">
                <CalendarDays size={18} className="text-brand-blue" />
                <h3 className="font-semibold text-slate-950">Support hours</h3>
              </div>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-slate-500">Monday – Friday</dt>
                  <dd className="font-semibold text-slate-900">09:00 – 18:00</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-slate-500">Saturday</dt>
                  <dd className="font-semibold text-slate-900">10:00 – 14:00</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-slate-500">Sunday</dt>
                  <dd className="font-semibold text-slate-900">Closed</dd>
                </div>
              </dl>
              <p className="mt-4 text-xs leading-5 text-slate-400">UK time. Urgent payment issues are prioritised.</p>
            </div>

            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-6">
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-emerald-600" />
                <h3 className="font-semibold text-slate-950">Tracked support</h3>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Business members can raise a ticket in the dashboard and follow every reply in one place.
              </p>
              <Link
                to={
                  isLoggedIn
                    ? '/dashboard?tab=support'
                    : `/login?redirect=${encodeURIComponent('/dashboard?tab=support')}`
                }
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-brand-blue hover:text-blue-700"
              >
                {isLoggedIn ? 'Open support centre' : 'Sign in to open a ticket'}
                <ArrowRight size={14} />
              </Link>
            </div>

            <Link
              to="/contact"
              className="flex items-center justify-between gap-4 rounded-[1.5rem] border border-slate-200 bg-white p-5 transition hover:border-orange-200 hover:shadow-lg"
            >
              <span>
                <span className="block font-semibold text-slate-950">Sales or partnership enquiry?</span>
                <span className="mt-1 block text-xs text-slate-500">Use the contact page and choose the right team.</span>
              </span>
              <ArrowRight size={18} className="shrink-0 text-orange-600" />
            </Link>
          </aside>
        </div>
      </section>

      <section className="px-5 pt-16 sm:px-6 md:px-10">
        <div className="mx-auto max-w-7xl rounded-[2rem] border border-slate-200 bg-slate-50 p-7 sm:p-10">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-orange-600">
                <BookOpen size={14} />
                Help us help you
              </div>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-3xl">
                Include these details when you contact support.
              </h2>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {[
                  'The email address on your account',
                  'The plan or pass name',
                  'A screenshot of the issue',
                  'The time it happened',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2 text-sm text-slate-600">
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Link
                to="/contact"
                className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-3.5 text-sm font-bold text-white transition hover:bg-orange-600"
              >
                Contact us
                <ArrowRight size={16} />
              </Link>
              <Link
                to="/access-passes"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-6 py-3.5 text-sm font-bold text-slate-700 transition hover:border-orange-200 hover:text-orange-700"
              >
                <KeyRound size={15} />
                Access passes
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
