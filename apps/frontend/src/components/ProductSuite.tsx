import { PRODUCTS } from '../constants';
import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const PRODUCT_IMAGES: Record<string, { src: string; alt: string; fit?: string }> = {
  'gbs-loyalty': {
    src: '/loyalty (2).jpeg',
    alt: 'Illustration of a customer receiving a loyalty reward',
  },
  'gbs-audit': {
    src: '/audit.jpeg',
    alt: 'Illustration of a business audit and compliance review',
  },
  'gbs-expo': {
    src: '/expo.jpeg',
    alt: 'Illustration of an exhibition hall and event attendees',
  },
  'mcom-mall': {
    src: '/mall.jpeg',
    alt: 'Illustration of a customer shopping at a local business',
  },
  'mcom-rewards': {
    src: '/Gemini_Generated_Image_1hnsxs1hnsxs1hns.jpeg',
    alt: 'Illustration of a customer receiving rewards and a gift',
  },
  'mcomq-link': {
    src: '/links.jpeg',
    alt: 'Illustration of people connected through a global network',
  },
};

const PRODUCT_SUITES = [
  {
    id: 'gbs',
    name: '24/7 GBS',
    description: 'Business tools for loyalty, auditing, and events.',
    products: PRODUCTS.filter((product) => product.type === 'GBS'),
  },
  {
    id: 'mcom',
    name: 'Mcom',
    description: 'Customer-facing commerce and engagement platforms.',
    products: PRODUCTS.filter((product) => product.type === 'Mcom'),
  },
];

export default function ProductSuite() {
  return (
    <section id="platforms" className="bg-[#f7f8fa] py-16 sm:py-20 md:py-24 overflow-hidden section-visibility-auto">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 flex flex-col gap-5 px-5 sm:px-6 md:mb-16 md:flex-row md:items-end md:justify-between md:px-10">
          <div className="max-w-2xl">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-orange-600">Explore the ecosystem</p>
            <h2 className="text-3xl font-semibold leading-tight tracking-[-0.04em] text-slate-950 sm:text-4xl md:text-5xl">
              Two suites. <span className="text-[#f26522]">One connected hub.</span>
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
              Explore 24/7 GBS business tools and Mcom commerce and engagement products, connected through one platform.
            </p>
          </div>
          <Link to="/register" className="inline-flex w-fit items-center gap-2 font-semibold text-orange-700 transition-colors hover:text-orange-800">
            Get started <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="space-y-12 md:space-y-14">
          {PRODUCT_SUITES.map((suite) => (
            <ProductMarquee key={suite.id} suite={suite} direction={suite.id === 'mcom' ? 'right' : 'left'} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ProductMarquee({
  suite,
  direction,
}: {
  suite: (typeof PRODUCT_SUITES)[number];
  direction: 'left' | 'right';
}) {
  const renderProducts = (copy: boolean) => suite.products.map((product) => (
    <Link
      key={`${copy ? 'copy-' : ''}${product.id}`}
      to={`/product/${product.id}`}
      aria-label={copy ? undefined : `Learn more about ${product.name}`}
      aria-hidden={copy || undefined}
      tabIndex={copy ? -1 : undefined}
      className="group flex w-[min(86vw,400px)] shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:border-orange-200 hover:shadow-lg hover:shadow-orange-900/5 sm:block sm:w-[310px] sm:rounded-3xl"
    >
      <div className="relative min-h-[150px] w-[42%] shrink-0 overflow-hidden bg-slate-100 sm:aspect-[1.2/1] sm:min-h-0 sm:w-full">
        <img
          src={PRODUCT_IMAGES[product.id].src}
          alt={copy ? '' : PRODUCT_IMAGES[product.id].alt}
          loading="lazy"
          decoding="async"
          className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] ${PRODUCT_IMAGES[product.id].fit ?? ''}`}
        />
        <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-orange-600 shadow-sm transition-transform group-hover:rotate-45 sm:right-3 sm:top-3 sm:h-9 sm:w-9">
          <ArrowUpRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </span>
      </div>
      <div className="flex w-[58%] min-w-0 flex-none flex-col justify-center p-3 sm:w-auto sm:flex-1 sm:p-5">
        <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-orange-600 sm:text-[10px] sm:tracking-[0.16em]">{suite.name}</p>
        <h4 className="mt-1 text-base font-semibold leading-tight tracking-tight text-slate-950 transition-colors group-hover:text-orange-700 sm:text-lg">{product.name}</h4>
        <p className="mt-1 line-clamp-2 text-xs leading-[1.4] text-slate-600 sm:text-sm sm:leading-6">{product.tagline}</p>
        <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-slate-800 group-hover:text-orange-700 sm:mt-4 sm:gap-1.5 sm:text-sm">
          Learn more <ArrowUpRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </span>
      </div>
    </Link>
  ));

  return (
    <section aria-labelledby={`${suite.id}-suite-heading`}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-2 px-5 sm:px-6 md:px-10">
        <div>
          <h3 id={`${suite.id}-suite-heading`} className="text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">{suite.name}</h3>
          <p className="mt-1 text-sm text-slate-600 sm:text-base">{suite.description}</p>
        </div>
        <span className="shrink-0 text-xs font-medium text-slate-500 sm:text-sm">{suite.products.length} products</span>
      </div>

      <div className="product-marquee py-2" role="region" aria-label={`${suite.name} products`}>
        <div className={`product-marquee-track product-marquee-${direction}`}>
          <div className="product-marquee-group">{renderProducts(false)}</div>
          <div className="product-marquee-group" aria-hidden="true">{renderProducts(true)}</div>
        </div>
      </div>
    </section>
  );
}
