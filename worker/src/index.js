/**
 * Classroom SimCity API — Cloudflare Worker + D1
 *
 * Auth choice: email/username + password with D1 (SQLite).
 * D1 fits users, stats, sessions, and audit logs without extra services.
 */

import {
  hashPassword,
  generateSalt,
  verifyPassword,
  generateToken,
  createSessionToken,
  parseSessionToken,
  getSessionFromRequest,
  sessionCookieHeader,
  clearSessionCookie,
} from './auth.js';
import {
  checkAiQuota,
  incrementAiQuota,
  generateTip,
  generateSessionReview,
} from './ai.js';
import { corsHeaders as buildCorsHeaders } from './cors.js';

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

async function getUserFromSession(request, env) {
  const token = getSessionFromRequest(request);
  if (!token) return null;
  const session = await parseSessionToken(token, env.SESSION_SECRET);
  if (!session) return null;
  const user = await env.DB.prepare(
    'SELECT id, username, email, is_admin, is_active FROM users WHERE id = ?'
  )
    .bind(session.userId)
    .first();
  if (!user || !user.is_active) return null;
  return user;
}

function requireAuth(user) {
  if (!user) {
    return json({ error: 'Unauthorized' }, 401);
  }
  return null;
}

function requireAdmin(user) {
  const authErr = requireAuth(user);
  if (authErr) return authErr;
  if (!user.is_admin) {
    return json({ error: 'Forbidden — admin only' }, 403);
  }
  return null;
}

async function auditLog(env, adminId, targetId, action, changes, note) {
  await env.DB.prepare(
    `INSERT INTO admin_audit_log (admin_user_id, target_user_id, action, changes, note)
     VALUES (?, ?, ?, ?, ?)`
  )
    .bind(adminId, targetId, action, JSON.stringify(changes), note || null)
    .run();
}

