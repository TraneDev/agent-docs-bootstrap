# Architecture diagram format

Two C4 levels, both in one file `docs/architecture.md`, diagrams in Mermaid (`C4Context`, `C4Container`) so that GitHub and GitLab render them and an agent reads them as text.

## File structure

```
# <project> architecture

One or two sentences: what the system does and for whom.

## Context

Diagram: the system as one box, users and external systems around it.
Table of external systems: name, why it is needed, data direction, owner/contact (if known).

## Container

Diagram: deployment units and the links between them with protocol.
Table of containers: name, technology, responsibility, where it is deployed, where it is configured.

## Not described here

Component and Code levels are deliberately not kept. Internal structure lives in the AGENTS.md of the relevant area.
```

## Rules

- A container is what deploys separately. Check: there is a Dockerfile, a CI job or a deployment manifest.
- Every link is labelled with a protocol or mechanism (HTTP/JSON, gRPC, queue, shared database).
- An external system goes on Context only with a human's confirmation: the code shows a call, the human knows what that system is.
- No more than 12 nodes per diagram. More means the wrong level was chosen or the system needs splitting.
