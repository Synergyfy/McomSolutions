import { Link, Navigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, ArrowRight, ExternalLink } from 'lucide-react';
import { PRODUCTS } from '../constants';

type ProductStory = {
  headline: string;
  introduction: string;
  image: string;
  imageAlt: string;
  imageFit?: 'cover' | 'contain';
  imageNote: string;
  audience: string;
  explanation: string;
  steps: { title: string; description: string }[];
};

const PRODUCT_STORIES: Record<string, ProductStory> = {
  'gbs-loyalty': {
    headline: 'Give customers a reason to come back.',
    introduction: 'Build loyalty around the people who keep your business moving. Set up rewards, recognise repeat visits and make it easier to turn a good experience into a lasting relationship.',
    image: '/loyalty_app_mockup.webp',
    imageAlt: '24/7 GBS Rewards loyalty dashboard showing customer and programme activity',
    imageFit: 'contain',
    imageNote: 'A clear view of your rewards programme and customer activity.',
    audience: 'For teams that want to grow repeat business',
    explanation: 'Bring your rewards programme and customer engagement activity into one place. Shape rewards around the way your customers shop, then use programme insights to understand what is bringing them back.',
    steps: [
      { title: 'Set the rewards', description: 'Choose the points, perks or membership levels that make sense for your customers.' },
      { title: 'Recognise activity', description: 'Keep track of customer engagement across the channels your programme supports.' },
      { title: 'Build on what works', description: 'Use programme insights to refine offers and strengthen customer relationships.' },
    ],
  },
  'gbs-audit': {
    headline: 'Know what is happening across your business.',
    introduction: 'Bring compliance checks and financial oversight into a clearer view. 24/7 GBS Audit helps teams review activity, spot issues that need attention and keep useful records close at hand.',
    image: '/audit.jpeg',
    imageAlt: 'Illustration of a business owner reviewing a compliance checklist',
    imageFit: 'cover',
    imageNote: 'A more organised way to review business activity and compliance.',
    audience: 'For finance, compliance and internal audit teams',
    explanation: 'Keep routine reviews organised and make unusual activity easier to investigate. Bring monitoring and reporting together so your team can focus attention where it is needed.',
    steps: [
      { title: 'Review activity', description: 'See relevant transactions and operational records in one place.' },
      { title: 'Follow up on risks', description: 'Use risk checks and anomaly signals to guide a closer review.' },
      { title: 'Keep a clear record', description: 'Prepare reports that help your team track findings and demonstrate oversight.' },
    ],
  },
  'gbs-expo': {
    headline: 'Make every part of your event easier to manage.',
    introduction: 'Coordinate exhibitors, attendees and event information without losing sight of the details. 24/7 GBS Expo brings the practical tools for running exhibitions and trade events into one experience.',
    image: '/expo.jpeg',
    imageAlt: 'Illustration of an event organiser presenting to exhibition attendees',
    imageFit: 'cover',
    imageNote: 'One place to organise the people, spaces and activity around your event.',
    audience: 'For exhibition organisers, venues and event teams',
    explanation: 'Give exhibitors and attendees a more connected event experience while keeping planning and on-the-day coordination manageable for your team.',
    steps: [
      { title: 'Plan the floor', description: 'Organise exhibitors and make event spaces easier for visitors to navigate.' },
      { title: 'Support exhibitors', description: 'Give exhibitors a dedicated place to manage their event participation.' },
      { title: 'Connect with attendees', description: 'Help teams capture leads and keep visitors engaged throughout the event.' },
    ],
  },
  'mcom-mall': {
    headline: 'Bring local and independent businesses together online.',
    introduction: 'Create a shared shopping destination where customers can discover sellers and browse products in one place. Mcom Mall gives marketplace operators tools to manage vendors, listings and checkout.',
    image: '/mall_app_mockup.webp',
    imageAlt: 'Mcom Mall marketplace interface showing a digital storefront and product listings',
    imageFit: 'contain',
    imageNote: 'A marketplace experience designed for multiple sellers and their customers.',
    audience: 'For marketplace operators and multi-vendor businesses',
    explanation: 'Bring a collection of sellers into one customer-facing marketplace while giving your team a shared view of products, orders and vendor activity.',
    steps: [
      { title: 'Bring sellers on board', description: 'Manage vendor profiles and the products they offer through your marketplace.' },
      { title: 'Help customers discover', description: 'Make it easier to browse, search and compare products from different sellers.' },
      { title: 'Manage the journey', description: 'Coordinate checkout and review marketplace activity from your operator tools.' },
    ],
  },
  'mcom-rewards': {
    headline: 'Turn everyday engagement into something people value.',
    introduction: 'Give your community and customers more ways to take part. Mcom Rewards helps brands build flexible reward experiences, from points and incentives to campaigns that invite people back.',
    image: '/mcom-reward.webp',
    imageAlt: 'Mcom Rewards illustration showing customers engaging with a loyalty programme',
    imageFit: 'contain',
    imageNote: 'Rewards and incentives that can fit the way your audience engages.',
    audience: 'For brands, communities and customer-facing apps',
    explanation: 'Create reward experiences around the actions you want to encourage. Bring campaign activity and reward fulfilment together, then adapt the experience as your audience grows.',
    steps: [
      { title: 'Choose what to reward', description: 'Decide which purchases, visits or interactions should earn recognition.' },
      { title: 'Shape the experience', description: 'Set up incentives and campaigns that feel relevant to your audience.' },
      { title: 'Keep people involved', description: 'Use reward activity to encourage participation and strengthen engagement.' },
    ],
  },
  'mcomq-link': {
    headline: 'Connect the tools your business already relies on.',
    introduction: 'Move information between business systems with less manual handover. McomQ Link provides an integration layer for connecting services, syncing data and coordinating the workflows between them.',
    image: '/global_connectivity_mockup.webp',
    imageAlt: 'Visualisation of a connected global network representing business system integrations',
    imageFit: 'cover',
    imageNote: 'A shared connection layer for services and business systems.',
    audience: 'For integration teams and businesses with connected systems',
    explanation: 'Connect the services involved in your business workflows and keep data moving between them. Use APIs and webhooks to fit integrations to the systems you already operate.',
    steps: [
      { title: 'Connect your services', description: 'Set up links between the applications and systems used by your teams.' },
      { title: 'Move information', description: 'Synchronise relevant data and respond to events through supported integrations.' },
      { title: 'Keep workflows connected', description: 'Monitor the connections that help your business tools work together.' },
    ],
  },
};

