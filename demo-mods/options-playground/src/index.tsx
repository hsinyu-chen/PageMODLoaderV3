import './index.scss';
import { _html } from '@libs/helpers';
import { onOptionChange, onButton, setChoices, setLabel } from '@libs/pml';

// Exercises every option type: toggle / text / dropdown / checklist / dynamic dropdown /
// label / button. Renders a floating panel on the page that reflects the options live.
(() => {
    const title = <div class="pml-pg-title"></div>;
    const body = <div class="pml-pg-body"></div>;
    const panel = <div class="pml-pg"></div>;
    panel.append(title, body);
    document.body.append(panel);

    // Dynamic dropdown: offer this page's first links as choices for the popup to pick from.
    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]')).slice(0, 8);
    setChoices('pageLink', links.map((a, i) => ({
        value: String(i),
        label: (a.textContent || a.getAttribute('href') || '').trim().slice(0, 40) || `link ${i}`,
    })));
    setLabel('status', `ready · ${links.length} links found`);

    // onOptionChange fires once on load and again on every change — one render path.
    onOptionChange(values => {
        panel.style.display = values['enabled'] === false ? 'none' : '';
        panel.dataset['color'] = `${values['color']}`;
        panel.dataset['corner'] = `${values['corner']}`;
        title.textContent = `${values['title']}`;

        const sections = (values['sections'] as string[]) ?? [];
        const lines: string[] = [];
        if (sections.includes('greeting')) lines.push('Hello 👋');
        if (sections.includes('clock')) lines.push(new Date().toLocaleTimeString());
        if (sections.includes('links')) lines.push(`${links.length} links on page`);
        const picked = values['pageLink'];
        if (picked !== undefined && picked !== '') lines.push(`picked link #${picked}`);
        body.textContent = lines.join('  ·  ') || '(no sections)';
    });

    // Button: per-tab event. Updates the read-only label live in the popup.
    let pings = 0;
    onButton('ping', () => setLabel('status', `ping ×${++pings}`));
})();
