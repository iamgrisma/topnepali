import fs from 'node:fs';
import path from 'node:path';

const buildInfo = {
  buildTime: new Date().toISOString(),
  environment: process.env.NODE_ENV || 'production',
  target: process.env.DEPLOY_TARGET || 'auto',
  version: '1.0.0',
};

const outDir = path.join(process.cwd(), 'src');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

fs.writeFileSync(
  path.join(outDir, 'build-info.json'),
  JSON.stringify(buildInfo, null, 2)
);

console.log('[build-info] Generated build info:', buildInfo.buildTime);
