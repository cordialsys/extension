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
