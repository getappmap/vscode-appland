import EventEmitter from 'events';

type JobFunction<T> = () => Promise<T>;

class Job<T> extends EventEmitter {
  public timeout?: NodeJS.Timeout;

  constructor(public fn: JobFunction<T>, public startTime: number, public previous?: Job<T>) {
    super();
  }

  schedule(delayMs: number) {
    const self = this as Job<T>;

    const emitAll = (event: string) => {
      return (...args: unknown[]) => {
        let job: Job<T> | undefined = self;
        while (job) {
          job.emit(event, ...args);
          job = job.previous;
        }
      };
    };

    this.timeout = setTimeout(() => {
      this.fn()
        .then(emitAll('done'))
        .catch(emitAll('error'));
    }, delayMs);
  }
}

const jobs: Record<string, Job<any>> = {};

/**
 * Runs a background function and returns the output. There is a deliberate waiting period
 * after the job is scheduled and before it is run. If the same job is requested again before the
 * timeout has expired, the results of the existing job will be used as the function response.
 * In this way, if a client is frequently requesting an update of some data, only one instance of the job
 * will be running at any time.
 *
 * @param jobName unique job name
 * @param fn worker function
 * @param initialDelayMs delay in milliseconds before the job will be started.
 * @returns
 */
export default function backgroundJob<T>(
  jobName: string,
  fn: JobFunction<T>,
  initialDelayMs = 500
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const existing: Job<T> | undefined = jobs[jobName];
    if (existing) {
      existing.on('done', resolve);
      existing.on('error', reject);
      return;
    }

    const job = new Job(fn, Date.now(), existing);
    job.on('done', (result) => {
      console.log(`Completed background job ${jobName}`);
      delete jobs[jobName];
      resolve(result);
    });
    job.on('error', (err) => {
      console.log(`Error in background job ${jobName}: ${err}`);
      delete jobs[jobName];
      reject(err);
    });
    jobs[jobName] = job;
    console.log(`Starting background job ${jobName}`);
    job.schedule(initialDelayMs);
  });
}
