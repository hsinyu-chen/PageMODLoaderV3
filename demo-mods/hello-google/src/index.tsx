import './index.scss';
import { _html } from '@libs/helpers';

// The simplest kind of MOD: inject a DOM element and some CSS. No options API.
// `class` here is a JSX attribute — it must survive the build (esbuild keeps it).
const banner = <div class="pml-hello">👋 Hello from Page MOD Loader — this page is modded.</div>;
document.body.prepend(banner);
