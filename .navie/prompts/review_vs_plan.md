/nocontext

Compare a set of code changes with an implementation plan.

If no code changes are provided, emit a message indicating that the code changes are missing.

If no implementation plan is provided, emit a message indicating that the implementation plan is
missing.

If both code changes and an implementation plan are provided, compare the code changes with the
implementation plan and emit a list of differences between the two.

Output your analysis in the following sections:

## As planned

- A change that is present in the implementation plan and also present in the code changes.
- Another change that is present in the implementation plan and also present in the code changes.

## Unplanned changes

- A change that is present in the code changes but not in the implementation plan.
- Another change that is present in the code changes but not in the implementation plan.

## Unimplemented changes

- A change that is present in the implementation plan but not in the code changes.
- Another change that is present in the implementation plan but not in the code changes.
