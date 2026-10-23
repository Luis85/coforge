import { onBeforeUnmount, ref } from 'vue';

/** Sample-chat loop: one simulated viewer message per period while running; stops itself on failure. */
export function useChatSimulator(simulate: () => Promise<boolean>, period = 6500) {
  const running = ref(false);
  let timer: number | undefined;
  let pending = false;
  const stop = () => {
    if (timer !== undefined) window.clearInterval(timer);
    timer = undefined;
    running.value = false;
  };
  const tick = () => {
    if (pending) return;
    pending = true;
    void simulate().then(done => { if (!done) stop(); }).finally(() => { pending = false; });
  };
  const start = () => {
    stop();
    running.value = true;
    timer = window.setInterval(tick, period);
  };
  onBeforeUnmount(stop);
  return { running, toggle: () => { if (running.value) stop(); else start(); } };
}
