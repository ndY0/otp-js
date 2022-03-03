import { CommonServer } from "../common/server-common";
import { ChildResolve } from "../constants/child-resolve";
import { ChildRestart } from "../constants/child-restart";
import { RestartStrategy } from "../constants/restart-strategy";

export abstract class GenSupervisor<
  T extends typeof CommonServer
> extends CommonServer {
  childSpec = {
    resolve: ChildResolve.MODULE,
    restart: ChildRestart.PERMANENT,
  };
  protected abstract children: { target: T; initArgs: any[] }[];
  async *start(strategy: RestartStrategy) {}
  //TODO : implement server function to handle inittialisation of watching children,
  // and client function to alter the state of supervised children
}
