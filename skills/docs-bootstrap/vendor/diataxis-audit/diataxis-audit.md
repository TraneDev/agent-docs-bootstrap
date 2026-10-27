---
name: diataxis-audit
description: >
  Audit existing documentation against the Diátaxis framework's four quadrants.
  Use when reviewing documentation that feels unclear, when assessing documentation
  quality, or when preparing for a documentation reorganization.
metadata:
  author: "Georges Martin <jrjsmrtn@gmail.com>"
  version: "0.1.5"
license: MIT
---

# Diátaxis Documentation Audit

Audit existing documentation against the [Diátaxis](https://diataxis.fr/) framework to identify mixed quadrants, gaps, and quality issues.

## Diátaxis Compass

```
           Practical           Theoretical
        +----------------+------------------+
Study   |   TUTORIALS    |   EXPLANATION    |
        |   (learning)   | (understanding)  |
        +----------------+------------------+
Work    |   HOW-TO       |   REFERENCE      |
        |   (problem)    |  (information)   |
        +----------------+------------------+
```

**Key principle**: These quadrants must remain distinct. Blurring boundaries is the most common documentation problem.

## When to Use

- Reviewing documentation that feels unclear or difficult to use
- Assessing documentation quality before a release or handoff
- Preparing for a documentation reorganization
- Onboarding to an unfamiliar project and evaluating its docs

## Required Inputs

1. **Documentation path(s)**: Files or directories to audit
2. **Scope** (optional): Full audit or quick spot-check

## Workflow

### Phase 1: Inventory

Read all documentation files in the target path. For each file, record:
- File path
- Apparent intent (what quadrant it seems to target)
- Length and structure

### Phase 2: Classify

For each document or section, classify using these questions:

| Question | If Yes → |
|----------|----------|
| Is it a guided learning experience building to a result? | **Tutorial** |
| Does it solve a specific, practical problem? | **How-to guide** |
| Does it describe the system factually and completely? | **Reference** |
| Does it explain why things work the way they do? | **Explanation** |

If a section answers multiple questions, it is **mixed** — flag it.

### Phase 3: Detect Red Flags

Check each document against its quadrant's anti-patterns:

**Tutorials that**:
- Explain concepts before showing action
- Offer choices or alternatives
- Assume prior knowledge of the system
- Don't build to a concrete, testable result

**How-to guides that**:
- Teach from scratch instead of assuming competence
- Explain theory instead of giving directions
- Don't state the goal upfront
- Have only one rigid path (no flexibility)

**Reference that**:
- Includes step-by-step instructions
- Uses conversational or narrative tone
- Is incomplete or inconsistent in coverage
- Mixes in opinions or recommendations

**Explanation that**:
- Is just a list of bare facts
- Includes procedural steps
- Doesn't connect to the "why"
- Lacks context or historical perspective

### Phase 4: Gap Analysis

Check which quadrants are missing entirely:
- No tutorials? New users have no guided onboarding.
- No how-to guides? Experienced users can't solve specific problems.
- No reference? Developers can't look up details.
- No explanation? Nobody understands the design rationale.

### Phase 5: Quality Assessment

For documents that are correctly classified, assess quality:

**Tutorial quality**:
- Could a complete beginner succeed on first try?
- Does it build to a concrete result?
- Are steps small and testable?
- Does it inspire confidence and motivation?

**How-to quality**:
- Does it solve a real problem users actually have?
- Can users adapt the steps to their situation?
- Does it assume appropriate competence?
- Is the goal stated clearly upfront?

**Reference quality**:
- Can users find information quickly?
- Is coverage consistent and comprehensive?
- Is it authoritative and trustworthy?
- Is it structured for scanning, not reading?

**Explanation quality**:
- Does it produce understanding ("aha!" moments)?
- Does it connect concepts to motivations?
- Does it discuss trade-offs honestly?
- Does it help users make better decisions?

## Outputs

Generate an audit report containing:

- [ ] **Summary table**: Each document with its classification, quality rating, and issues
- [ ] **Mixed content**: Specific sections that blend quadrants, with extraction recommendations
- [ ] **Gap analysis**: Missing quadrants and their impact
- [ ] **Priority recommendations**: Ordered list of improvements, highest impact first
- [ ] **Cross-linking opportunities**: Where documents should reference each other

## Report Format

```markdown
# Diátaxis Audit Report

## Summary

| Document | Intended Quadrant | Actual Quadrant(s) | Quality | Issues |
|----------|-------------------|---------------------|---------|--------|
| ... | ... | ... | ... | ... |

## Mixed Content (requires splitting)

### [filename]
- Lines N-M: Tutorial content mixed into reference → extract to tutorials/
- Lines X-Y: Explanation mixed into how-to → extract to explanation/

## Missing Quadrants

- [ ] Tutorial: [impact of absence]
- [ ] How-to: [impact of absence]
- [ ] Reference: [impact of absence]
- [ ] Explanation: [impact of absence]

## Recommendations (priority order)

1. [Highest impact action]
2. ...
```

## Validation

- Every document is classified into exactly one quadrant (or flagged as mixed)
- Red flags are specific: cite the document, section, and line range
- Recommendations are actionable and prioritized

## Related Skills

- `diataxis-convert`: Split mixed documents identified by this audit
- `diataxis-create`: Fill gaps identified by this audit
- `diataxis-plan`: Design the target documentation architecture
