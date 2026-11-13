// @ts-check
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import fs from 'node:fs/promises';
import process from 'node:process';

const filename = fileURLToPath(import.meta.url);
const directory = path.dirname(filename);

export async function main() {
    const [major, minor] = process.versions.node.split('.').map(Number);
    if (major < 22 || (major === 22 && minor < 12)) {
        throw new Error(`Node.js ${process.versions.node} is too old. Use Node.js 24, or at least 22.12.0.`);
    }
    // Use the installed dependency directly: no npx cache, downloads or Windows .cmd spawning.
    const {default: peggy} = await import('peggy');
    const outputDirectory = path.join(directory, 'src', 'generated');
    await fs.mkdir(outputDirectory, {recursive: true});
    for (const name of ['ast', 'prepast']) {
        const input = path.join(directory, 'pegjs', name + '.pegjs');
        const grammar = await fs.readFile(input, 'utf8');
        const source = peggy.generate(grammar, {output: 'source', format: 'es', grammarSource: input});
        await fs.writeFile(path.join(outputDirectory, name + '.js'), source, 'utf8');
        console.log(`build_pegjs.js: generated src/generated/${name}.js`);
    }
}

// Also works on supported Node 22 versions predating import.meta.main.
if (process.argv[1] && path.resolve(process.argv[1]) === filename) {
    main().catch(error => {
        console.error(`build_pegjs.js: ${error.message}`);
        process.exitCode = 1;
    });
}
