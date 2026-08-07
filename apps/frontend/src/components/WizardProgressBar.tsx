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

      <div className="hidden sm:flex items-center justify-between">
        {steps.map((step, i) => {
          const isCompleted = completedSteps.has(i) || i < currentStep;
          const isCurrent = i === currentStep;
          const isUpcoming = i > currentStep;

          return (
            <div key={i} className="flex flex-col items-center relative flex-1">
              <div className="flex items-center w-full">
                <div
                  className={`z-10 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                    isCompleted
                      ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30'
                      : isCurrent
                        ? 'bg-orange-100 text-orange-600 border-2 border-orange-500 shadow-md'
                        : 'bg-gray-100 text-gray-400 border border-gray-200'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4" strokeWidth={3} />
                  ) : (
                    i + 1
                  )}
                </div>
                {i < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 ${
                    completedSteps.has(i) ? 'bg-orange-500' : 'bg-gray-200'
                  }`} />
                )}
              </div>
              <span className={`mt-2 text-[10px] font-semibold text-center leading-tight max-w-[80px] ${
                isCurrent ? 'text-orange-600' : isCompleted ? 'text-gray-700' : 'text-gray-400'
              }`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="sm:hidden">
        <p className="text-sm font-bold text-gray-900 text-center">
          {steps[currentStep]?.label || `Step ${currentStep + 1}`}
        </p>
        <p className="text-xs text-gray-500 text-center mt-1">
          {steps[currentStep]?.description || ''}
        </p>
      </div>
    </div>
  );
}