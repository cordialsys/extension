import {
  type StandardEventsOnMethod as EventsOnMethod,
  type StandardEventsListeners as EventsListeners,
  type StandardEventsNames as EventsNames,
} from "@wallet-standard/features";

type Event = string | symbol;
type Listener = (...args: unknown[]) => void;
type Listeners = { [event: Event]: Listener[] };

export class EventEmitter {
  private listeners: Listeners = {};

  // aka `addListener`
  on(event: Event, listener: Listener): EventEmitter {
    console.log("👂 App listen on", event); //, listener);
    if (!this.listeners[event]?.push(listener))
      this.listeners[event] = [listener];
    return this;
  }

  // aka `off`
  removeListener(event: Event, listener: Listener): EventEmitter {
    console.log("👂 App listen off", event); //, listener);
    const list = this.listeners[event];
    if (list) {
      this.listeners[event] = list.filter((existing) => existing !== listener);
    }
    return this;
  }

  emit(event: Event, ...args: unknown[]) {
    console.log("👂 Provider emit", event, "with args", args);
    this.listeners[event]?.forEach((listener) => listener(args));
  }
}

export class SolEventEmitter {
  listeners: { [E in EventsNames]?: EventsListeners[E][] } = {};

  emit<E extends EventsNames>(
    event: E,
    ...args: Parameters<EventsListeners[E]>
  ) {
    // eslint-disable-next-line prefer-spread
    this.listeners[event]?.forEach((listener) => listener.apply(null, args));
  }

  on: EventsOnMethod = (event, listener) => {
    console.log("this", this);
    console.log("Cordial Solana on event", event);
    console.log("listeners", this.listeners);
    if (this.listeners[event]) {
      this.listeners[event].push(listener);
    } else {
      this.listeners[event] = [listener];
    }
    // if (!this.listeners[event]?.push(listener)) {
    //   this.listeners[event] = [listener];
    // }
    return () => this.off(event, listener);
  };

  off<E extends EventsNames>(event: E, listener: EventsListeners[E]) {
    console.log("Cordial Solana off");
    const list = this.listeners[event];
    if (!list) return;
    this.listeners[event] = list.filter((existing) => listener !== existing);
  }
}
