import './index.scss';
import { _html } from '@libs/helpers';
import { getOptions, onOptionChange, onButton, setChoices, setLabel } from '@libs/pml';

(async () => {
    // Read a one-off snapshot of the option values (declared in config.json).
    const options = await getOptions();
    if (options['enabled'] === false) return; // honor the toggle at startup

    const label = <div></div>;
    document.body.append(label);

    // onOptionChange fires once with the current values on load, then again on every change,
    // so the same handler applies settings initially and live. Pass { immediate: false } to
    // fire only on subsequent changes.
    onOptionChange(values => {
        label.textContent = `${values['greeting']}`;
    });

    // Respond to a popup button press (per-tab: only this tab fires).
    onButton('refresh', () => {
        location.reload();
    });

    // Feed dynamic choices into a dropdown/checklist declared as "dynamic" in config.json.
    setChoices('sections', [
        { value: 'a', label: 'Section A' },
        { value: 'b', label: 'Section B' },
    ]);

    // Update a read-only label; reflects live in an open popup.
    setLabel('status', 'ready');
})();
