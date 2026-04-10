import archiver from 'archiver';
import fs from 'fs';
import path from 'path';

const sourceDir = '/vercel/share/v0-project';
const outputFile = path.join(sourceDir, 'bullshark-project.zip');

const output = fs.createWriteStream(outputFile);
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
  console.log(`[v0] Zip file created: ${outputFile}`);
  console.log(`[v0] Size: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`);
});

archive.on('error', (err) => {
  console.error(`[v0] Archive error: ${err.message}`);
  process.exit(1);
});

archive.pipe(output);

// Add all files except node_modules, .next, .git, and logs
archive.glob('**/*', {
  cwd: sourceDir,
  ignore: ['node_modules/**', '.next/**', '.git/**', '*.log', 'bullshark-project.zip']
});

archive.finalize();
