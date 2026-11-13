---
title: 'Refactoring Swift: A Catalog of 10 Essential Practices for Code Improvement'
description: A data-driven catalog of ten Swift refactoring practices derived from open-source repositories and evaluated by Swift developers.
authors: [Mohamed Rafat (corresponding author), Mohammed El-Ramly, Lamia Abo Zaid]
year: 2026
venue: 'Journal of Software: Evolution and Process, 38(11)'
paper: https://onlinelibrary.wiley.com/doi/10.1002/smr.70180
code: https://github.com/mohamedrafatfcih/SwiftRefactoringCatalog
---

This study introduces a practical catalog of ten refactoring practices for Swift. Rather than proposing patterns in isolation, the authors derived them from changes made in real open-source Swift projects, then asked Swift developers to assess the catalog.

## How the catalog was developed

The authors used a Grounded Theory approach to examine commit histories from ten active and popular Swift repositories. The projects cover areas such as networking, image loading, animation, charting, databases, code generation, Bluetooth, and macOS apps. Recurring code changes were grouped into named refactorings and documented with their rationale, mechanics, and before-and-after examples.

An exploratory survey with Swift developers provided a second perspective on the proposed practices. The linked repository preserves the selected-repository list, commit-level examples, counts by repository, and aggregated, anonymized survey feedback. The findings describe patterns in this sample; the catalog is a practical reference, not an exhaustive list of every useful Swift refactoring.

## The ten refactorings

### 1. Refactoring to a protocol

Introduce a protocol for the behavior a caller needs, then make concrete types conform to it. Code that accepts the protocol can work with different implementations without depending on one specific class or struct.

### 2. Refactoring to a protocol extension

Move behavior shared by protocol conformers into a protocol extension. This provides a common implementation in one place and lets each conforming type focus on the behavior that is unique to it.

### 3. Refactoring to a class or struct extension

Move a focused set of helpers, protocol conformance, or app-specific behavior into an extension. This keeps a type's primary declaration easier to scan and groups related functionality without changing its stored state.

### 4. Refactoring to enum cases with parameters

Attach the data needed by each enum case as associated values, such as `case failure(Error)`. The state and its payload then travel together, reducing loosely related flags or optional values that callers must keep consistent.

### 5. Refactoring to an enum extension

Give an enum a named computed property or helper in an extension. When the same `switch` or conditional is repeated across callers, a property such as `isSuccessful` makes the intent explicit and centralizes the rule.

### 6. Renaming a protocol

Choose a protocol name that describes the role or capability of its conformers. A name such as `Notifiable` communicates what a type can do more clearly than a vague or implementation-specific name.

### 7. Safely unwrapping optionals with `guard` or `if let`

Replace a forced unwrap with an explicit path for the `nil` case. `guard let` works well when the function should exit early; `if let` keeps handling inside the scope where the value exists.

### 8. Deferring work with `defer`

Use `defer` for cleanup that must happen when the current scope exits, including when an early return occurs. It keeps paired setup and cleanup reliable without repeating cleanup statements along each branch.

### 9. Naming a function parameter

Use a meaningful external argument label so the call site reads naturally and says how the value is being used. For example, labels can distinguish source and destination values in a move operation.

### 10. Making the argument label optional at the call site

Use `_` as the external label when the function name already makes the argument's role clear. A declaration such as `append(_ item: Item)` allows `append(item)` instead of repeating the label as `append(item: item)`.

Together, these practices address type boundaries, state representation, safety, cleanup, and API readability. Each is a small structural change intended to make the code's design easier to understand while preserving its behavior.
