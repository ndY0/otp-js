import { Observable, Subject, tap } from "rxjs";
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
  link() {
    return this.supervisedObservable.pipe(
      tap(() => this.supervisedSubject.complete())
    );
  }
}
