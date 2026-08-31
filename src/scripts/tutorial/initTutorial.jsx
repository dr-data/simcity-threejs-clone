import { createRoot } from 'react-dom/client';
import { TutorialRoot } from './TutorialRoot.jsx';

let root = null;
let running = false;
let finishCallback = null;
let tourGeneration = 0;

function render() {
  if (!root) return;
  root.render(
    <TutorialRoot
      key={tourGeneration}
      run={running}
      onFinish={() => {
        running = false;
        finishCallback?.();
        finishCallback = null;
        render();
      }}
    />
  );
}

export function initTutorial() {
  const mount = document.getElementById('tutorial-root');
  if (!mount || root) return;
  root = createRoot(mount);
  render();
}

export function startGuidedTour(onFinish) {
  if (!root) initTutorial();
  finishCallback = onFinish;
  running = true;
  tourGeneration += 1;
  render();
}

export function isTourRunning() {
  return running;
}
