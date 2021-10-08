# event-sorcerer

EventSorcerer is an event type definition compiler and runtime for event driven systems.

## Dictionary

Agent
Message (receive, dispatch)


## Handlers

A handler is a process (such as a microservice, or a class instance) that consumes and produces various types of events,
commands and alerts.

There are four handler types: aggregate, process manager, event listener and service.

An aggregate is a stateful handler that receives commands and emits events and alerts in response.

An event listener is a stateless handler that notices events emitted by other handlers and emits commands in response.

A process managers combines both aggregate and event listener. This can be treated as a state machine.

A service is a handler that's implementation is arbitrary. Service can optionally receive commands and emit events.
Service should be used when events sourcing isn't the best implementation.

## Messages

Events describe changes in the handler state. The handler state can be restored from the sequence of events.

Alerts describe incidents that happened inside the handler, for example runtime errors. Alerts should not be persisted
and can be used for telemetry.

Commands tell the handler what should be done. The handler can emit events and alerts in response to commands.

Process managers and event listeners can adopt events from other handlers and emit their own commands or commands
adopted from other handlers in response to these adopted events.
