import typescript from 'rollup-plugin-typescript2';
export default {
	input: './src/service_worker.ts',
	output: {
		file: '../extension_dist/service_worker.js',
		format: 'es'
	},
	plugins: [typescript()]
};