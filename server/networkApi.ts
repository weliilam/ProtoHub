import type { Plugin } from 'vite';
import os from 'os';
import { sendJson } from './utils';

export function networkApiPlugin(): Plugin {
  return {
    name: 'ph-network-api',
    configureServer(server) {
      server.middlewares.use('/api/network/ips', (_req, res) => {
        const interfaces = os.networkInterfaces();
        const ips: { name: string; address: string; family: string }[] = [];
        for (const [name, addrs] of Object.entries(interfaces)) {
          if (!addrs) continue;
          for (const addr of addrs) {
            // 只收集 IPv4 且非内部回环地址
            if (addr.family === 'IPv4' && !addr.internal) {
              ips.push({ name, address: addr.address, family: addr.family });
            }
          }
        }
        sendJson(res, { ips, hostname: os.hostname() });
      });
    },
  };
}
