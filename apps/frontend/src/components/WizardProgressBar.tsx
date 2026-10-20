import { motion } from 'motion/react';
import { Check } from 'lucide-react';

interface WizardStep {
  label: string;
  description: string;
}

interface WizardProgressBarProps {
  steps: WizardStep[];
  currentStep: number;
  completedSteps: Set<number>;
}

export default function WizardProgressBar({ steps, currentStep, completedSteps }: WizardProgressBarProps) {
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <div className="w-full mb-8">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
          Step {currentStep + 1} of {steps.length}
        </span>
        <span className="text-xs font-bold text-orange-600 uppercase tracking-wider">
          {Math.round(progress)}% Complete
        </span>
      </div>

      <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-6">
        <motion.div
          className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>

      <div className="hidden sm:flex w-full items-start">
        {steps.map((step, i) => {
          const isCompleted = completedSteps.has(i) || i < currentStep;
          const isCurrent = i === currentStep;

          return (
            <div key={i} className="relative flex min-w-0 flex-1 flex-col items-center text-center">
              {i < steps.length - 1 && (
                <div
                  aria-hidden="true"
                  className={`absolute left-1/2 top-4 h-0.5 w-full ${completedSteps.has(i) || i < currentStep ? 'bg-orange-500' : 'bg-gray-200'}`}
                />
              )}
              <div
                className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ${isCompleted
                    ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30'
                    : isCurrent
                      ? 'border-2 border-orange-500 bg-orange-100 text-orange-600 shadow-md'
                      : 'border border-gray-200 bg-gray-100 text-gray-500'
                  }`}
              >
                {isCompleted ? <Check className="h-4 w-4" strokeWidth={3} /> : i + 1}
              </div>
              <span className={`mt-2 hidden max-w-20 text-center text-[10px] font-semibold leading-tight md:block ${isCurrent ? 'text-orange-600' : isCompleted ? 'text-gray-700' : 'text-gray-500'
                }`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex w-full items-center sm:hidden" role="group" aria-label={`Step ${currentStep + 1} of ${steps.length}`}>
        {steps.map((step, i) => {
          const isCompleted = completedSteps.has(i) || i < currentStep;
          const isCurrent = i === currentStep;

          return (
            <div key={step.label} className="relative flex min-w-0 flex-1 justify-center">
              {i < steps.length - 1 && (
                <div
                  aria-hidden="true"
                  className={`absolute left-1/2 top-3 h-0.5 w-full ${isCompleted ? 'bg-orange-500' : 'bg-gray-200'}`}
                />
              )}
              <motion.div
                aria-current={isCurrent ? 'step' : undefined}
                animate={{ scale: isCurrent ? 1.12 : 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 24 }}
                className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${isCompleted
                  ? 'bg-orange-500 text-white'
                  : isCurrent
                    ? 'border-2 border-orange-500 bg-white text-orange-600 shadow-sm shadow-orange-500/20'
                    : 'border border-gray-200 bg-white text-gray-500'
                  }`}
              >
                {isCompleted ? <Check className="h-3 w-3" strokeWidth={3} /> : i + 1}
              </motion.div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
