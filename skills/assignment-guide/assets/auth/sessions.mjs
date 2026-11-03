import {newToken,tokenDigest} from './crypto.mjs';
// db: synchronous SQLite connection exposing prepare().run()/get().
// Compatible with node:sqlite DatabaseSync and better-sqlite3.
// HTTP cookie setting and page/API authorization remain in the Next adapter.
export function sessionStore(db, {ttlMs, now=Date.now}) {
  if(!Number.isSafeInteger(ttlMs)||ttlMs<=0)throw new Error('Positive integer ttlMs required');
  return {
    issue(userId) {
      const token=newToken(),expiresAt=now()+ttlMs;
      if(!Number.isSafeInteger(expiresAt))throw new Error('Invalid expiry');
      db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(tokenDigest(token),userId,expiresAt);
      return {token,expiresAt};
    },
    identity(token) {
      if(typeof token!=='string'||!token)return null;
      return db.prepare(`SELECT u.id,u.login,u.role FROM sessions s
        JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?`)
        .get(tokenDigest(token),now())??null;
    },
    revoke(token) {
      if(typeof token==='string'&&token)db.prepare('DELETE FROM sessions WHERE token_hash=?').run(tokenDigest(token));
    },
  };
}
