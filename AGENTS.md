# Extension Agent Guide

## Error Handling

- Model control flow in a Rust-y style using `Option`/`Result` patterns.
- Prefer explicit `Option`/`Result` returns and propagation over throwing errors.
- Use thrown exceptions only when there is no practical typed alternative.

## TypeScript Style

- Do not add explicit `Promise<void>` return annotations on async functions.

## User Gesture Safety

- Keep privileged calls in direct user-gesture handlers on the synchronous path.
- Do not place `await` before gesture-gated APIs such as `browser.sidePanel.open`, permission prompts, tab/window open calls, or similar browser APIs.
- If additional async work is needed, perform the privileged call first, then run follow-up work (e.g. with `void` fire-and-forget or after the gated call completes).

## Change Diffs

- Before asking permission to edit files, show a proper unified diff (readable delta) of intended changes.
- Do not present edit intent only as Perl/sed regex commands; include the readable delta first.

## Formatting and Linting

- Run `just fmt` to format code.
- Run `just lint` before committing. Commits must not be made with lint failures.
