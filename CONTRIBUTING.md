# Contributing

Thanks for contributing to OnceOnly TypeScript SDK.

## Scope

This repository contains the TypeScript/JavaScript SDK for OnceOnly API.
Please keep changes focused on:

- SDK correctness and API compatibility
- strong typing and predictable runtime behavior
- tests, examples, and docs aligned with code

## Prerequisites

- Node.js 20+
- npm

## Local Setup

```bash
npm install
```

## Development Commands

Build artifacts:

```bash
npm run build
```

Build consistency check:

```bash
npm run check
```

Run tests:

```bash
npm test
```

Release consistency checks:

```bash
npm run release:check
```

## Coding Guidelines

- Keep public API stable unless change is intentional and documented.
- Preserve parity with backend endpoint contracts.
- Keep TypeScript strictness intact; avoid loosening types without strong reason.
- Prefer small, explicit transformations over hidden magic.
- Update examples/docs when public behavior changes.

## Pull Request Checklist

- [ ] Tests added or updated for behavior changes.
- [ ] `npm test` passes locally.
- [ ] `README.md` updated for user-visible API changes.
- [ ] `CHANGELOG.md` updated for user-visible changes.
- [ ] No unrelated refactors bundled into the same PR.

## Commit Guidance

- Use focused commits with clear titles.
- Keep one logical change per commit when possible.

## Reporting Issues

When opening an issue, include:

- SDK version
- Node.js version
- minimal reproducible snippet
- expected vs actual behavior
- backend response/status (if available)

For security-sensitive reports, contact: `support@onceonly.tech`.
