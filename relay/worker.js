const website = 'https://technodahadera.github.io';
const phases = new Set(['task','vote','reveal','science']);
const optionCounts = [4,3,4,4,3,3,4,4];
const roomLifetime = 6 * 60 * 60 * 1000;
const codePattern = /^[A-Z2-9]{8}$/;
const keyPattern = /^[a-f0-9-]{36}$/;
const cors = {
  'Access-Control-Allow-Origin': website,
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Host-Key',
  'Access-Control-Max-Age': '3600',
  'Cache-Control': 'no-store',
};
const json = (body, status=200) => Response.json(body,{status,headers:cors});
const isStage = s => s && Number.isInteger(s.round) && s.round>=0 && s.round<=8 && phases.has(s.phase) &&
  Number.isSafeInteger(s.openedAt) && s.openedAt>0 && Number.isSafeInteger(s.deadline) &&
  (s.deadline===0 || (s.deadline>=s.openedAt && s.deadline-s.openedAt<=60000));
const roomState = r => ({round:r.round,phase:r.phase,openedAt:r.opened_at,deadline:r.deadline});
const deadline = (stage, now) => stage.deadline ? now + (stage.deadline - stage.openedAt) : 0;

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null,{status:204,headers:cors});
    const url = new URL(request.url);
    if (url.pathname==='/' && request.method==='GET') return json({service:'Technoda Brain Night',status:'ready'});
    const match = url.pathname.match(/^\/room\/([A-Z2-9]{8})(?:\/(stage|vote|results))?$/);
    if (!match || !codePattern.test(match[1])) return json({error:'not_found'},404);
    if (request.headers.get('Origin') && request.headers.get('Origin')!==website) return json({error:'origin'},403);
    const [,room,action] = match;
    const now = Date.now();
    const key = request.headers.get('X-Host-Key');
    const db = env.DB;
    if (request.method==='GET') {
      if (!action) {
        const row = await db.prepare('SELECT round, phase, opened_at, deadline FROM rooms WHERE code=? AND expires_at>?').bind(room,now).first();
        return row ? json(roomState(row)) : json({error:'unknown_room'},404);
      }
      if (action==='results') {
        const round = Number(url.searchParams.get('round'));
        const open = Number(url.searchParams.get('openedAt'));
        if (!keyPattern.test(key || '') || !Number.isInteger(round) || round<0 || round>7 || !Number.isSafeInteger(open) || open<=0) return json({error:'invalid_request'},400);
        const owner = await db.prepare('SELECT 1 AS yes FROM rooms WHERE code=? AND host_key=? AND expires_at>?').bind(room,key,now).first();
        if (!owner) return json({error:'not_found'},404);
        const data = await db.prepare('SELECT voter, choice, elapsed FROM votes WHERE room=? AND round=? AND opened_at=?').bind(room,round,open).all();
        return json(data.results);
      }
      return json({error:'method'},405);
    }
    if (request.method!=='POST' || action==='results') return json({error:'method'},405);
    if (Number(request.headers.get('Content-Length'))>1500) return json({error:'too_big'},413);
    let body;
    try {
      const raw = await request.text();
      if (raw.length>1500) return json({error:'too_big'},413);
      body=JSON.parse(raw);
    } catch { return json({error:'invalid_json'},400); }
    if (action==='vote') {
      if (!body || typeof body.voter!=='string' || !keyPattern.test(body.voter) ||
        !Number.isInteger(body.round) || !(body.round>=0 && body.round<8) ||
        !Number.isSafeInteger(body.openedAt) || !Number.isInteger(body.choice) ||
        body.choice<0 || body.choice>=optionCounts[body.round]) return json({error:'invalid_vote'},400);
      const {round,openedAt,voter,choice} = body;
      const [insert, check] = await db.batch([
        db.prepare(`INSERT OR IGNORE INTO votes (room, round, opened_at, voter, choice, elapsed)
          SELECT code, round, opened_at, ?, ?, MAX(0, ?-server_opened_at) FROM rooms
          WHERE code=? AND expires_at>? AND round=? AND opened_at=? AND phase='vote' AND (deadline=0 OR deadline>=?)`)
          .bind(voter,choice,now,room,now,round,openedAt,now),
        db.prepare('SELECT choice FROM votes WHERE room=? AND round=? AND opened_at=? AND voter=?').bind(room,round,openedAt,voter),
      ]);
      return json({accepted:insert.meta.changes===1 || check.results[0]?.choice===choice});
    }
    if (!keyPattern.test(key || '') || !isStage(body)) return json({error:'invalid_stage'},400);
    if (!action) {
      const [cleanup, insert] = await db.batch([
        db.prepare('DELETE FROM rooms WHERE expires_at<=?').bind(now),
        db.prepare(`INSERT OR IGNORE INTO rooms (code,host_key,expires_at,round,phase,opened_at,server_opened_at,deadline)
          VALUES (?,?,?,?,?,?,?,?)`).bind(room,key,now+roomLifetime,body.round,body.phase,body.openedAt,now,deadline(body,now)),
      ]);
      if (insert.meta.changes===1) return json({accepted:true},201);
      const existing = await db.prepare('SELECT 1 AS yes FROM rooms WHERE code=? AND host_key=?').bind(room,key).first();
      return existing ? json({accepted:true}) : json({error:'room_conflict'},409);
    }
    const updated = await db.prepare(`UPDATE rooms SET round=?, phase=?, opened_at=?, server_opened_at=?, deadline=?
      WHERE code=? AND host_key=? AND expires_at>? AND opened_at<?`)
      .bind(body.round,body.phase,body.openedAt,now,deadline(body,now),room,key,now,body.openedAt).run();
    if (updated.meta.changes) return json({accepted:true});
    const existing = await db.prepare('SELECT 1 AS yes FROM rooms WHERE code=? AND host_key=? AND expires_at>?').bind(room,key,now).first();
    return existing ? json({accepted:true}) : json({error:'not_found'},404);
  },
};
