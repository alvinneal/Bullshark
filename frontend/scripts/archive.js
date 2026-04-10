#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import tar from 'tar';

const projectDir = '/vercel/share/v0-project';
const outputFile = '/vercel/share/v0-project/bullshark-project.tar.gz';

const ignore = [
  'node_modules',
  '.next',
  '.git',
  '.gitignore',
  '.env.local',
  '.env.development.local',
  '*.log',
  'scripts',
  'bullshark-project.*'
];

try {
  await tar.create(
    {
      gzip: true,
      file: outputFile,
      cwd: projectDir,
      onwarn: (code, message) => console.warn(`Warning: ${code} - ${message}`),
      filter: (path) => {
        const fileName = path.split('/').pop();
        return !ignore.some(pattern => {
          if (pattern.includes('*')) {
            const regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);
            return regex.test(fileName);
          }
          return path.includes(pattern);
        });
      }
    },
    ['.']
  );
  console.log(`Successfully created archive: ${outputFile}`);
  console.log(`File size: ${fs.statSync(outputFile).size} bytes`);
} catch (error) {
  console.error('Error creating archive:', error.message);
  process.exit(1);
}
