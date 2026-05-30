import './index.scss';
import { _html } from '@libs/helpers';

// Demonstrates "runAt": "document_start" — this MOD runs before the page's own scripts and
// before the DOM is built. Three live signals prove the timing:
//   1. document.body is null at inject time (the panel must be deferred to DOMContentLoaded).
//   2. document.readyState is 'loading' at inject time.
//   3. window.fetch is hooked before the page can capture the original reference, so every
//      request the page fires afterwards is counted.

const bodyAtInject = !!document.body;          // false at document_start
const readyStateAtInject = document.readyState; // 'loading' at document_start

let fetchCount = 0;
const countEl = <b>0</b>;

// Hook fetch first thing — the whole point of document_start is to win this race against the page.
const origFetch = window.fetch;
if (typeof origFetch === 'function') {
    window.fetch = function (...args: Parameters<typeof fetch>) {
        fetchCount++;
        countEl.textContent = String(fetchCount);
        return origFetch.apply(this, args);
    };
}

function mount() {
    const panel = <div class="pml-docstart">
        <div>⏱️ <b>document_start</b> demo</div>
        <div>body present at inject: <b>{String(bodyAtInject)}</b></div>
        <div>readyState at inject: <b>{readyStateAtInject}</b></div>
        <div>fetch() calls intercepted: {countEl}</div>
    </div>;
    document.body.prepend(panel);
}

// document.body doesn't exist yet at document_start — defer the DOM insertion until it does.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
} else {
    mount();
}
