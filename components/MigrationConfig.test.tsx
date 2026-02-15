import { render, screen, fireEvent } from '@testing-library/react';
import MigrationConfigModal from './MigrationConfig';

describe('MigrationConfigModal', () => {
  const config = {
    uiFramework: 'tailwind' as const,
    stateManagement: 'context' as const,
    testingLibrary: 'vitest' as const,
  };

  it('updates config selections via onChange', () => {
    const onChange = vi.fn();

    render(
      <MigrationConfigModal
        config={config}
        onChange={onChange}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: /Shadcn\/UI \+ Tailwind/i }),
    );

    expect(onChange).toHaveBeenCalledWith({
      ...config,
      uiFramework: 'shadcn',
    });

    fireEvent.click(screen.getByRole('button', { name: /Zustand/i }));

    expect(onChange).toHaveBeenCalledWith({
      ...config,
      stateManagement: 'zustand',
    });
  });

  it('invokes cancel and confirm handlers', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();

    render(
      <MigrationConfigModal
        config={config}
        onChange={vi.fn()}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: /Start Migration/i }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
