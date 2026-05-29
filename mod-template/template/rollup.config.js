import { fileURLToPath } from 'url';
import scss from 'rollup-plugin-scss'
import alias from '@rollup/plugin-alias';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import esbuild from 'rollup-plugin-esbuild';

// Resolved relative to this config's own location. The template is built after being scaffolded
// into MODs/<name>/ (via create.ps1), so the shared libs dir is two levels up from there.
const libs = fileURLToPath(new URL('../../libs', import.meta.url));

export default {
	input: './src/index.tsx',
	output: {
		file: './dist/index.js',
		format: 'es'
	},
	plugins: [
		scss({ fileName: 'index.css' }),
		alias({ entries: [{ find: /^@libs\/(.*)$/, replacement: `${libs}/$1` }] }),
		nodeResolve({ extensions: ['.ts', '.tsx', '.js'] }),
		esbuild({ jsxFactory: '_html', target: 'esnext', minify: true }),
	]
};
