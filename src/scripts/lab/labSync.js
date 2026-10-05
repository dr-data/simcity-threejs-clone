import { authClient } from '../auth/authClient.js';
import { createLabState } from './labState.js';

const LOCAL_KEY = 'classroom-lab-shared-v1';
const CHANNEL_NAME = 'classroom-lab';

function readLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return createLabState();
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : createLabState();
  } catch {
    return createLabState();
  }
}

function writeLocal(state) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
}

export function preferLabState(current, incoming) {
  if (!incoming) return current || createLabState();
  if (!current) return incoming;
  if ((incoming.updatedAt || 0) >= (current.updatedAt || 0)) return incoming;
  return current;
}

export const labSync = {
  channel: typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL_NAME) : null,

  readLocal,

  async fetchState() {
    const data = await authClient.labState();
    return data.state;
  },

  async publish(state) {
    writeLocal(state);
    this.channel?.postMessage(state);
    try {
      await authClient.adminSaveLab(state);
      return { shared: true };
    } catch {
      return { shared: false };
    }
  },

  remember(state) {
    writeLocal(state);
  },
};
