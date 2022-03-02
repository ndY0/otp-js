import { Observable, Subject } from "rxjs";
import { fromObservable } from "../../utils/effects";
import { ProcessTermination } from "../constants/process-termination";

export class Link {
  private readonly supervisedSubject = new Subject<{
    termination: ProcessTermination;
    term?: any;
  }>();
  private readonly supervisedObservable: Observable<{
    termination: ProcessTermination;
    term?: any;
  }>;
  constructor() {
    this.supervisedObservable = this.supervisedSubject.pipe();
  }
  /**
   * supervised api
   */
  async *signal(termination: { termination: ProcessTermination; term?: any }) {
    this.supervisedSubject.next(termination);
  }
  /**
   * supervisor api
   */
  async *link() {
    const termination: {
      termination: ProcessTermination;
      term?: any;
    } = yield fromObservable(this.supervisedObservable);
    this.supervisedSubject.complete();
    return termination;
  }
}
