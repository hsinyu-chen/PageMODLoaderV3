// Side-effect style imports (`import './index.scss'`) are bundled by rollup-plugin-scss at build
// time; these ambient declarations just stop tsc / the editor from flagging them as unresolved.
declare module '*.scss';
declare module '*.css';
