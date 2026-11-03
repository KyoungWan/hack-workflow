// Five-run common primitives, normalized into reusable functions.
import {randomBytes, createHash, scryptSync, timingSafeEqual} from 'node:crypto';
export const tokenDigest = token => createHash('sha256').update(token).digest('hex');
export const newToken = () => randomBytes(32).toString('base64url');
export function hashPassword(password) {
  const salt=randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password,salt,64).toString('hex')}`;
}
export function verifyPassword(password, encoded) {
  if(typeof password!=='string'||typeof encoded!=='string')return false;
  const [salt,hex,...extra]=encoded.split(':');
  if(extra.length||!/^[a-f0-9]{32}$/.test(salt)||!/^[a-f0-9]{128}$/.test(hex??''))return false;
  const candidate=scryptSync(password,salt,64),expected=Buffer.from(hex,'hex');
  return timingSafeEqual(candidate,expected);
}
