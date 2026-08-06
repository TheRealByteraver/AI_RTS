# Coding conventions

## Conventions for both the frontend and the backend

- only use arrow style functions
- No single character variable names but full words. In case of variable naming conflicts, use leading underscores for the narrower-scoped variables. For further naming conflicts, abbreviate the variable names by omitting the vowels. As a last resort, fall back to single character variable names.

- **TypeScript strict mode** — no `any`, no unchecked casts
- **Zod for all external data** — never use `as SomeType` on unvalidated input
- **Shared types live in /packages/shared** — never duplicate types across packages
- **No game logic in the renderer** — simulation state is plain data; renderer is a pure function of state
- **All networking behind GameTransport interface** — no direct WebSocket calls in game logic

## Frontend coding conventions

- In every React component, use the following section structure and comments (omit a section if it is empty):
1. `// PROPS` — first line of any component that receives props, immediately followed by destructuring of `props`. The component must accept a single argument `props: Props`. The `Props` type must be defined directly above the component declaration.
2. `// STATE` — all `useState` assignments grouped together.
3. `// HOOKS` — all custom hook assignments grouped together.
4. `// EFFECTS` — all `useEffect` calls grouped together.
5. `// METHODS` — all function declarations grouped together.
6. `// VARS` — all other `var`/`let`/`const` declarations grouped together.
7. export the function manually at the bottom of the file. Do not inline the `export` keyword in the function declaration.

Maintain this order as much as the code allows. If code dependencies force a section to appear more than once, append a part number to the comment, e.g. `// VARS, part 2`.

JSX return(s) come after all sections.