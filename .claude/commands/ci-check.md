Run the same CI lint/build checks locally before committing. Fix any errors found, then commit and push.

## Steps

1. **Frontend checks** (in `ars-editor/`):
   - Run `npm ci` if `node_modules` is missing
   - Run `npm run lint` (ESLint)
   - Run `npx tsc -b` (TypeScript type check)
   - Run `npm run build` (Vite build)

2. **Rust checks** (in `ars-editor/src-tauri/`):
   - Run `cargo clippy --features web-server --no-default-features --bin ars-web-server -- -D warnings`
   - Run `cargo build --features web-server --no-default-features --bin ars-web-server`

3. **If all pass**: Stage changed files, commit with a descriptive message, and push.
4. **If any fail**: Fix the errors and re-run the failing check until it passes, then commit and push.
