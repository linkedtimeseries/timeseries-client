import {Disposable} from "./Disposable";
import {Listener} from "./Listener";

/** passes through events as they happen. You will not get events from before you start listening */
export class FragmentEvent<T> {
    private listeners: Array<Listener<T>> = [];
    private listenersOncer: Array<Listener<T>> = [];

    public on = (listener: Listener<T>): Disposable => {
        this.listeners.push(listener);
        return {
            dispose: () => this.off(listener),
        };
    }

    public once = (listener: Listener<T>): void => {
        this.listenersOncer.push(listener);
    }

    public off = (listener: Listener<T>) => {
        const callbackIndex = this.listeners.indexOf(listener);
        if (callbackIndex > -1) { this.listeners.splice(callbackIndex, 1); }
    }

    public emit = (event: T) => {
        /** Update any general listeners */
        this.listeners.forEach((listener) => listener(event));

        /** Clear the `once` queue */
        if (this.listenersOncer.length > 0) {
            const toCall = this.listenersOncer;
            this.listenersOncer = [];
            toCall.forEach((listener) => listener(event));
        }
    }

    public pipe = (te: FragmentEvent<T>): Disposable => {
        return this.on((e) => te.emit(e));
    }

}