export default function ProductDetail() {
  const { id } = useParams();
  const product = PRODUCTS.find((item) => item.id === id);
  const story = id ? PRODUCT_STORIES[id] : undefined;

  if (!product || !story) return <Navigate to="/" replace />;

  const relatedProducts = PRODUCTS.filter((item) => item.type === product.type && item.id !== product.id);

  return (
    <main className="bg-white pb-20 pt-28 sm:pt-32">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-950">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            All products
          </Link>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            {product.type === 'GBS' ? '24/7 GBS' : 'Mcom'} <span className="px-1.5 text-orange-500">/</span> {product.name}
          </p>
        </div>

        <section className="grid items-center gap-10 border-b border-slate-200 pb-14 md:gap-14 md:pb-20 lg:grid-cols-[0.92fr_1.08fr]">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            <p className="mb-5 text-sm font-semibold text-orange-600">{story.audience}</p>
            <h1 className="max-w-2xl text-4xl font-semibold leading-[1.08] tracking-tight text-slate-950 sm:text-5xl lg:text-[3.7rem]">
              {story.headline}
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">{story.introduction}</p>
            <div className="mt-8">
              <a
                href={product.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-orange-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-orange-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600"
              >
                Learn more
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
          </motion.div>

          <motion.figure
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.08 }}
            className="min-w-0"
          >
            <div className="flex min-h-[280px] items-center justify-center overflow-hidden rounded-2xl bg-slate-50 sm:min-h-[380px]">
              <img
                src={story.image}
                alt={story.imageAlt}
                className={`max-h-[520px] w-full ${story.imageFit === 'contain' ? 'object-contain' : 'h-full min-h-[280px] object-cover sm:min-h-[380px]'}`}
              />
            </div>
            <figcaption className="mt-3 text-sm text-slate-500">{story.imageNote}</figcaption>
          </motion.figure>
        </section>

        <section className="grid gap-10 border-b border-slate-200 py-14 md:grid-cols-[0.8fr_1.2fr] md:gap-16 md:py-18">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-orange-600">A clearer way to work</p>
            <h2 className="mt-3 text-2xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-3xl">{story.audience}</h2>
          </div>
          <div>
            <p className="text-lg leading-8 text-slate-600">{story.explanation}</p>
            <div className="mt-7 flex flex-wrap gap-2">
              {product.useCases.map((useCase) => (
                <span key={useCase} className="rounded-full border border-slate-200 px-3.5 py-2 text-sm text-slate-600">{useCase}</span>
              ))}
            </div>
          </div>
        </section>

        <section className="py-14 md:py-20">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-orange-600">How it fits together</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">A practical flow, from setup to follow-through.</h2>
          </div>
          <div className="mt-10 grid gap-8 md:grid-cols-3 md:gap-10">
            {story.steps.map((step, index) => (
              <article key={step.title} className="border-t-2 border-orange-500 pt-5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">0{index + 1}</p>
                <h3 className="mt-3 text-xl font-semibold text-slate-950">{step.title}</h3>
                <p className="mt-2 leading-7 text-slate-600">{step.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-t border-slate-200 py-14 md:py-18">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-orange-600">Part of the {product.type === 'GBS' ? '24/7 GBS' : 'Mcom'} suite</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Explore related products</h2>
            </div>
            <Link to="/#platforms" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 transition hover:text-orange-700">
              View all products <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            {relatedProducts.map((related) => {
              const relatedStory = PRODUCT_STORIES[related.id];
              return (
                <Link key={related.id} to={`/product/${related.id}`} className="group flex min-w-0 items-center gap-4 rounded-xl border border-slate-200 p-3 transition hover:border-slate-300 hover:bg-slate-50">
                  <img src={relatedStory.image} alt="" className="h-20 w-24 shrink-0 rounded-lg bg-white object-cover" loading="lazy" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-slate-900">{related.name}</span>
                    <span className="mt-1 block text-sm leading-5 text-slate-500">{related.tagline}</span>
                  </span>
                  <ArrowRight className="mr-2 h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-1 group-hover:text-orange-600" aria-hidden="true" />
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
