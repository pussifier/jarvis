'use strict';
const path = require('node:path');
const fs = require('node:fs/promises');

const SECRET = /\b(?:gsk_[A-Za-z0-9_-]{16,}|sk-fish-[A-Za-z0-9_-]{16,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9_]{20,})\b/g;
function redact(value) { return String(value).replace(SECRET, '[REDACTED KEY]').replace(/(Bearer\s+)[A-Za-z0-9_.~-]{16,}/gi, '$1[REDACTED]'); }
function string(value, label, max = 12000) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || value.includes('\0')) throw new Error(`${label} must be non-empty text, at most ${max} characters.`);
  return value;
}
function noteName(value) {
  string(value, 'Note name', 100);
  if (!/^[\p{L}\p{N} _-]+$/u.test(value) || /^(?:con|prn|aux|nul|com[0-9]|lpt[0-9])$/i.test(value) || /[ .]$/.test(value)) throw new Error('Use a plain note name without slashes or Windows reserved names.');
  return value;
}
function isoLocal(now = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
}
function isInside(root, target) {
  const rel = path.relative(root, target);
  return rel === '' || (rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel));
}
async function scopedPath(root, value, { create = false } = {}) {
  string(value, 'Path', 2000);
  if (process.platform === 'win32' && /(^\\\\|^\\\?\\|:[^\\/]|[<>"|?*])/.test(value.replace(/^[a-z]:/i, ''))) throw new Error('Network paths, device paths and alternate streams are not allowed.');
  const realRoot = await fs.realpath(root);
  const candidate = path.resolve(realRoot, value);
  if (!isInside(realRoot, candidate)) throw new Error('This path is outside the selected workspace. Choose its folder in Settings first.');
  let real;
  try { real = await fs.realpath(candidate); }
  catch (err) {
    if (!create || err.code !== 'ENOENT') throw err;
    const parent = await fs.realpath(path.dirname(candidate));
    if (!isInside(realRoot, parent)) throw new Error('A link points outside the workspace.');
    real = path.join(parent, path.basename(candidate));
  }
  if (!isInside(realRoot, real)) throw new Error('A link points outside the workspace.');
  return real;
}
async function readText(file, max = 120000) {
  const stat = await fs.stat(file);
  if (!stat.isFile()) throw new Error('Choose a regular text file.');
  if (stat.size > max) throw new Error(`This file is ${stat.size} bytes. The full-read limit is ${max}; it has not been sampled. Open it locally or split it first.`);
  const buffer = await fs.readFile(file);
  if (buffer.includes(0)) throw new Error('This is a binary file, not a text document.');
  return buffer.toString('utf8');
}
async function atomicJSON(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = file + '.tmp';
  await fs.writeFile(temp, JSON.stringify(value, null, 2), { mode: 0o600 });
  await fs.rename(temp, file);
}
function safeURL(value) {
  const url = new URL(string(value, 'URL', 2000));
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Only ordinary HTTP or HTTPS links without embedded credentials can be opened.');
  return url.href;
}
module.exports = { redact, string, noteName, isoLocal, isInside, scopedPath, readText, atomicJSON, safeURL };
