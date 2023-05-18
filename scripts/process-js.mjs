import fs from 'fs/promises';
import { globby } from 'globby';
import UglifyJS from 'uglify-js';

const files = await globby([
  './dist/**/*.js',
  '!**/*.min.js',
  '!node_modules/**',
]);
for (const path of files) {
  let parts = path.split('/');
  const file = parts[parts.length - 1];

  const minifiedPath = path.replace(/\.js$/, '.min.js');
  parts = minifiedPath.split('/');
  const minifiedFile = parts[parts.length - 1];

  const contents = await fs.readFile(path, 'utf8');
  const result = UglifyJS.minify(contents, {
    sourceMap: {
      filename: file,
      url: minifiedFile + '.map',
    },
  });

  await fs.writeFile(minifiedPath, result.code);
  if (result.map) {
    await fs.writeFile(minifiedPath + '.map', result.map);
  }
}
