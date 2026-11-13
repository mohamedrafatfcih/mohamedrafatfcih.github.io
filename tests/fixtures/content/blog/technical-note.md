---
title: Technical writing verification
description: A test fixture for code, diagrams, equations, and technology tags.
date: 2020-01-01
category: Software Engineering
tags: [Swift, C++, New Technology]
attachments:
  - id: 11111111-1111-4111-8111-111111111111
    name: Architecture demo
    url: https://example.org/architecture.mp4
    kind: video
---
## Code with syntax highlighting

```swift
struct Notebook {
    let title: String
    func write() async -> String { "An intentionally long code example that should scroll inside its own block on a small phone without making the entire page overflow." }
}
```

[[attachment:11111111-1111-4111-8111-111111111111]]

## A diagram

```mermaid
flowchart LR
  accTitle: Publishing flow
  accDescr: Content is written in Markdown, built by Astro, and published on GitHub Pages.
  A[Markdown] --> B[Astro]
  B --> C[GitHub Pages]
```

## Math

An inline expression: $E = mc^2$.

$$
\sum_{i=1}^{n} i = \frac{n(n+1)}{2}
$$
