# EventSorcerer ✨🧙🏿‍♂️

An event type definition compiler and runtime for event driven systems.

## Messages

Message is a central part of the event driven system. Messages come in several flavors:

- **Commands** describe what should be done.
- **Events** describe a fact of the system state change.
- **Alerts** describe a non-essential facts that didn't affect the system state. These can be used for errors or
  telemetry.

Most of the time, system agent would receive a command and respond with an event. While commands and alerts are
ephemeral (they shouldn't be persisted), events must be persisted, so system state can be reproduced from the sequence
of events.

## Agents

An agent consumes and produces various types of messages.

There are five agent types:

- **Aggregate** is a stateful projection of events that can be altered with commands.
- **Event Listener** is a stateless agent that captures events that were dispatched by other agents and produces
  commands.
- **Process Manager** is a hybrid of Aggregate and Event Listener. It has state and also can capture events from other
  agents.
- **Service** is an agent that uses commands and events for communication but has an arbitrary internal implementation.
  For example, this agent type can be used to implement cron, or an adapter to non-event oriented storage.
- **Monitor** is the only agent type that can capture alerts dispatched by other agents. Since alerts are ephemeral
  monitor agent may implement telemetry or other functions that aren't business-related.

A single business unit of your system (a microservice or a process) may implement multiple agents that work in scope of
a bounding context.

## Good reads

- [Versioning in an Event Sourced System by Gregory Young](https://leanpub.com/esversioning/read)
- [Is your microservice a distributed monolith? by Andre Newman](https://www.gremlin.com/blog/is-your-microservice-a-distributed-monolith/)
- [The Twelve-Factor App](https://12factor.net/)
