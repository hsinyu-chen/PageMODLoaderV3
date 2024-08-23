import scss from 'rollup-plugin-scss'
import typescript from 'rollup-plugin-typescript2';
import terser from '@rollup/plugin-terser';
export default {
	input: './src/index.tsx',
	output: {
		file: './dist/index.js',
		format: 'es'
	},
	plugins: [scss({ fileName: 'index.css' }), typescript({ tsconfig: 'tsconfig.build.json' }), terser()]
};