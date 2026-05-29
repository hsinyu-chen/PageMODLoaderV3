import './index.scss';
import { _html } from '@libs/helpers';
import { getOptions, onOptionChange, onButton, setChoices } from '@libs/pml';

(async () => {
    // Read the user's option values (declared in config.json) once at startup.
    const options = await getOptions();

    const label = <div>{`${options['greeting']}`}</div>;
    document.body.append(label);

    // React to live changes the user makes in the popup (no page reload needed).
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
})();
