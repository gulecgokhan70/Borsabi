type PollEnvironment = { document: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>; window: Pick<Window, 'addEventListener' | 'removeEventListener'>; navigator: Pick<Navigator, 'onLine'> };

// Schedule the next refresh after completion; never overlap slow requests.
// Hidden/offline pages stop polling and resume immediately on return.
export function startVisiblePolling(task: (signal: AbortSignal) => Promise<unknown>, interval: number, env: PollEnvironment, initialDelay = 0) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | undefined;
  let stopped = false, running = false;
  const ready = () => env.document.visibilityState !== 'hidden' && env.navigator.onLine !== false;
  async function run() {
    if (stopped || running || !ready()) return;
    running = true; controller = new AbortController();
    try { await task(controller.signal); } catch { /* Each screen owns its visible errors. */ }
    finally {
      running = false;
      if (!stopped && ready()) timer = setTimeout(run, interval);
    }
  }
  function resume() {
    clearTimeout(timer);
    if (ready()) void run();
    else controller?.abort();
  }
  env.document.addEventListener('visibilitychange', resume);
  env.window.addEventListener('online', resume);
  env.window.addEventListener('offline', resume);
  if (ready()) timer = setTimeout(run, initialDelay);
  return () => {
    stopped = true; clearTimeout(timer); controller?.abort();
    env.document.removeEventListener('visibilitychange', resume);
    env.window.removeEventListener('online', resume);
    env.window.removeEventListener('offline', resume);
  };
}
