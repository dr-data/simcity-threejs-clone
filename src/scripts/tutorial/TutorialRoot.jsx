import { useCallback } from 'react';
import { Joyride, STATUS } from 'react-joyride';

const steps = [
  {
    target: '#stats-panel',
    content: 'Track residents, developed zones, power, resilience, and time remaining here.',
    disableBeacon: true,
    placement: 'bottom',
  },
  {
    target: '#ui-toolbar',
    content: 'Select tools to build zones, roads, and power. Tap a tool, then tap the map.',
    placement: 'top',
  },
  {
    target: '#button-residential',
    content: 'Residential zones house people. Balance them with jobs and shops.',
    placement: 'right',
  },
  {
    target: '#bottom-right-dock, #btn-more',
    content: 'Switch camera views and trigger disasters from the bottom panel (desktop) or More menu (mobile).',
    placement: 'top',
  },
  {
    target: '#settings-btn',
    content: 'Open Settings to toggle the guided tour, save your city, and more.',
    placement: 'bottom',
  },
];

export function TutorialRoot({ run, onFinish }) {
  const handleCallback = useCallback(
    (data) => {
      const { status } = data;
      if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
        onFinish?.();
      }
    },
    [onFinish]
  );

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      showProgress
      showSkipButton
      scrollToFirstStep
      disableOverlayClose
      callback={handleCallback}
      locale={{ back: 'Back', close: 'Close', last: 'Done', next: 'Next', skip: 'Skip tour' }}
      styles={{
        options: {
          zIndex: 10000,
          primaryColor: '#3a5177',
          backgroundColor: '#1e2331',
          textColor: '#fff',
          arrowColor: '#1e2331',
        },
        tooltip: { fontSize: 15, padding: 16 },
        buttonNext: { fontSize: 14 },
        buttonBack: { fontSize: 14 },
        buttonSkip: { fontSize: 14 },
      }}
    />
  );
}
