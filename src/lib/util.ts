export const sleep = (millis: number) =>
  new Promise((_) => setTimeout(_, millis));
export const SHORT_SLEEP = 100;
export const short_sleep = () => new Promise((_) => setTimeout(_, SHORT_SLEEP));
