import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  Headphones,
  MapPin,
  MessageSquare,
  Send,
  Sparkles,
} from 'lucide-react';

const CONTACT_EMAIL = 'support@centralhubsolution.com';
const SALES_EMAIL = 'sales@centralhubsolution.com';
const HELLO_EMAIL = 'hello@centralhubsolution.com';

const contactChannels = [
  {
    icon: Headphones,
    title: 'Customer support',
    description: 'Account help, access passes, memberships, payments and technical issues.',
    email: CONTACT_EMAIL,
    accent: 'bg-orange-50 text-orange-600',
  },
  {
    icon: Building2,
    title: 'Sales & onboarding',
    description: 'Choosing a plan, onboarding your business or adding more team members.',
    email: SALES_EMAIL,
    accent: 'bg-blue-50 text-brand-blue',
  },
  {
    icon: Sparkles,
    title: 'Partnerships',
    description: 'Partnerships, integrations, affiliate programmes and ecosystem opportunities.',
    email: HELLO_EMAIL,
    accent: 'bg-purple-50 text-purple-600',
  },
];

const topics = [
  'General enquiry',
  'Membership & billing',
  'Access pass',
  'Technical support',
  'Partnerships',
  'Press & media',
];

export default function ContactPage() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    company: '',
    topic: topics[0],
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);

  const update = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setSubmitted(false);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const subject = `[${form.topic}] Website enquiry from ${form.name}`;
    const body = [
      `Name: ${form.name}`,
      `Email: ${form.email}`,
      form.company ? `Company: ${form.company}` : null,
      `Topic: ${form.topic}`,
      '',
      form.message,
    ]
      .filter(Boolean)
      .join('\n');

    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setSubmitted(true);
  };

  return (
    <main className="min-h-screen overflow-hidden bg-white pt-32 text-slate-900">
      <section className="relative isolate overflow-hidden bg-[#fffaf5] px-5 pb-16 pt-10 sm:px-6 sm:pb-20 md:px-10 md:pb-24">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_70%_40%,rgba(255,105,0,0.14),transparent_50%)]" />
        <div className="mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto max-w-3xl text-center"
          >
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white/70 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-orange-600 shadow-sm backdrop-blur">
              <MessageSquare size={14} />
              We are here to help
            </div>
            <h1 className="text-4xl font-semibold leading-[1.05] tracking-[-0.04em] text-slate-950 sm:text-6xl md:text-7xl">
              Let&apos;s talk.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-600 md:text-xl">
              Questions about a plan, an access pass or the ecosystem? Send us a message and the right team will get
              back to you.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm font-semibold text-slate-500">
              <span className="inline-flex items-center gap-2">
                <Clock size={16} className="text-orange-500" />
                Typically within one business day
              </span>
              <span className="inline-flex items-center gap-2">
                <MapPin size={16} className="text-orange-500" />
                United Kingdom
              </span>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="px-5 py-14 sm:px-6 sm:py-20 md:px-10">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-600">01 / Get in touch</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">
              Choose the team you need.
            </h2>
            <div className="mt-8 space-y-3">
              {contactChannels.map(({ icon: Icon, title, description, email, accent }) => (
                <a
                  key={title}
                  href={`mailto:${email}`}
                  className="group flex gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-xl hover:shadow-orange-900/5"
                >
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${accent}`}>
                    <Icon size={20} />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 font-semibold text-slate-950">
                      {title}
                      <ArrowRight
                        size={14}
                        className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-orange-600"
                      />
                    </span>
                    <span className="mt-1 block text-sm leading-6 text-slate-500">{description}</span>
                    <span className="mt-2 block break-all text-xs font-semibold text-orange-700">{email}</span>
                  </span>
                </a>
              ))}
            </div>

            <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center gap-2 font-semibold text-slate-900">
                <Headphones size={18} className="text-orange-600" />
                Already a member?
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Sign in and open the support centre in your dashboard for ticket tracking and account-specific help.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  to="/support"
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:border-orange-200 hover:text-orange-700"
                >
                  Browse support
                </Link>
                <Link
                  to="/login?redirect=%2Fdashboard%3Ftab%3Dsupport"
                  className="inline-flex items-center gap-1.5 rounded-full bg-brand-blue px-4 py-2 text-xs font-bold text-white hover:bg-blue-600"
                >
                  Sign in
                  <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5 sm:p-8 md:p-10">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-600">02 / Send a message</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-3xl">
              Tell us what you need.
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Fill in the form and we will open your email app with the message ready to send.
            </p>

            {submitted ? (
              <div className="mt-6 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                <div>
                  <p className="text-sm font-bold text-emerald-950">Your email is ready to send</p>
                  <p className="mt-1 text-xs leading-5 text-emerald-800">
                    If your email app did not open, email us directly at{' '}
                    <a href={`mailto:${CONTACT_EMAIL}`} className="font-bold underline">
                      {CONTACT_EMAIL}
                    </a>
                    .
                  </p>
                </div>
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                    Your name
                  </span>
                  <input
                    required
                    value={form.name}
                    onChange={(event) => update('name', event.target.value)}
                    placeholder="Jane Smith"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                    Email address
                  </span>
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(event) => update('email', event.target.value)}
                    placeholder="you@business.com"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                    Business <span className="font-medium normal-case tracking-normal text-slate-400">(optional)</span>
                  </span>
                  <input
                    value={form.company}
                    onChange={(event) => update('company', event.target.value)}
                    placeholder="Business name"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                    What is this about?
                  </span>
                  <select
                    value={form.topic}
                    onChange={(event) => update('topic', event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                  >
                    {topics.map((topic) => (
                      <option key={topic} value={topic}>
                        {topic}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Message
                </span>
                <textarea
                  required
                  rows={6}
                  value={form.message}
                  onChange={(event) => update('message', event.target.value)}
                  placeholder="How can we help?"
                  className="w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                />
              </label>

              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#ff6900] px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-orange-500/20 transition hover:bg-orange-600 active:scale-[0.99] sm:w-auto"
              >
                <Send size={16} />
                Prepare email
              </button>
              <p className="text-xs leading-5 text-slate-400">
                By sending a message you agree to be contacted about your enquiry. We do not use this form for
                marketing sign-ups.
              </p>
            </form>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-100 bg-slate-50 px-5 py-12 sm:px-6 md:px-10">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-600">Looking for answers now?</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
              The support centre has guides and FAQs.
            </h2>
          </div>
          <Link
            to="/support"
            className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-3.5 text-sm font-bold text-white transition hover:bg-orange-600"
          >
            Visit support
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </main>
  );
}
