import postcss from 'postcss';
import cssnano from 'cssnano';
import cssNanoPreset from 'cssnano-preset-default';
import fs from 'fs/promises';
import { globby } from 'globby';
const preset = cssNanoPreset({});

const files = await globby(['./src/**/*.css', '!**/*.min.css', '!node_modules/**']);
for (const srcPath of files) {
    const bits = srcPath.split('/');
    bits[1] = 'dist';

    const path = bits.join('/');

    bits.pop();
    const distDirectory = bits.join('/');

    // Copy src file to dist
    await fs.mkdir(distDirectory, { recursive: true });
    await fs.copyFile(srcPath, path);

    const minifiedPath = path.replace(new RegExp('.css$'), '.min.css');

    const contents = await fs.readFile(path, 'utf8');
    const result = await postcss([cssnano({ preset, plugins: [] })]).process(contents, {
        from: path,
        to: minifiedPath,
        map: { absolute: false, inline: false }
    });

    await fs.writeFile(minifiedPath, result.css);
    if (result.map) {
        await fs.writeFile(minifiedPath + '.map', result.map.toString());
    }
}
