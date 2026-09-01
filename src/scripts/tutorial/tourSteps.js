import { EVENTS, STATUS } from 'react-joyride';

export const joyrideOptions = {
  skipBeacon: true,
  overlayClickAction: false,
  dismissKeyAction: false,
  showProgress: true,
  zIndex: 10000,
  primaryColor: '#4a7ab8',
  backgroundColor: 'rgba(32, 48, 72, 0.98)',
  textColor: '#f4f8ff',
  arrowColor: 'rgba(32, 48, 72, 0.98)',
  overlayColor: 'rgba(8, 16, 28, 0.45)',
  buttons: ['back', 'skip', 'primary'],
};

function visibleTarget(selector) {
  return () => {
    const nodes = document.querySelectorAll(selector);
    for (const node of nodes) {
      if (!(node instanceof HTMLElement)) continue;
      let current = node;
      let hidden = false;
      while (current && current !== document.body) {
        const style = getComputedStyle(current);
        if (style.display === 'none' || style.visibility === 'hidden') {
          hidden = true;
          break;
        }
        current = current.parentElement;
      }
      if (!hidden) return node;
    }
    return document.body;
  };
}

const introStep = {
  target: 'body',
  content: 'This short tour shows where to build, check stats, and trigger disasters.',
  placement: 'center',
  skipBeacon: true,
  skipScroll: true,
};

const desktopSteps = [
  introStep,
  {
    target: visibleTarget('#game-header'),
    content: 'Track budget, date, session timer, and population in the header. Login, leaderboard, and help are here too.',
    placement: 'bottom',
    skipBeacon: true,
    skipScroll: true,
    isFixed: true,
  },
  {
    target: visibleTarget('#stats-panel'),
    content: 'Residents, zones, power, resilience, disaster harm, and time remaining appear in this panel.',
    placement: 'left',
    skipBeacon: true,
    skipScroll: true,
    isFixed: true,
  },
  {
    target: visibleTarget('#ui-toolbar'),
    content: 'Select tools to build zones, roads, and power. Click a tool, then click the map.',
    placement: 'right',
    skipBeacon: true,
    skipScroll: true,
    isFixed: true,
  },
  {
    target: visibleTarget('#button-residential'),
    content: 'Residential zones house people. Balance them with jobs and shops.',
    placement: 'right',
    skipBeacon: true,
    skipScroll: true,
    isFixed: true,
  },
  {
    target: visibleTarget('#bottom-right-dock'),
    content: 'Switch camera views and trigger disasters from the bottom-right panel.',
    placement: 'top',
    skipBeacon: true,
    skipScroll: true,
    isFixed: true,
  },
  {
    target: visibleTarget('#settings-btn, #settings-btn-mobile'),
    content: 'Open Settings to replay the guided tour, save your city, and more.',
    placement: 'bottom',
    skipBeacon: true,
    skipScroll: true,
    isFixed: true,
  },
];

const mobileSteps = [
  introStep,
  {
    target: visibleTarget('#game-header'),
    content: 'Your city name, budget, session timer, and population live in the header.',
    placement: 'bottom',
    skipBeacon: true,
    skipScroll: true,
    isFixed: true,
  },
  {
    target: visibleTarget('#mobile-tab-bar'),
    content: 'Use Select, Build, Road, and Menu tabs to play. Tap Build to place zones and utilities.',
    placement: 'top',
    skipBeacon: true,
    skipScroll: true,
    isFixed: true,
  },
  {
    target: visibleTarget('#mobile-tab-bar .mobile-tab[data-tool="build"]'),
    content: 'Open Build to place residential, commercial, industrial zones, power, and more.',
    placement: 'top',
    skipBeacon: true,
    skipScroll: true,
    isFixed: true,
  },
  {
    target: visibleTarget('#mobile-tab-bar .mobile-tab[data-tool="menu"]'),
    content: 'Menu holds camera views, disasters, templates, save/load, and extra tools.',
    placement: 'top',
    skipBeacon: true,
    skipScroll: true,
    isFixed: true,
  },
  {
    target: visibleTarget('#settings-btn, #settings-btn-mobile'),
    content: 'Settings lets you replay this tour, save your city, and toggle tutorial on start.',
    placement: 'bottom',
    skipBeacon: true,
    skipScroll: true,
    isFixed: true,
  },
];

export function buildTourSteps(isMobile) {
  return (isMobile ? mobileSteps : desktopSteps).map((step) => ({
    ...step,
    skipBeacon: true,
  }));
}

export function isTourEndEvent(data) {
  return data?.type === EVENTS.TOUR_END || data?.status === STATUS.FINISHED || data?.status === STATUS.SKIPPED;
}
