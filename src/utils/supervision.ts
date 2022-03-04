import { Observable, Subscription } from "rxjs";
import { zip, zipWith } from "rxjs/operators";
import { CommonServer } from "../core/common/server-common";
import { ChildRestart } from "../core/constants/child-restart";
import { ProcessTermination } from "../core/constants/process-termination";
import { ChildSpec } from "../core/interfaces/servers/child-spec";
import { fromGenerator } from "./effects";

const restartWorker = (
  target: typeof CommonServer & (new (...args: any[]) => CommonServer),
  spec: ChildSpec,
  initArgs: any[],
  ref: string,
  state: Map<
    string,
    {
      target: typeof CommonServer & (new (...args: any[]) => CommonServer);
      worker: CommonServer;
      initArgs: any[];
      ref: string;
      spec: ChildSpec;
      workerLinkPipeline: Observable<{
        termination: ProcessTermination;
        term?: any;
      }>;
    }
  >
) => {
  const worker = new (target as { new (...args: any[]): CommonServer })(target);
  const newChild = {
    target,
    worker,
    workerLinkPipeline: worker.link(),
    spec,
    initArgs,
    ref,
  };
  superviseOneForOne(newChild, ref, state);
  state.set(ref, newChild);
  fromGenerator(newChild.worker.startLink(target, ...initArgs));
};

const superviseOneForOne = (
  {
    target,
    workerLinkPipeline,
    spec,
    initArgs,
    ref,
  }: {
    target: typeof CommonServer & (new (...args: any[]) => CommonServer);
    worker: CommonServer;
    initArgs: any[];
    ref: string;
    spec: ChildSpec;
    workerLinkPipeline: Observable<{
      termination: ProcessTermination;
      term?: any;
    }>;
  },
  _ref: string,
  state: Map<
    string,
    {
      target: typeof CommonServer & (new (...args: any[]) => CommonServer);
      worker: CommonServer;
      initArgs: any[];
      ref: string;
      spec: ChildSpec;
      workerLinkPipeline: Observable<{
        termination: ProcessTermination;
        term?: any;
      }>;
    }
  >
) => {
  const subscription = workerLinkPipeline.subscribe({
    next: ({ termination }) => {
      if (
        spec.restart === ChildRestart.TEMPORARY ||
        spec.restart === ChildRestart.TRANSIENT
      ) {
        state.delete(ref);
      } else {
        if (termination !== ProcessTermination.SHUTDOWN) {
          restartWorker(target, spec, initArgs, ref, state);
        } else {
          state.delete(ref);
        }
      }
    },
    error: (err) => {
      if (spec.restart === ChildRestart.TEMPORARY) {
        state.delete(ref);
      } else {
        restartWorker(target, spec, initArgs, ref, state);
      }
    },
    complete: () => {
      subscription.unsubscribe();
    },
  });
};

const superviseOneForAll = (
  state: Map<
    string,
    {
      target: typeof CommonServer & (new (...args: any[]) => CommonServer);
      worker: CommonServer;
      initArgs: any[];
      ref: string;
      spec: ChildSpec;
      workerLinkPipeline: Observable<{
        termination: ProcessTermination;
        term?: any;
      }>;
    }
  >
) => {
  const workerSubscriptions: Subscription[] = [];
  state.forEach(
    ({
      target,
      workerLinkPipeline,
      spec,
      initArgs,
      ref,
    }: {
      target: typeof CommonServer & (new (...args: any[]) => CommonServer);
      worker: CommonServer;
      initArgs: any[];
      ref: string;
      spec: ChildSpec;
      workerLinkPipeline: Observable<{
        termination: ProcessTermination;
        term?: any;
      }>;
    }) => {
      const subscription = workerLinkPipeline.subscribe({
        next: ({ termination }) => {
          if (
            spec.restart === ChildRestart.TEMPORARY ||
            spec.restart === ChildRestart.TRANSIENT
          ) {
            state.delete(ref);
          } else {
            if (termination !== ProcessTermination.SHUTDOWN) {
              restartWorker(target, spec, initArgs, ref, state);
            } else {
              state.delete(ref);
            }
          }
        },
        error: (err) => {
          workerSubscriptions.forEach((sub: Subscription) => sub.unsubscribe());
          if (spec.restart === ChildRestart.TEMPORARY) {
            state.forEach(({ ref }) => {
              fromGenerator(target.clientService.KILL(ref, target));
            });
            state.clear();
          } else {
            state.forEach(({ ref }) => {
              fromGenerator(target.clientService.KILL(ref, target));
            });
            state.forEach(({ ref, spec, initArgs }) => {
              restartWorker(target, spec, initArgs, ref, state);
            });
          }
        },
        complete: () => {
          subscription.unsubscribe();
        },
      });
      workerSubscriptions.push(subscription);
    }
  );
};

export { superviseOneForOne, superviseOneForAll };
