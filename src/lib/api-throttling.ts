function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function nextTick() {
  return sleep(0);
}

export class TokenBucketRateLimiter {
  maxRequests: number;
  maxRequestWindowMS: number;
  count: any;
  resetTimeout: any;
  constructor({
    maxRequests,
    maxRequestWindowMS,
  }: {
    maxRequests: number;
    maxRequestWindowMS: number;
  }) {
    this.maxRequests = maxRequests;
    this.maxRequestWindowMS = maxRequestWindowMS;
    this.reset();
  }

  reset() {
    this.count = 0;
    this.resetTimeout = null;
  }

  scheduleReset() {
    // Only the first token in the set triggers the resetTimeout
    if (!this.resetTimeout) {
      this.resetTimeout = setTimeout(
        () => this.reset(),
        this.maxRequestWindowMS
      );
    }
  }

  async acquireToken(fn: any): Promise<any> {
    this.scheduleReset();

    if (this.count === this.maxRequests) {
      await sleep(this.maxRequestWindowMS);
      return this.acquireToken(fn);
    }

    this.count += 1;
    await nextTick();
    return fn();
  }
}

function getMillisToSleep(retryHeaderString: string) {
  let millisToSleep: number = Math.round(parseFloat(retryHeaderString) * 1000);
  console.log("millis to sleep: ", millisToSleep);
  return millisToSleep;
}

// getMillisToSleep("4"); // => 4000
// getMillisToSleep("Mon, 29 Mar 2021 04:58:00 GMT"); // => 4000

export async function fetchAndRetryIfNecessary(callAPIFn: any): Promise<any> {
  const response = await callAPIFn();
  if (response.status === 429) {
    const retryAfter = response.headers.get("retry-after");
    const millisToSleep = getMillisToSleep(retryAfter);
    await sleep(millisToSleep);
    return fetchAndRetryIfNecessary(callAPIFn);
  }
  return response;
}
