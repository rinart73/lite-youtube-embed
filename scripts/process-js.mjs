import fs from 'fs/promises';
import { globby } from 'globby';
import UglifyJS from 'uglify-js';

const files = await globby(['./dist/**/*.js', '!**/*.min.js', '!node_modules/**']);
for (const path of files) {
  let parts = path.split('/');
  const file = parts[parts.length - 1];

  const minifiedPath = path.replace(/\.js$/, '.min.js');
  parts = minifiedPath.split('/');
  const minifiedFile = parts[parts.length - 1];

  // mangle props
  const mangleProps = [
    // static methods
    'checkWebpSupport',
    'warmConnections',
    'addPrefetch',
    // private methods
    'addPoster',
    'setPosterDimensions',
    'tryDownscalingSize',
    'onPosterLoad',
    'onPosterError',
    'addYTPlayerIframe',
    'fetchYTPlayerApi',
    // static properties
    'supportsWebp',
    'preconnected',
    'usesApi',
    // private properties
    'playLabelText',
    'posterEl',
    'isInitialized',
    //'videoId',
    'playlistId',
    'posterSize',
    'jpg',
    'webp',
  ];
  const manglePropsRegExp = new RegExp(`^(${mangleProps.join('|')})$`);

  const contents = await fs.readFile(path, 'utf8');
  const result = UglifyJS.minify(contents, {
    compress: {
      passes: 3,
    },
    mangle: {
      properties: {
        regex: manglePropsRegExp,
      },
    },
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
