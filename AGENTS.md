# Repository AI context

## Navigation tools

- **Serena** is the preferred semantic and symbol-level code navigation system. Use it first for normal coding, symbol lookup, reference tracing, and localized changes.
- **Repomix** is the repository-level architecture map. Use it only when a task truly needs whole-repository context: cross-file change planning, architecture audits, entering an unfamiliar area, or planning a major refactor.
- Keep Repomix on demand. Do not run it automatically before every coding task, and do not regenerate it for routine local edits.

## Generate the repository map on Windows

From the repository root in PowerShell:

```powershell
npx repomix@latest --config repomix.config.json
```

This writes `.ai/repomix-output.xml`. The output is generated local context and is ignored by Git. The command uses `npx`; Repomix does not need a global install or a permanent project dependency.
