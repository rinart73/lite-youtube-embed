import fs from 'fs/promises';
import { globby } from 'globby';
import UglifyJS from 'uglify-js';

try {
    await fs.mkdir('./dist');
} catch (e) {}

const files = await globby(['./src/**/*.js', '!**/*.min.js', '!node_modules/**']);
for (const srcPath of files) {
    const bits = srcPath.split('/');
    bits[1] = 'dist';

    const path = bits.join('/');

    bits.pop();
    const distDirectory = bits.join('/');

    // Copy src file to dist
    await fs.mkdir(distDirectory, { recursive: true });
    await fs.copyFile(srcPath, path);

    let parts = path.split('/');
    const file = parts[parts.length - 1];

    const minifiedPath = path.replace(new RegExp('.js$'), '.min.js');
    parts = minifiedPath.split('/');
    const minifiedFile = parts[parts.length - 1];

    const contents = await fs.readFile(path, 'utf8');
    const result = UglifyJS.minify(contents, {
        sourceMap: {
            filename: file,
            url: minifiedFile + '.map'
        }
    });

    await fs.writeFile(minifiedPath, result.code);
    if (result.map) {
        await fs.writeFile(minifiedPath + '.map', result.map);
    }
}
