import { render, screen } from '@testing-library/react';
import StepIndicator from './StepIndicator';
import { AgentStatus } from '../types';

describe('StepIndicator', () => {
  it('renders all steps', () => {
    render(<StepIndicator currentStatus={AgentStatus.IDLE} />);

    expect(screen.getByText('Analysis')).toBeInTheDocument();
    expect(screen.getByText('Planning')).toBeInTheDocument();
    expect(screen.getByText('Refactoring')).toBeInTheDocument();
    expect(screen.getByText('Verification')).toBeInTheDocument();
  });

  it('highlights the active step', () => {
    // PLANNING is the 2nd step (Analysis -> Planning)
    // If currentStatus is PLANNING, Analysis should be completed, Planning active
    render(<StepIndicator currentStatus={AgentStatus.PLANNING} />);

    const planningStep = screen.getByText('Planning');
    // The parent div of the text has the class logic, but we can check the text color
    expect(planningStep).toHaveClass('text-brand-400');
  });

  it('marks previous steps as completed', () => {
    render(<StepIndicator currentStatus={AgentStatus.PLANNING} />);

    const analysisStep = screen.getByText('Analysis');
    expect(analysisStep).toHaveClass('text-gray-300');
  });
});
