# UI operation coordination

## Required evaluation

For every new or changed screen, component, hook, or asynchronous action, evaluate
whether its pending work must participate in `useFinancialOperations` from
`src/renderer/store/financial-operations.ts`. This evaluation is mandatory;
participation depends on whether the operation conflicts with other UI actions.

Use the shared store for period changes, financial mutations, or reads whose
completion could conflict with navigation or another component's financial action.
Keep unrelated local interactions available. Do not add a global lock solely
because an operation is asynchronous, and do not replace operation-owned loading
and error states with a second copy of those states in the shared store.

## Ownership and guards

- Acquire an operation token before starting conflicting work. Each operation
  owns its release function; release it in `finally`, including on failure or
  cancellation. Nested and overlapping operations release only their own tokens.
- Hold the token through persistence and any required financial refresh.
- Derive disabled states from the pending operations relevant to the interaction.
  Guard action handlers too; disabled controls alone do not prevent stale or
  programmatic actions.
- Preserve request and session generation checks. Recheck after every asynchronous
  boundary that precedes publishing state.
- Clear pending operations on profile-session reset. An older completion must
  never unlock a newer operation or publish into a new session.
- Do not acquire a conflicting token twice for the same action. A mutation may
  start its own coordinated refresh while retaining ownership of its mutation
  token; that internal refresh must not reject its owner as a competing action.

For example, a fictional schedule editor should block period navigation while
saving and refreshing period-dependent data, but its unrelated appearance control
can remain available. A local help-panel fetch does not require a financial token
when its results cannot affect financial state.

## Feedback and verification

Keep notification lifetimes tied to the operation or feature state. The shared
toast viewport is centered at the bottom. Operation-owned loading notifications
must not auto-dismiss or expose a close button, swipe dismissal, or Escape dismissal.
When replacing a loading notification or finishing its operation, remove its
visible instance immediately rather than waiting for an exit animation. Error
notifications may expose retry and must remain dismissible. Do not add a success
notification for period loading.

Close only notifications owned by the feature when its state changes or it
unmounts. Do not close unrelated notifications. A dismissed error should not
reappear merely because unrelated store state changes.

Verify conflicting-action guards, overlapping operations, failures, retries,
session resets, stale responses, and release ownership when relevant. Verify
notification cleanup and unavailable-data presentation separately from successful
loading. Keep tests focused on observable behavior rather than duplicating the
implementation.
