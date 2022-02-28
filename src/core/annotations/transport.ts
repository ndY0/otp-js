import { GenServer } from "../server/genserver"

const Transport = <T extends { new (...args: any[]): GenServer<U> }, U>(constructor: T) => {
    
}

export {Transport}