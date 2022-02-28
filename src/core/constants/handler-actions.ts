enum HandlerAction {
    REPLY = 'REPLY',
    NO_REPLY = 'NO_REPLY',
}

const REPLY = HandlerAction.REPLY as HandlerAction.REPLY
const NO_REPLY = HandlerAction.NO_REPLY as HandlerAction.NO_REPLY

export { HandlerAction, REPLY, NO_REPLY }
