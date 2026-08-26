---
name: Vite JSX runtime
description: A preview-specific JSX transform detail for this Vite setup.
---

The current Vite preview transform expects JSX components to have React available at runtime, so JSX component files should keep an explicit React import even when hooks are imported separately.

**Why:** The initial page compiled successfully but rendered a blank preview with `React is not defined` until the explicit import was restored.

**How to apply:** When adding or editing JSX components in this project, preserve `import React ... from "react"` unless the Vite JSX runtime configuration is intentionally changed and verified.