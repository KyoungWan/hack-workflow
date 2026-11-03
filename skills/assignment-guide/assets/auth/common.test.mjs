import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {hashPassword,verifyPassword,tokenDigest,newToken} from './crypto.mjs';
import {sessionStore} from './sessions.mjs';
const schema=readFileSync(new URL('./schema.sql',import.meta.url),'utf8');
test('salted hashes verify correct passwords and reject malformed storage',()=>{
 const a=hashPassword('test-password'),b=hashPassword('test-password');
 assert.notEqual(a,b);assert(verifyPassword('test-password',a));assert(!verifyPassword('wrong',a));
 for(const value of ['',null,'invalid',a+':extra'])assert(!verifyPassword('test-password',value));
});
test('opaque tokens are independent and digest is one-way storage representation',()=>{
 const a=newToken(),b=newToken();assert.notEqual(a,b);assert.equal(Buffer.from(a,'base64url').length,32);
 assert.equal(tokenDigest(a).length,64);assert.notEqual(tokenDigest(a),a);
});
test('SQLite sessions persist, read live roles, expire and revoke',()=>{
 const dir=mkdtempSync(join(tmpdir(),'common-auth-'));let db;
 try {
  const file=join(dir,'auth.sqlite');db=new DatabaseSync(file);db.exec(schema);
  const hash=hashPassword('temporary-password');db.prepare('INSERT INTO users(id,login,password_hash,role) VALUES(1,?,?,?)').run('user',hash,'user');
  let clock=1000;let store=sessionStore(db,{ttlMs:1000,now:()=>clock});
  assert.throws(()=>sessionStore(db,{ttlMs:0}));
  assert.throws(()=>store.issue(999));
  const {token}=store.issue(1);assert.equal(store.identity(token).role,'user');
  assert.equal(store.identity('unknown'),null);assert.equal(store.identity(null),null);
  assert.equal(db.prepare('SELECT token_hash FROM sessions').get().token_hash,tokenDigest(token));
  db.close();db=new DatabaseSync(file);db.exec(schema);store=sessionStore(db,{ttlMs:1000,now:()=>clock});
  assert(verifyPassword('temporary-password',db.prepare('SELECT password_hash FROM users').get().password_hash));
  assert.equal(store.identity(token).login,'user');
  db.prepare("UPDATE users SET role='admin' WHERE id=1").run();assert.equal(store.identity(token).role,'admin');
  clock=2000;assert.equal(store.identity(token),null);
  const fresh=store.issue(1).token;store.revoke(fresh);assert.equal(store.identity(fresh),null);
  assert.throws(()=>db.prepare("UPDATE users SET role='manager' WHERE id=1").run());
 }finally{db?.close();rmSync(dir,{recursive:true,force:true});}
});
