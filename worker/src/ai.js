/**
 * Lightweight Workers AI helpers for classroom SimCity.
 * Uses small model + short prompts to keep neuron usage low.
 */

import { fallbackTip } from './aiTips.js';

const MODEL = '@cf/meta/llama-3.2-1b-instruct';
const GUEST_DAILY_LIMIT = 3;
const USER_DAILY_LIMIT = 12;

function hashIp(ip) {
  // Simple hash for guest quota (not cryptographic)
  let h = 0;
  for (let i = 0; i < ip.length; i++) {
    h = (Math.imul(31, h) + ip.charCodeAt(i)) | 0;
  }
  return `ip_${h}`;
}

export async function checkAiQuota(env, userId, ip) {
  const date = new Date().toISOString().slice(0, 10);
  const limit = userId ? USER_DAILY_LIMIT : GUEST_DAILY_LIMIT;
  const key = userId ? `user_${userId}` : hashIp(ip || 'unknown');

  let row = await env.DB.prepare(
    'SELECT count FROM ai_usage WHERE usage_key = ? AND date = ?'
  )
    .bind(key, date)
    .first();

  const count = row?.count ?? 0;
  if (count >= limit) {
    return { allowed: false, remaining: 0, limit };
  }
  return { allowed: true, remaining: limit - count, limit };
}

export async function incrementAiQuota(env, userId, ip) {
  const date = new Date().toISOString().slice(0, 10);
  const key = userId ? `user_${userId}` : hashIp(ip || 'unknown');
  await env.DB.prepare(
    `INSERT INTO ai_usage (usage_key, user_id, date, count) VALUES (?, ?, ?, 1)
     ON CONFLICT(usage_key, date) DO UPDATE SET count = count + 1`
  )
    .bind(key, userId || null, date)
    .run();
}

async function runModel(env, userPrompt, maxTokens = 100, system) {
  if (!env.AI) {
    throw new Error('Workers AI binding not configured');
  }
  const result = await env.AI.run(MODEL, {
    messages: [
      {
        role: 'system',
        content:
          system ||
          'You are a concise urban planning tutor for high-school students playing a city-building game. ' +
            'Use plain language. No markdown, bullets, or numbered lists. Max 2 short sentences.',
      },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: maxTokens,
  });
  const text = result?.response ?? result?.result?.response ?? '';
  return String(text).trim().replace(/^["']|["']$/g, '');
}

export async function generateTip(env, stats) {
  try {
    const prompt = `City stats: ${stats.residents} residents, ${stats.developed_zones} developed zones, ` +
      `${stats.disaster_resilience}% disaster resilience, power ${stats.power_capacity}/${stats.power_demand} kW. ` +
      `Give one practical tip about zoning, power, or disaster preparedness.`;
    const text = await runModel(env, prompt, 80);
    if (text && text.length > 16) return text;
  } catch (error) {
    console.error('AI tip model failed', error);
  }
  return fallbackTip(stats);
}

export async function generateSessionReview(env, stats) {
  const prompt = `Session ended. Score ${stats.score}, ${stats.residents} residents, ` +
    `${stats.developed_zones} zones, ${stats.disaster_resilience}% resilience, ` +
    `${stats.disasters_survived} disasters survived. ` +
    'Reply in this exact format:\nQUESTIONS: (two short discussion questions, separated by |)\nREPORT: (two sentences mayor report)';
  const raw = await runModel(env, prompt, 150);
  const qMatch = raw.match(/QUESTIONS:\s*(.+?)(?:\nREPORT:|$)/is);
  const rMatch = raw.match(/REPORT:\s*(.+)/is);
  const questions = qMatch
    ? qMatch[1].split('|').map((s) => s.trim()).filter((s) => s.length > 5).slice(0, 2)
    : [];
  const report = rMatch ? rMatch[1].trim() : '';
  return { questions, report };
}

const CITY_STYLES = [
  'grid-quarters',
  'harbor-spine',
  'industrial-ring',
  'campus',
  'twin-cores',
  'sprawl',
];

export function fallbackCityPlan() {
  const seed = Math.floor(Math.random() * 1e9) + 1;
  return {
    style: CITY_STYLES[seed % CITY_STYLES.length],
    seed,
    flavor: 'A mixed classroom layout.',
  };
}

export async function generateCityPlan(env, { size, density } = {}) {
  try {
    const text = await runModel(
      env,
      `Pick one layout style from: ${CITY_STYLES.join(', ')}. Size ${size || 16}, density ${density || 0.3}. Reply JSON only: {"style":"harbor-spine","seed":12345,"flavor":"short phrase"}`,
      90,
      'You pick city layout styles for a classroom disaster drill. Reply with JSON only. No markdown.'
    );
    const match = String(text).match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      const style = CITY_STYLES.includes(parsed.style) ? parsed.style : fallbackCityPlan().style;
      const seed = Number(parsed.seed) > 0 ? Math.floor(Number(parsed.seed)) : Math.floor(Math.random() * 1e9);
      return { style, seed, flavor: String(parsed.flavor || '').slice(0, 80) };
    }
  } catch (error) {
    console.error('AI city plan failed', error);
  }
  return fallbackCityPlan();
}
