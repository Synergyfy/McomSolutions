import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'business_onboarding_draft';

export interface WizardState {
  step: number;
  wizardStepIndex: number;
  formData: Record<string, any>;
  completedWizardSteps: number[];
}

export function useOnboardingWizard(totalWizardSteps: number) {
  const [wizardStepIndex, setWizardStepIndex] = useState(0);
  const [completedWizardSteps, setCompletedWizardSteps] = useState<Set<number>>(new Set());
  const [restoreToast, setRestoreToast] = useState(false);

  // Load persisted state on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: WizardState = JSON.parse(saved);
        if (parsed.wizardStepIndex !== undefined) {
          setWizardStepIndex(parsed.wizardStepIndex);
          setRestoreToast(true);
          setTimeout(() => setRestoreToast(false), 4000);
        }
        if (parsed.completedWizardSteps) {
          setCompletedWizardSteps(new Set(parsed.completedWizardSteps));
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const persist = useCallback((step: number, completed: Set<number>, data?: Record<string, any>) => {
    try {
      const state: WizardState = {
        step: 0,
        wizardStepIndex: step,
        formData: data || {},
        completedWizardSteps: [...completed],
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, []);

  const goToWizardStep = useCallback((index: number) => {
    setWizardStepIndex(index);
    setCompletedWizardSteps(prev => {
      const next = new Set(prev);
      next.add(index);
      persist(index, next);
      return next;
    });
  }, [persist]);

  const completeWizardStep = useCallback((index: number) => {
    setCompletedWizardSteps(prev => {
      const next = new Set(prev);
      next.add(index);
      return next;
    });
  }, []);

  const clearPersistedState = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const nextWizardStep = useCallback(() => {
    setWizardStepIndex(prev => {
      const next = Math.min(prev + 1, totalWizardSteps - 1);
      setCompletedWizardSteps(comp => {
        const updated = new Set(comp);
        updated.add(prev);
        persist(next, updated);
        return updated;
      });
      return next;
    });
  }, [totalWizardSteps, persist]);

  const prevWizardStep = useCallback(() => {
    setWizardStepIndex(prev => Math.max(prev - 1, 0));
  }, []);

  const resetWizard = useCallback(() => {
    setWizardStepIndex(0);
    setCompletedWizardSteps(new Set());
    clearPersistedState();
  }, [clearPersistedState]);

  return {
    wizardStepIndex,
    setWizardStepIndex,
    completedWizardSteps,
    goToWizardStep,
    completeWizardStep,
    nextWizardStep,
    prevWizardStep,
    resetWizard,
    restoreToast,
    clearPersistedState,
    persist,
  };
}