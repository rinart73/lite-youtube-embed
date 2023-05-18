import fs from 'fs/promises';

await fs.rm('./dist', { recursive: true, force: true });
