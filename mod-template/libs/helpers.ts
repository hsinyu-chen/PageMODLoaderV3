//https://stackoverflow.com/a/68238924/3908646
declare global {

    namespace JSX {
        // The return type of our JSX Factory: this could be anything
        type Element = HTMLElement;

        // IntrinsicElementMap grabs all the standard HTML tags in the TS DOM lib.
        interface IntrinsicElements extends IntrinsicElementMap { }


        // The following are custom types, not part of TS's known JSX namespace:
        type IntrinsicElementMap = {
            [K in keyof HTMLElementTagNameMap]: {
                [k: string]: any
            }
        }

        interface Component {
            (properties?: { [key: string]: any }, children?: Node[]): Node
        }
    }
}
export function _html<T extends keyof HTMLElementTagNameMap>(tag: T, attributes: { [key: string]: any } | null, ...children: Node[]): HTMLElementTagNameMap[T]
export function _html(tag: JSX.Component, attributes: { [key: string]: any } | null, ...children: Node[]): Node
export function _html<T extends keyof HTMLElementTagNameMap>(tag: T | JSX.Component,
    attributes: { [key: string]: any } | null,
    ...children: Node[]): HTMLElementTagNameMap[T] | Node {

    if (typeof tag === 'function') {
        return tag(attributes ?? {}, children);
    }
    const element: HTMLElementTagNameMap[T] = document.createElement(tag);

    // Assign attributes:
    let map = (attributes ?? {});
    let prop: keyof typeof map;
    for (prop of (Object.keys(map) as any)) {

        // Extract values:
        prop = prop.toString();
        const value = map[prop] as any;
        const anyReference = element as any;
        if (typeof anyReference[prop] === 'undefined') {
            // As a fallback, attempt to set an attribute:
            element.setAttribute(prop, value);
        } else {
            anyReference[prop] = value;
        }
    }

    // append children
    for (let child of children) {
        if (typeof child === 'string') {
            element.innerText += child;
            continue;
        }
        if (Array.isArray(child)) {
            element.append(...child);
            continue;
        }
        element.appendChild(child);
    }
    return element;

}
