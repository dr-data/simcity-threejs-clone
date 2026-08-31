import { normalizeHsuId } from '../auth/hsuId.js';

export const CITY_FILE_KIND = 'classroom-simcity';

export function buildCityFile({ city, budget, ownerId }) {
  return {
    kind: CITY_FILE_KIND,
    version: 1,
    exportedAt: new Date().toISOString(),
    ownerId: ownerId ? normalizeHsuId(ownerId) : 'guest',
    budget: Number(budget) || 0,
    city,
  };
}

export function parseCityFile(data) {
  if (!data || data.kind !== CITY_FILE_KIND) {
    throw new Error('Not a Classroom SimCity city file');
  }
  if (!data.city) {
    throw new Error('City file is missing map data');
  }
  return data;
}

export function isForeignCityFile(file, currentUsername) {
  const owner = normalizeHsuId(file?.ownerId);
  if (!owner || owner === 'guest') return false;
  if (!currentUsername) return true;
  return owner !== normalizeHsuId(currentUsername);
}
