import { useCallback, useMemo } from 'react';
import { Joyride, STATUS } from 'react-joyride';

function isMobileLayout() {
  return window.matchMedia('(max-width: 900px)').matches;
}

function buildSteps() {
  if (isMobileLayout()) {
    return [
      {
        target: '#game-header',
        content: 'Your city name, budget, session timer, and population live in the header.',
        disableBeacon: true,
        placement: 'bottom',
      },
      {
        target: '#mobile-tab-bar',
        content: 'Use Select, Build, Road, and Menu tabs to play. Tap Build to place zones and utilities.',
        placement: 'top',
      },
      {
        target: '#mobile-tab-bar .mobile-tab[data-tool="build"]',
        content: 'Open Build to place residential, commercial, industrial zones, power, and more.',
        placement: 'top',
      },
      {
        target: '#mobile-tab-bar .mobile-tab[data-tool="menu"]',
        content: 'Menu holds camera views, disasters, templates, save/load, and extra tools.',
        placement: 'top',
      },
      {
        target: '#settings-btn, #settings-btn-mobile',
        content: 'Settings lets you replay this tour, save your city, and toggle tutorial on start.',
        placement: 'bottom',
      },
    ];
  }

  return [
    {
      target: '#game-header',
      content: 'Track budget, date, session timer, and population in the header. Login, leaderboard, and help are here too.',
      disableBeacon: true,
      placement: 'bottom',
    },
    {
      target: '#stats-panel',
      content: 'Residents, zones, power, resilience, disaster harm, and time remaining appear in this panel.',
      placement: 'left',
    },
    {
      target: '#ui-toolbar',
      content: 'Select tools to build zones, roads, and power. Click a tool, then click the map.',
      placement: 'right',
    },
    {
      target: '#button-residential',
      content: 'Residential zones house people. Balance them with jobs and shops.',
      placement: 'right',
    },
    {
      target: '#bottom-right-dock',
      content: 'Switch camera views and trigger disasters from the bottom-right panel.',
      placement: 'top',
    },
    {
      target: '#settings-btn, #settings-btn-mobile',
      content: 'Open Settings to replay the guided tour, save your city, and more.',
      placement: 'bottom',
    },
  ];
}

export function TutorialRoot({ run, onFinish }) {
  const steps = useMemo(() => buildSteps(), [run]);

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
      disableScrollParentFix
      callback={handleCallback}
      locale={{ back: 'Back', close: 'Close', last: 'Done', next: 'Next', skip: 'Skip tour' }}
      styles={{
        options: {
          zIndex: 10000,
          primaryColor: '#4a7ab8',
          backgroundColor: 'rgba(32, 48, 72, 0.96)',
          textColor: '#f4f8ff',
          arrowColor: 'rgba(32, 48, 72, 0.96)',
          overlayColor: 'rgba(8, 16, 28, 0.45)',
        },
        tooltip: { fontSize: 16, padding: 16 },
        buttonNext: { fontSize: 15 },
        buttonBack: { fontSize: 15 },
        buttonSkip: { fontSize: 15 },
      }}
    />
  );
}
