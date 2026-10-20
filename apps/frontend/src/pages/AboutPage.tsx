import React from 'react';
import { ArrowRight, ArrowUpRight, Check, Globe2, Heart, ShieldCheck, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PRODUCTS, type Product } from '../constants';

const productImages: Record<string, string> = {
  'gbs-loyalty': '/loyalty%20(2).jpeg',
  'gbs-audit': '/audit.jpeg',
  'gbs-expo': '/expo.jpeg',
  'mcom-mall': '/mall.jpeg',
  'mcom-rewards': '/Gemini_Generated_Image_1hnsxs1hnsxs1hns.jpeg',
  'mcomq-link': '/links.jpeg',
};

const values = [
  { icon: Globe2, number: '01', title: 'Global Scale', text: 'Build connected services that can grow with the businesses using them.' },
  { icon: ShieldCheck, number: '02', title: 'Enterprise Security', text: 'Put identity, permissions, and protected service connections at the foundation.' },
  { icon: Zap, number: '03', title: 'Instant Performance', text: 'Make everyday work simpler with shared access across focused business tools.' },
  { icon: Heart, number: '04', title: 'Human Centric', text: 'Shape useful experiences for merchants, customers, partners, and teams.' },
];

export default function AboutPage() {
  const gbsProducts = PRODUCTS.filter((product) => product.type === 'GBS');
  const mcomProducts = PRODUCTS.filter((product) => product.type === 'Mcom');

  return (
    <main className="about-page overflow-hidden bg-white text-slate-900">
      <section className="relative isolate overflow-hidden bg-[#fffaf5] pt-28 md:min-h-[760px] md:pt-36">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_75%_45%,rgba(255,105,0,0.13),transparent_48%)]" />
        <div className="mx-auto grid max-w-7xl items-center gap-7 px-5 pb-14 sm:gap-10 sm:px-6 sm:pb-20 md:grid-cols-[0.92fr_1.08fr] md:gap-4 md:px-10 md:pb-28">
          <div className="relative z-10 max-w-2xl">
            <h1 className="text-[2.65rem] font-semibold leading-[1.04] tracking-[-0.055em] text-slate-950 sm:text-6xl lg:text-[4.6rem]">
              Business works better <span className="text-[#f26522]">connected.</span>
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-slate-600 md:text-xl">
              We bring the tools businesses rely on into one connected ecosystem: a shared foundation, with focused products for the work that matters.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <a href="#ecosystem" className="inline-flex items-center gap-3 rounded-full bg-[#ff6900] px-7 py-4 font-semibold text-white shadow-lg shadow-orange-500/20 transition hover:-translate-y-0.5 hover:bg-orange-600">
                Explore our ecosystem <ArrowRight size={18} />
              </a>
            </div>
            <div className="mt-12 flex items-center gap-4 border-t border-orange-100 pt-6 text-sm text-slate-500">
              <span className="font-semibold text-slate-800">Two suites</span><span className="h-1 w-1 rounded-full bg-orange-400" />
              <span>One connected foundation</span>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-[660px] md:-mr-10">
            <div className="absolute inset-[10%] rounded-full bg-orange-300/20 blur-3xl" />
            <img src="/hero.jpeg" alt="A connected world map representing businesses linked across regions" className="relative aspect-[1.28/1] w-full object-contain drop-shadow-[0_30px_45px_rgba(92,48,20,0.2)]" />
          </div>
        </div>
        <div className="absolute bottom-0 left-1/2 h-px w-[min(90%,1200px)] -translate-x-1/2 bg-gradient-to-r from-transparent via-orange-200 to-transparent" />
      </section>

      <section id="story" className="scroll-mt-24 py-14 sm:py-20 md:py-28">
        <div className="mx-auto grid max-w-7xl items-center gap-9 px-5 sm:gap-12 sm:px-6 md:grid-cols-2 md:gap-20 md:px-10">
          <div className="relative">
            <div className="absolute -bottom-5 -left-5 hidden h-2/3 w-2/3 rounded-[2rem] bg-orange-100 md:block" />
            <img src="/story.jpg" alt="The team collaborating around a laptop" className="relative mx-auto block aspect-[1.12/0.92] w-full max-w-full rounded-none object-cover object-center md:mx-0 md:rounded-[1.7rem] md:shadow-xl md:shadow-slate-900/10" />
          </div>
          <div className="max-w-xl">
            <p className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-orange-600">02 / Our story</p>
            <h2 className="text-3xl font-semibold leading-tight tracking-[-0.04em] sm:text-5xl">One foundation.<br />Tools for real work.</h2>
            <p className="mt-7 text-lg leading-8 text-slate-600">
              Central Hub Solution is building a shared platform for business services that are often scattered across separate systems. The hub brings together core capabilities like identity, membership, and access, so each service can focus on its job while connecting to the wider ecosystem.
            </p>
            <p className="mt-5 leading-7 text-slate-600">
              That is the idea behind 24/7 GBS and Mcom: practical products for operations, commerce, engagement, and integrations, connected through a common platform.
            </p>
            <a href="#ecosystem" className="mt-8 inline-flex items-center gap-2 font-semibold text-orange-700 hover:text-orange-800">See how the products fit together <ArrowRight size={17} /></a>
          </div>
        </div>
      </section>

      <section id="ecosystem" className="scroll-mt-20 bg-[#f7f8fa] py-14 sm:py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 md:px-10">
          <div className="mx-auto mb-9 max-w-3xl text-center sm:mb-12 md:mb-16">
            <p className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-orange-600">03 / Our ecosystem</p>
            <h2 className="text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">Two suites, linked by one hub.</h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-600">24/7 GBS and Mcom serve different business needs. The shared platform helps connect the experience, so products can work as an ecosystem instead of isolated tools.</p>
          </div>
          <div className="mb-6 grid gap-4 rounded-3xl border border-orange-100 bg-white p-4 shadow-sm sm:gap-5 sm:p-5 md:mb-8 md:grid-cols-[1fr_auto_1fr] md:items-center md:p-7">
            <SuiteColumn label="24/7 GBS" note="Business operations" products={gbsProducts} />
            <div className="flex flex-col items-center justify-center gap-2 py-2 text-center md:px-5">
              <img src="/chs-icon.png" alt="Central Hub Solution logo" className="h-14 w-14 object-contain sm:h-16 sm:w-16" />
              <span className="text-sm font-bold text-slate-900">Central Hub</span>
              <span className="max-w-36 text-xs leading-5 text-slate-500">Identity · Membership · Access</span>
              <div className="hidden items-center gap-1 text-orange-500 md:flex"><span className="h-px w-8 bg-orange-300" /><ArrowRight size={15} /><span className="h-px w-8 bg-orange-300" /></div>
            </div>
            <SuiteColumn label="Mcom" note="Commerce & engagement" products={mcomProducts} />
          </div>
          <div className="mx-auto flex max-w-3xl flex-wrap justify-center gap-1.5 text-[10px] font-semibold leading-4 text-slate-600 sm:gap-3 sm:text-xs">
            {['Shared account', 'Membership', 'Connected services', 'Product specific tools'].map((item) => <span key={item} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-2 sm:gap-2 sm:px-4 sm:py-2.5"><Check size={12} className="shrink-0 text-orange-600 sm:h-3.5 sm:w-3.5" />{item}</span>)}
          </div>
        </div>
      </section>

      <section className="py-14 sm:py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 md:px-10">
          <div className="grid items-end gap-8 md:grid-cols-[0.9fr_1.1fr] md:gap-16">
            <div>
              <p className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-orange-600">04 / Our values</p>
              <h2 className="text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">How we build<br />and what we value.</h2>
            </div>
            <p className="max-w-xl text-lg leading-8 text-slate-600">These principles guide the choices behind the platform and the products built on it.</p>
          </div>
          <div className="mt-8 grid gap-3 sm:mt-10 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
            {values.map(({ icon: Icon, number, title, text }) => <article key={title} className="group rounded-2xl border border-slate-200 bg-white p-5 transition duration-300 hover:-translate-y-1 hover:border-orange-200 hover:shadow-xl hover:shadow-orange-900/5 sm:p-6 md:p-7">
              <div className="flex items-center justify-between"><span className="text-xs font-bold tracking-[0.15em] text-orange-600">{number}</span><Icon size={20} strokeWidth={1.7} className="text-slate-400 transition group-hover:text-orange-600" /></div>
              <h3 className="mt-9 text-xl font-semibold tracking-tight">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{text}</p>
            </article>)}
          </div>
        </div>
      </section>

      <section className="py-14 sm:py-16 md:py-24">
        <div className="mx-auto grid max-w-7xl items-center gap-9 px-5 sm:gap-12 sm:px-6 md:grid-cols-2 md:gap-20 md:px-10">
          <div className="max-w-xl">
            <p className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-orange-600">05 / Our vision</p>
            <h2 className="text-3xl font-semibold leading-tight tracking-[-0.04em] sm:text-5xl">Make business<br />feel less fragmented.</h2>
            <p className="mt-7 text-lg leading-8 text-slate-600">We see a future where essential business services can work together through a dependable shared foundation, while staying focused on the people and tasks they serve.</p>
            <Link to="/getstarted" className="mt-8 inline-flex items-center gap-3 rounded-full bg-[#ff6900] px-7 py-4 font-semibold text-white transition hover:bg-orange-600">Explore getting started <ArrowUpRight size={18} /></Link>
          </div>
          <div className="relative">
            <div className="absolute -bottom-5 -right-5 hidden h-2/3 w-2/3 rounded-[2rem] bg-orange-100 md:block" />
            <img src="/vison.jpg" alt="Modern architecture viewed upward, representing a vision for connected business" className="relative mx-auto block aspect-[1.12/0.92] w-full max-w-full rounded-none object-cover object-center md:mx-0 md:rounded-[1.7rem] md:shadow-xl md:shadow-slate-900/10" />
          </div>
        </div>
      </section>
    </main>
  );
}

function SuiteColumn({ label, note, products }: { label: string; note: string; products: Product[] }) {
  return <div className="min-w-0">
    <div className="mb-4 flex items-baseline justify-between gap-3"><h3 className="text-lg font-bold text-slate-900">{label}</h3><span className="text-xs text-slate-500">{note}</span></div>
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {products.map((product) => <ProductTile key={product.id} product={product} />)}
    </div>
  </div>;
}

function ProductTile({ product }: { product: Product }) {
  return <Link to={`/product/${product.id}`} className="group block">
    <div className="relative mb-2 aspect-square w-full overflow-hidden rounded-xl transition duration-300 group-hover:-translate-y-0.5 group-hover:shadow-lg group-hover:shadow-orange-500/15">
      <img src={productImages[product.id]} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
      <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-orange-600 opacity-0 shadow-md transition-opacity group-hover:opacity-100">
        <ArrowUpRight size={14} />
      </span>
    </div>
    <div className="px-1"><span className="block text-xs font-bold leading-4 text-slate-900 transition-colors group-hover:text-orange-600">{product.name}</span></div>
  </Link>;
}
