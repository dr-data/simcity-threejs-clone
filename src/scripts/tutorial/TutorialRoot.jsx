import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Joyride, EVENTS } from 'react-joyride';
import { buildTourSteps, joyrideOptions } from './tourSteps.js';

function isMobileLayout() {
  return window.matchMedia('(max-width: 900px)').matches;
}

export function TutorialRoot({ run, onFinish }) {
  const steps = useMemo(() => buildTourSteps(isMobileLayout()), [run]);
  const finishedRef = useRef(false);

  useEffect(() => {
    if (run) finishedRef.current = false;
  }, [run]);

  const handleEvent = useCallback(
    (data) => {
      if (data.type !== EVENTS.TOUR_END || finishedRef.current) return;
      finishedRef.current = true;
      onFinish?.();
    },
    [onFinish]
  );

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      scrollToFirstStep={false}
      options={joyrideOptions}
      onEvent={handleEvent}
      locale={{ back: 'Back', last: 'Done', next: 'Next', skip: 'Skip tour' }}
    />
  );
}
