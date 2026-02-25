# Extension Agent Guide

## Error Handling

- Model control flow in a Rust-y style using `Option`/`Result` patterns.
- Prefer explicit `Option`/`Result` returns and propagation over throwing errors.
- Use thrown exceptions only when there is no practical typed alternative.

## TypeScript Style

- Do not add explicit `Promise<void>` return annotations on async functions.

## Formatting and Linting

- Run `just fmt` to format code.
- Run `just lint` before committing. Commits must not be made with lint failures.