// Simple in-memory rate limit per IP (resets on worker cold start)
const rateLimits = new Map();
function checkRateLimit(request, key, max = 60, windowMs = 60000) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const id = `${ip}:${key}`;
  const now = Date.now();
  const entry = rateLimits.get(id) || { count: 0, start: now };
  if (now - entry.start > windowMs) {
    entry.count = 0;
    entry.start = now;
  }
  entry.count++;
  rateLimits.set(id, entry);
  return entry.count <= max;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const corsHeaders = buildCorsHeaders(request, env);

    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      let response;

      // --- Auth ---
      if (path === '/api/auth/signup' && method === 'POST') {
        if (!checkRateLimit(request, 'signup', 10)) {
          response = json({ error: 'Too many requests' }, 429);
        } else {
          const body = await request.json();
          const username = (body.username || '').trim();
          const email = (body.email || '').trim() || null;
          const password = body.password || '';
          if (!username || username.length < 3 || password.length < 6) {
            response = json({ error: 'Username (3+) and password (6+) required' }, 400);
          } else {
            const existing = await env.DB.prepare('SELECT id FROM users WHERE username = ?')
              .bind(username)
              .first();
            if (existing) {
              response = json({ error: 'Username already taken' }, 409);
            } else {
              const salt = generateSalt();
              const passwordHash = await hashPassword(password, salt);
              const result = await env.DB.prepare(
                `INSERT INTO users (username, email, password_hash, password_salt) VALUES (?, ?, ?, ?)`
              )
                .bind(username, email, passwordHash, salt)
                .run();
              const userId = result.meta.last_row_id;
              await env.DB.prepare('INSERT INTO player_stats (user_id) VALUES (?)')
                .bind(userId)
                .run();
              const sessionToken = await createSessionToken(userId, env.SESSION_SECRET);
              response = json(
                { user: { id: userId, username, email, is_admin: 0 } },
                201,
                { 'Set-Cookie': sessionCookieHeader(sessionToken), ...corsHeaders }
              );
            }
          }
        }
      } else if (path === '/api/auth/login' && method === 'POST') {
        if (!checkRateLimit(request, 'login', 20)) {
          response = json({ error: 'Too many requests' }, 429);
        } else {
          const body = await request.json();
          const username = (body.username || '').trim();
          const password = body.password || '';
          const user = await env.DB.prepare(
            'SELECT * FROM users WHERE username = ? AND is_active = 1'
          )
            .bind(username)
            .first();
          if (!user || !(await verifyPassword(password, user.password_salt, user.password_hash))) {
            response = json({ error: 'Invalid credentials' }, 401);
          } else {
            const sessionToken = await createSessionToken(user.id, env.SESSION_SECRET);
            response = json(
              {
                user: {
                  id: user.id,
                  username: user.username,
                  email: user.email,
                  is_admin: user.is_admin,
                },
              },
              200,
              { 'Set-Cookie': sessionCookieHeader(sessionToken), ...corsHeaders }
            );
          }
        }
      } else if (path === '/api/auth/logout' && method === 'POST') {
        response = json({ ok: true }, 200, {
          'Set-Cookie': clearSessionCookie(),
          ...corsHeaders,
        });
      } else if (path === '/api/auth/reset-request' && method === 'POST') {
        const body = await request.json();
        const email = (body.email || '').trim();
        const user = await env.DB.prepare('SELECT id FROM users WHERE email = ? AND is_active = 1')
          .bind(email)
          .first();
        if (user) {
          const token = generateToken();
          const expires = new Date(Date.now() + 3600000).toISOString();
          await env.DB.prepare(
            `INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)`
          )
            .bind(user.id, token, expires)
            .run();
          // In production, send email. For classroom use, return token in dev mode.
          const devMode = env.DEV_MODE === 'true';
          response = json(
            devMode
              ? { ok: true, resetToken: token, message: 'Use token at /api/auth/reset' }
              : { ok: true, message: 'If the email exists, a reset link was sent.' },
            200,
            corsHeaders
          );
        } else {
          response = json({ ok: true, message: 'If the email exists, a reset link was sent.' }, 200, corsHeaders);
        }
      } else if (path === '/api/auth/reset' && method === 'POST') {
        const body = await request.json();
        const token = body.token || '';
        const newPassword = body.password || '';
        if (!token || newPassword.length < 6) {
          response = json({ error: 'Token and password (6+) required' }, 400);
        } else {
          const row = await env.DB.prepare(
            `SELECT * FROM password_reset_tokens WHERE token = ? AND used = 0 AND expires_at > datetime('now')`
          )
            .bind(token)
            .first();
          if (!row) {
            response = json({ error: 'Invalid or expired token' }, 400);
          } else {
            const salt = generateSalt();
            const passwordHash = await hashPassword(newPassword, salt);
            await env.DB.prepare(
              'UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?'
            )
              .bind(passwordHash, salt, row.user_id)
              .run();
            await env.DB.prepare('UPDATE password_reset_tokens SET used = 1 WHERE id = ?')
              .bind(row.id)
              .run();
            response = json({ ok: true }, 200, corsHeaders);
          }
        }
      } else if (path === '/api/me' && method === 'GET') {
        const user = await getUserFromSession(request, env);
        const err = requireAuth(user);
        if (err) response = err;
        else {
          const stats = await env.DB.prepare('SELECT * FROM player_stats WHERE user_id = ?')
            .bind(user.id)
            .first();
          response = json({ user, stats }, 200, corsHeaders);
        }
      } else if (path === '/api/scores' && method === 'POST') {
        const user = await getUserFromSession(request, env);
        const err = requireAuth(user);
        if (err) response = err;
        else {
          const body = await request.json();
          const score = Math.max(0, parseInt(body.score, 10) || 0);
          const residents = Math.max(0, parseInt(body.residents, 10) || 0);
          const developedZones = Math.max(0, parseInt(body.developed_zones, 10) || 0);
          const disasterResilience = Math.max(0, Math.min(100, parseFloat(body.disaster_resilience) || 0));
          const disastersSurvived = Math.max(0, parseInt(body.disasters_survived, 10) || 0);
          const durationSeconds = Math.max(0, parseInt(body.duration_seconds, 10) || 0);
          const casualties = Math.max(0, parseInt(body.casualties, 10) || 0);
          const injured = Math.max(0, parseInt(body.injured, 10) || 0);
          const disasterCost = Math.max(0, parseInt(body.disaster_cost, 10) || 0);
          const zonesDamaged = Math.max(0, parseInt(body.zones_damaged, 10) || 0);
          const disasterLog = Array.isArray(body.disaster_log) ? body.disaster_log.slice(0, 40) : [];

          let sessionId = null;
          try {
            const insert = await env.DB.prepare(
              `INSERT INTO game_sessions (user_id, score, residents, developed_zones, disaster_resilience, disasters_survived, casualties, injured, disaster_cost, zones_damaged, duration_seconds, disaster_log)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            )
              .bind(
                user.id,
                score,
                residents,
                developedZones,
                disasterResilience,
                disastersSurvived,
                casualties,
                injured,
                disasterCost,
                zonesDamaged,
                durationSeconds,
                JSON.stringify(disasterLog)
              )
              .run();
            sessionId = insert.meta.last_row_id;
          } catch {
            const insert = await env.DB.prepare(
              `INSERT INTO game_sessions (user_id, score, residents, developed_zones, disaster_resilience, disasters_survived, casualties, injured, disaster_cost, zones_damaged, duration_seconds)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            )
              .bind(
                user.id,
                score,
                residents,
                developedZones,
                disasterResilience,
                disastersSurvived,
                casualties,
                injured,
                disasterCost,
                zonesDamaged,
                durationSeconds
              )
              .run();
            sessionId = insert.meta.last_row_id;
          }
          try {
            for (const event of disasterLog) {
              await env.DB.prepare(
                `INSERT INTO disaster_events (session_id, user_id, source, type, level, casualties, injured, cost, zones_damaged, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
              )
                .bind(
                  sessionId,
                  user.id,
                  String(event.source || 'unknown').slice(0, 20),
                  String(event.type || 'unknown').slice(0, 40),
                  String(event.level || 'moderate').slice(0, 20),
                  Math.max(0, parseInt(event.killed, 10) || 0),
                  Math.max(0, parseInt(event.injured, 10) || 0),
                  Math.max(0, parseInt(event.repairCost, 10) || 0),
                  Math.max(0, parseInt(event.zonesDamaged, 10) || 0),
                  event.at ? new Date(event.at).toISOString() : new Date().toISOString()
                )
                .run();
            }
          } catch (e) {
            console.error('disaster_events insert', e);
          }

          const stats = await env.DB.prepare('SELECT * FROM player_stats WHERE user_id = ?')
            .bind(user.id)
            .first();
          const updates = {
            total_sessions: stats.total_sessions + 1,
            best_score: Math.max(stats.best_score, score),
            best_residents: Math.max(stats.best_residents, residents),
            best_developed_zones: Math.max(stats.best_developed_zones, developedZones),
            best_disaster_resilience: Math.max(stats.best_disaster_resilience, disasterResilience),
            total_casualties: (stats.total_casualties || 0) + casualties,
            total_injured: (stats.total_injured || 0) + injured,
            total_disaster_cost: (stats.total_disaster_cost || 0) + disasterCost,
            total_zones_damaged: (stats.total_zones_damaged || 0) + zonesDamaged,
            last_played: new Date().toISOString(),
          };
          await env.DB.prepare(
            `UPDATE player_stats SET total_sessions = ?, best_score = ?, best_residents = ?,
             best_developed_zones = ?, best_disaster_resilience = ?, total_casualties = ?,
             total_injured = ?, total_disaster_cost = ?, total_zones_damaged = ?, last_played = ? WHERE user_id = ?`
          )
            .bind(
              updates.total_sessions,
              updates.best_score,
              updates.best_residents,
              updates.best_developed_zones,
              updates.best_disaster_resilience,
              updates.total_casualties,
              updates.total_injured,
              updates.total_disaster_cost,
              updates.total_zones_damaged,
              updates.last_played,
              user.id
            )
            .run();
          response = json({ ok: true, stats: { ...stats, ...updates } }, 200, corsHeaders);
        }
      } else if (path === '/api/leaderboard' && method === 'GET') {
        const hidden = await env.DB.prepare('SELECT value FROM app_settings WHERE key = ?')
          .bind('leaderboard_hidden')
          .first();
        if (hidden?.value === 'true') {
          response = json({ hidden: true, leaderboard: [] }, 200, corsHeaders);
        } else {
          const rows = await env.DB.prepare(
            `SELECT u.id, u.username, ps.best_score, ps.best_residents,
                    ps.best_developed_zones, ps.best_disaster_resilience, ps.total_sessions,
                    ps.total_casualties, ps.total_injured, ps.total_disaster_cost,
                    ps.total_zones_damaged, ps.last_played
             FROM users u JOIN player_stats ps ON u.id = ps.user_id
             WHERE u.is_active = 1
             ORDER BY ps.best_score DESC LIMIT 100`
          ).all();
          response = json({ hidden: false, leaderboard: rows.results }, 200, corsHeaders);
        }
      } else if (path === '/api/disaster-log' && method === 'GET') {
        let events = [];
        try {
          const rows = await env.DB.prepare(
            `SELECT de.id, de.source, de.type, de.level, de.casualties, de.injured, de.cost,
                    de.zones_damaged, de.created_at, u.username
             FROM disaster_events de
             JOIN users u ON u.id = de.user_id
             WHERE u.is_active = 1
             ORDER BY de.id DESC LIMIT 50`
          ).all();
          events = rows.results || [];
        } catch {
          events = [];
        }
        response = json({ events }, 200, corsHeaders);
      } else if (path.startsWith('/api/admin/')) {
        const user = await getUserFromSession(request, env);
        const adminErr = requireAdmin(user);
        if (adminErr) {
          response = adminErr;
        } else if (!checkRateLimit(request, 'admin', 120)) {
          response = json({ error: 'Too many requests' }, 429);
        } else if (path === '/api/admin/users' && method === 'GET') {
          const search = url.searchParams.get('search') || '';
          const sort = url.searchParams.get('sort') || 'best_score';
          const order = url.searchParams.get('order') === 'asc' ? 'ASC' : 'DESC';
          const allowedSort = [
            'username',
            'best_score',
            'best_residents',
            'best_developed_zones',
            'best_disaster_resilience',
            'total_sessions',
            'last_played',
          ];
          const sortCol = allowedSort.includes(sort) ? sort : 'best_score';
          let query = `
            SELECT u.id, u.username, u.email, u.is_admin, u.is_active,
                   ps.best_score, ps.best_residents, ps.best_developed_zones,
                   ps.best_disaster_resilience, ps.total_sessions, ps.last_played
            FROM users u JOIN player_stats ps ON u.id = ps.user_id
          `;
          const binds = [];
          if (search) {
            query += ' WHERE u.username LIKE ? OR u.email LIKE ?';
            binds.push(`%${search}%`, `%${search}%`);
          }
          query += ` ORDER BY ${sortCol === 'username' ? 'u.username' : `ps.${sortCol}`} ${order}`;
          const stmt = env.DB.prepare(query);
          const rows = binds.length ? await stmt.bind(...binds).all() : await stmt.all();
          response = json({ users: rows.results }, 200, corsHeaders);
        } else if (path.match(/^\/api\/admin\/users\/\d+$/) && method === 'GET') {
          const userId = parseInt(path.split('/').pop(), 10);
          const u = await env.DB.prepare(
            `SELECT u.*, ps.* FROM users u JOIN player_stats ps ON u.id = ps.user_id WHERE u.id = ?`
          )
            .bind(userId)
            .first();
          const sessions = await env.DB.prepare(
            'SELECT * FROM game_sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 20'
          )
            .bind(userId)
            .all();
          response = u
            ? json({ user: u, sessions: sessions.results }, 200, corsHeaders)
            : json({ error: 'Not found' }, 404);
        } else if (path.match(/^\/api\/admin\/users\/\d+$/) && method === 'PUT') {
          const targetId = parseInt(path.split('/').pop(), 10);
          const body = await request.json();
          const oldStats = await env.DB.prepare('SELECT * FROM player_stats WHERE user_id = ?')
            .bind(targetId)
            .first();
          if (!oldStats) {
            response = json({ error: 'User not found' }, 404);
          } else {
            const fields = [
              'total_sessions',
              'best_score',
              'best_residents',
              'best_developed_zones',
              'best_disaster_resilience',
            ];
            const changes = {};
            const values = {};
            for (const f of fields) {
              if (body[f] !== undefined) {
                changes[f] = { old: oldStats[f], new: body[f] };
                values[f] = body[f];
              }
            }
            if (Object.keys(values).length === 0) {
              response = json({ error: 'No valid fields to update' }, 400);
            } else {
              await env.DB.prepare(
                `UPDATE player_stats SET
                  total_sessions = COALESCE(?, total_sessions),
                  best_score = COALESCE(?, best_score),
                  best_residents = COALESCE(?, best_residents),
                  best_developed_zones = COALESCE(?, best_developed_zones),
                  best_disaster_resilience = COALESCE(?, best_disaster_resilience)
                 WHERE user_id = ?`
              )
                .bind(
                  values.total_sessions,
                  values.best_score,
                  values.best_residents,
                  values.best_developed_zones,
                  values.best_disaster_resilience,
                  targetId
                )
                .run();
              await auditLog(env, user.id, targetId, 'update_stats', changes, body.note);
              response = json({ ok: true }, 200, corsHeaders);
            }
          }
        } else if (path.match(/^\/api\/admin\/users\/\d+$/) && method === 'DELETE') {
          const targetId = parseInt(path.split('/').pop(), 10);
          const soft = url.searchParams.get('soft') === 'true';
          let deleteNote = null;
          try {
            const deleteBody = await request.json();
            deleteNote = deleteBody?.note;
          } catch {
            /* no body */
          }
          if (soft) {
            await env.DB.prepare('UPDATE users SET is_active = 0 WHERE id = ?').bind(targetId).run();
            await auditLog(env, user.id, targetId, 'soft_delete', {}, deleteNote);
          } else {
            await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(targetId).run();
            await auditLog(env, user.id, targetId, 'delete', {}, null);
          }
          response = json({ ok: true }, 200, corsHeaders);
        } else if (path === '/api/admin/leaderboard/reset' && method === 'POST') {
          await env.DB.prepare(
            `UPDATE player_stats SET best_score = 0, best_residents = 0,
             best_developed_zones = 0, best_disaster_resilience = 0, total_sessions = 0,
             total_casualties = 0, total_injured = 0, total_disaster_cost = 0, total_zones_damaged = 0`
          ).run();
          await env.DB.prepare('DELETE FROM game_sessions').run();
          await auditLog(env, user.id, null, 'reset_leaderboard', {}, null);
          response = json({ ok: true }, 200, corsHeaders);
        } else if (path === '/api/admin/leaderboard/hide' && method === 'POST') {
          const body = await request.json();
          await env.DB.prepare(
            'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)'
          )
            .bind('leaderboard_hidden', body.hidden ? 'true' : 'false')
            .run();
          await auditLog(env, user.id, null, 'toggle_leaderboard', { hidden: body.hidden }, null);
          response = json({ ok: true }, 200, corsHeaders);
        } else if (path === '/api/admin/audit-log' && method === 'GET') {
          const rows = await env.DB.prepare(
            `SELECT a.*, u.username as admin_username
             FROM admin_audit_log a LEFT JOIN users u ON a.admin_user_id = u.id
             ORDER BY a.created_at DESC LIMIT 100`
          ).all();
          response = json({ log: rows.results }, 200, corsHeaders);
        } else if (path === '/api/admin/sessions' && method === 'GET') {
          const userId = url.searchParams.get('user_id');
          let rows;
          if (userId) {
            rows = await env.DB.prepare(
              'SELECT * FROM game_sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
            )
              .bind(parseInt(userId, 10))
              .all();
          } else {
            rows = await env.DB.prepare(
              'SELECT * FROM game_sessions ORDER BY created_at DESC LIMIT 50'
            ).all();
          }
          response = json({ sessions: rows.results }, 200, corsHeaders);
        } else if (path.match(/^\/api\/admin\/sessions\/\d+$/) && method === 'DELETE') {
          const sessionId = parseInt(path.split('/').pop(), 10);
          await env.DB.prepare('DELETE FROM game_sessions WHERE id = ?').bind(sessionId).run();
          await auditLog(env, user.id, null, 'delete_session', { sessionId }, null);
          response = json({ ok: true }, 200, corsHeaders);
        } else {
          response = json({ error: 'Not found' }, 404);
        }
      } else if (path.startsWith('/api/ai/')) {
        if (env.AI_ENABLED !== 'true') {
          response = json({ error: 'AI features disabled' }, 503, corsHeaders);
        } else if (!checkRateLimit(request, 'ai', 30)) {
          response = json({ error: 'Too many requests' }, 429, corsHeaders);
        } else {
          const user = await getUserFromSession(request, env);
          const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
          const quota = await checkAiQuota(env, user?.id, ip);
          if (!quota.allowed) {
            response = json(
              { error: 'Daily AI limit reached. Try again tomorrow.', remaining: 0 },
              429,
              corsHeaders
            );
          } else if (path === '/api/ai/tip' && method === 'POST') {
            const body = await request.json();
            const stats = {
              residents: parseInt(body.residents, 10) || 0,
              developed_zones: parseInt(body.developed_zones, 10) || 0,
              disaster_resilience: parseFloat(body.disaster_resilience) || 0,
              power_capacity: parseInt(body.power_capacity, 10) || 0,
              power_demand: parseInt(body.power_demand, 10) || 0,
            };
            try {
              const tip = await generateTip(env, stats);
              await incrementAiQuota(env, user?.id, ip);
              response = json({ tip, remaining: quota.remaining - 1 }, 200, corsHeaders);
            } catch (e) {
              console.error('AI tip error', e);
              response = json({ error: 'AI temporarily unavailable' }, 503, corsHeaders);
            }
          } else if (path === '/api/ai/session-review' && method === 'POST') {
            const body = await request.json();
            const stats = {
              score: parseInt(body.score, 10) || 0,
              residents: parseInt(body.residents, 10) || 0,
              developed_zones: parseInt(body.developed_zones, 10) || 0,
              disaster_resilience: parseFloat(body.disaster_resilience) || 0,
              disasters_survived: parseInt(body.disasters_survived, 10) || 0,
            };
            try {
              const { questions, report } = await generateSessionReview(env, stats);
              await incrementAiQuota(env, user?.id, ip);
              response = json({ questions, report, remaining: quota.remaining - 1 }, 200, corsHeaders);
            } catch (e) {
              console.error('AI session review error', e);
              response = json({ error: 'AI temporarily unavailable' }, 503, corsHeaders);
            }
          } else if (
            (path === '/api/ai/reflection' || path === '/api/ai/mayor-report') &&
            method === 'POST'
          ) {
            const body = await request.json();
            const stats = {
              score: parseInt(body.score, 10) || 0,
              residents: parseInt(body.residents, 10) || 0,
              developed_zones: parseInt(body.developed_zones, 10) || 0,
              disaster_resilience: parseFloat(body.disaster_resilience) || 0,
              disasters_survived: parseInt(body.disasters_survived, 10) || 0,
            };
            try {
              const { questions, report } = await generateSessionReview(env, stats);
              await incrementAiQuota(env, user?.id, ip);
              response =
                path === '/api/ai/mayor-report'
                  ? json({ report, remaining: quota.remaining - 1 }, 200, corsHeaders)
                  : json({ questions, remaining: quota.remaining - 1 }, 200, corsHeaders);
            } catch (e) {
              console.error('AI review error', e);
              response = json({ error: 'AI temporarily unavailable' }, 503, corsHeaders);
            }
          } else {
            response = json({ error: 'Not found' }, 404, corsHeaders);
          }
        }
      } else if (path === '/api/health' && method === 'GET') {
        response = json({ ok: true, service: 'classroom-simcity-api' }, 200, corsHeaders);
      } else {
        response = json({ error: 'Not found' }, 404, corsHeaders);
      }

      // Attach CORS to all responses
      const newHeaders = new Headers(response.headers);
      for (const [k, v] of Object.entries(corsHeaders)) {
        newHeaders.set(k, v);
      }
      return new Response(response.body, { status: response.status, headers: newHeaders });
    } catch (e) {
      console.error(e);
      return json({ error: 'Internal server error' }, 500, corsHeaders);
    }
  },
};
