---
title: Swift Refactoring Catalog
description: A research-backed catalog of ten practical refactoring techniques for improving Swift code.
context: Cairo University
period: '2026'
tags: [Swift, Software Engineering, Research]
order: 4
repository: https://github.com/mohamedrafatfcih/SwiftRefactoringCatalog
---

The Swift Refactoring Catalog turns recurring changes in Swift code into ten named, explained practices. Its goal is to make common improvements easier to recognize and apply, with examples grounded in repository history.

## Methodology

### 1. Choose a varied set of Swift repositories

The study selected ten active and popular open-source projects. They span networking (Alamofire), image loading (Kingfisher and Nuke), animation (Lottie), charting (Charts), persistence (Realm Swift and SQLite.swift), code generation (SwiftGen), Bluetooth LE (Bluejay), and a macOS video player (IINA). This gives the analysis examples from different kinds of Swift code.

### 2. Analyze commit histories

Using a Grounded Theory approach, the authors examined commits for concrete code changes that improved design, grouped recurring changes into refactoring categories, and refined the catalog from those observations. The repository records detected examples with links to their source commits and counts for each refactoring across the selected projects.

### 3. Gather developer feedback

An exploratory survey with Swift developers provided feedback on the proposed catalog. The repository includes aggregated, anonymized survey results alongside the analyzed commit data. The method therefore combines examples of changes made in practice with practitioner feedback; its scope remains the ten selected projects and an exploratory evaluation.

## The catalog's ten refactorings

### Protocols and type organization

- **Refactor to a protocol:** Define a behavior contract so callers can depend on capabilities rather than one concrete implementation.
- **Refactor to a protocol extension:** Put shared default behavior in one extension instead of duplicating it across conforming types.
- **Refactor to a class or struct extension:** Group focused helpers, conformances, or app-specific behavior outside the type's main declaration.
- **Rename a protocol:** Give the protocol a name that describes the role of the types that adopt it.
- **Refactor to an enum extension:** Move repeated enum-related logic into a named computed property or helper.

### State, safety, and cleanup

- **Use enum cases with parameters:** Store the data for a state in that case, so invalid combinations of separate values are harder to represent.
- **Safely unwrap optionals:** Use `guard let` or `if let` to handle absence explicitly instead of relying on a force unwrap.
- **Defer cleanup:** Put scope-exit work in `defer` so it still runs when a function returns early.

### Clearer function calls

- **Name a function parameter:** Use an external argument label that explains the value's role at the call site.
- **Make the argument label optional:** Use `_` when the function name already supplies enough context, avoiding a redundant label in the call.

The repository contains the [selected repositories](https://github.com/mohamedrafatfcih/SwiftRefactoringCatalog/blob/master/repositories_refactorings/selected_repositories.csv), [commit-level examples](https://github.com/mohamedrafatfcih/SwiftRefactoringCatalog/tree/master/repositories_refactorings/Refactorings), and [survey data](https://github.com/mohamedrafatfcih/SwiftRefactoringCatalog/tree/master/Data). The [paper](https://onlinelibrary.wiley.com/doi/10.1002/smr.70180) gives the full research account.
