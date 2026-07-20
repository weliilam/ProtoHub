import fs from 'fs';
import path from 'path';
import type { IncomingMessage, ServerResponse } from 'http';

export const projectRoot = process.cwd();

/** 将请求路径限制在项目根内，防目录穿越 */
export function safeResolve(relPath: string): string | null {
  const abs = path.resolve(projectRoot, relPath);
  if (!abs.startsWith(projectRoot)) return null;
  return abs;
}

export function sendJson(res: ServerResponse, data: unknown, status = 200) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

export function sendError(res: ServerResponse, message: string, status = 400) {
  sendJson(res, { success: false, error: message }, status);
}

export function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

export async function readJsonBody<T = any>(req: IncomingMessage): Promise<T> {
  const raw = await readBody(req);
  try {
    return JSON.parse(raw || '{}') as T;
  } catch {
    throw new Error('请求体不是合法 JSON');
  }
}

export function readJsonFile<T = any>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

export function writeJsonFile(filePath: string, data: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

export function getPathname(req: IncomingMessage): string {
  try {
    return new URL(req.url || '/', 'http://localhost').pathname;
  } catch {
    return '/';
  }
}

export function getQuery(req: IncomingMessage): URLSearchParams {
  return new URL(req.url || '/', 'http://localhost').searchParams;
}

/** 校验名称（目录名/文件名），防注入 */
export function isValidName(name: string): boolean {
  return /^[\w一-龥][\w一-龥-]{0,60}$/.test(name);
}
