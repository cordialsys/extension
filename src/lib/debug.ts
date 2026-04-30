type DebugDetails = Record<string, unknown>;

interface DebugEvent {
  details: DebugDetails;
  event: string;
  source: string;
  time: string;
}

const EVENTS: DebugEvent[] = [];
const LIMIT = 300;

function record(source: string, event: string, details: DebugDetails = {}) {
  const entry = {
    details,
    event,
    source,
    time: new Date().toISOString(),
  };

  EVENTS.push(entry);
  if (EVENTS.length > LIMIT) EVENTS.shift();

  console.info("[cordial-extension:trace]", source, event, details);
}

function dump(): DebugEvent[] {
  return [...EVENTS];
}

function clear() {
  EVENTS.length = 0;
}

function attachGlobal() {
  const target = globalThis as unknown as {
    cordialDebug?: {
      clear: typeof clear;
      dump: typeof dump;
    };
  };

  target.cordialDebug = {
    clear,
    dump,
  };
}

export const Debug = {
  attachGlobal,
  clear,
  dump,
  record,
};
