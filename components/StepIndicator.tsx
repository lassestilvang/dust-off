import React from 'react';
import { AgentStatus } from '../types';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';

interface StepIndicatorProps {
  currentStatus: AgentStatus;
}

const steps = [
  { id: AgentStatus.ANALYZING, label: 'Analysis' },
  { id: AgentStatus.PLANNING, label: 'Planning' },
  { id: AgentStatus.CONVERTING, label: 'Refactoring' },
  { id: AgentStatus.VERIFYING, label: 'Verification' },
];

const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStatus }) => {
  // Helper to determine step state: 'waiting' | 'active' | 'completed'
  const getStepState = (stepId: AgentStatus) => {
    if (currentStatus === AgentStatus.COMPLETED) return 'completed';
    if (currentStatus === AgentStatus.ERROR) return 'error'; // Simplified

    const statusOrder = [
      AgentStatus.IDLE,
      AgentStatus.ANALYZING,
      AgentStatus.PLANNING,
      AgentStatus.CONVERTING,
      AgentStatus.VERIFYING,
      AgentStatus.COMPLETED,
    ];

    const currentIndex = statusOrder.indexOf(currentStatus);
    const stepIndex = statusOrder.indexOf(stepId);

    if (currentIndex > stepIndex) return 'completed';
    if (currentIndex === stepIndex) return 'active';
    return 'waiting';
  };

  return (
    <div className="flex items-center justify-between w-full max-w-3xl mx-auto mb-8 relative">
      {/* Connecting Line */}
      <div className="absolute top-1/2 left-0 w-full h-0.5 bg-dark-700 -z-10 transform -translate-y-1/2" />

      {steps.map((step) => {
        const state = getStepState(step.id);

        return (
          <div
            key={step.id}
            className="flex flex-col items-center gap-2 bg-dark-900 px-2"
          >
            <div
              className={`
              w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300
              ${state === 'completed' ? 'bg-green-500 border-green-500 text-dark-900' : ''}
              ${state === 'active' ? 'bg-dark-800 border-accent-500 text-accent-500 shadow-[0_0_15px_rgba(245,158,11,0.3)]' : ''}
              ${state === 'waiting' ? 'bg-dark-800 border-dark-600 text-dark-500' : ''}
            `}
            >
              {state === 'completed' && <CheckCircle2 className="w-5 h-5" />}
              {state === 'active' && (
                <Loader2 className="w-5 h-5 animate-spin" />
              )}
              {state === 'waiting' && <Circle className="w-5 h-5" />}
            </div>
            <span
              className={`text-xs font-semibold tracking-wide transition-colors ${
                state === 'active'
                  ? 'text-accent-400'
                  : state === 'completed'
                    ? 'text-green-300'
                    : 'text-dark-500'
              }`}
            >
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default StepIndicator;
