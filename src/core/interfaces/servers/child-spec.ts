import { ChildResolve } from "../../constants/child-resolve";
import { ChildRestart } from "../../constants/child-restart";

export interface ChildSpec {
  resolve: ChildResolve;
  restart: ChildRestart;
}
