// Builds every demo MOD (../../demo-mods/*) using this template's toolchain.
// Run from this folder:  npx rollup -c build-demos.mjs
// Plugins resolve from this template's node_modules; @libs resolves to ../libs.
import { fileURLToPath } from 'url';
import scss from 'rollup-plugin-scss';
import alias from '@rollup/plugin-alias';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import esbuild from 'rollup-plugin-esbuild';

const libs = fileURLToPath(new URL('../libs', import.meta.url));
const demos = fileURLToPath(new URL('../../demo-mods', import.meta.url));

const names = ['hello-google', 'options-playground', 'document-start'];

export default names.map(name => ({
	input: `${demos}/${name}/src/index.tsx`,
	output: { file: `${demos}/${name}/dist/index.js`, format: 'es' },
	plugins: [
		scss({ fileName: 'index.css' }),
		alias({ entries: [{ find: /^@libs\/(.*)$/, replacement: `${libs}/$1` }] }),
		nodeResolve({ extensions: ['.ts', '.tsx', '.js'] }),
		esbuild({ jsxFactory: '_html', target: 'esnext', minify: true }),
	],
}));
