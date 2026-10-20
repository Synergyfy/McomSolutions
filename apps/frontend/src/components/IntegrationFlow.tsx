import {
  ArrowLeftRight,
  Database,
  Link2,
  PanelsTopLeft,
  ShieldCheck,
  Zap,
} from 'lucide-react';

const capabilities = [
  {
    icon: Zap,
    title: 'Instant sync',
    description: 'Keep connected platforms up to date as information changes.',
  },
  {
    icon: ShieldCheck,
    title: 'Secure exchange',
    description: 'Protect data as it moves between trusted services.',
  },
  {
    icon: Database,
    title: 'Open integration',
    description: 'Connect services through APIs, events, and webhooks.',
  },
];

export default function IntegrationFlow() {
  return (
    <section className="py-20 md:py-28 bg-white overflow-hidden section-visibility-auto">
      <div className="max-w-7xl mx-auto px-6">
        <header className="max-w-3xl mx-auto text-center mb-12 md:mb-16">
          <p className="text-xs sm:text-sm font-bold text-orange-600 uppercase tracking-[0.22em] mb-4">
            Seamless connectivity
          </p>
          <h2 className="text-3xl sm:text-4xl md:text-6xl font-bold text-gray-900 mb-5 leading-tight">
            One connection. <span className="text-orange-600">Every platform.</span>
          </h2>
          <p className="text-base sm:text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
            McomQ Link connects core business systems with customer-facing Mcom platforms
            through one secure integration layer.
          </p>
        </header>

        <div className="max-w-6xl mx-auto grid grid-cols-1 items-stretch lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)]">
          <SystemNode
            eyebrow="BUSINESS SYSTEMS"
            title="GBS Core"
            description="Business identity, membership, and operations."
            icon={Database}
            iconClass="bg-orange-100 text-orange-700"
          />

          <FlowConnector />

          <div className="relative flex min-h-52 flex-col items-center justify-center overflow-hidden rounded-3xl bg-slate-950 px-6 py-8 text-center text-white shadow-xl shadow-slate-900/10 sm:min-h-56 sm:px-8">
            <div className="absolute -top-16 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-orange-500/25 blur-3xl" />
            <div className="relative mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500 text-white shadow-lg shadow-orange-950/30">
              <Link2 className="h-7 w-7" />
            </div>
            <p className="relative text-[10px] font-bold uppercase tracking-[0.2em] text-orange-300">
              Integration layer
            </p>
            <h3 className="relative mt-2 text-2xl font-bold sm:text-3xl">McomQ Link</h3>
            <p className="relative mt-2 max-w-xs text-sm leading-relaxed text-slate-300">
              Routes information securely between connected services.
            </p>
          </div>

          <FlowConnector />

          <SystemNode
            eyebrow="CUSTOMER PLATFORMS"
            title="Mcom Suite"
            description="Mall, Rewards, Spin, and connected apps."
            icon={PanelsTopLeft}
            iconClass="bg-cyan-100 text-cyan-700"
          />
        </div>

        <div className="max-w-6xl mx-auto mt-12 grid grid-cols-1 gap-6 border-t border-gray-200 pt-8 sm:grid-cols-3 sm:gap-8 md:mt-16 md:pt-10">
          {capabilities.map(({ icon: Icon, title, description }) => (
            <div key={title} className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-gray-600">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SystemNode({
  eyebrow,
  title,
  description,
  icon: Icon,
  iconClass,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: typeof Database;
  iconClass: string;
}) {
  return (
    <div className="flex min-h-36 items-center gap-4 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:min-h-40 sm:gap-5 sm:p-7">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl sm:h-14 sm:w-14 ${iconClass}`}>
        <Icon className="h-6 w-6 sm:h-7 sm:w-7" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.16em] text-gray-500">
          {eyebrow}
        </p>
        <h3 className="mt-1 text-xl font-bold text-gray-900 sm:text-2xl">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-gray-600">{description}</p>
      </div>
    </div>
  );
}

function FlowConnector() {
  return (
    <div className="flex h-12 items-center justify-center gap-2 px-2 text-orange-600 lg:h-auto lg:min-w-20 lg:gap-1 lg:px-3">
      <span className="h-3 w-px bg-gray-300 lg:h-px lg:w-5" />
      <ArrowLeftRight className="h-5 w-5 rotate-90 lg:rotate-0" aria-hidden="true" />
      <span className="h-3 w-px bg-gray-300 lg:h-px lg:w-5" />
    </div>
  );
}
