/**
 * The copy guards, re-exported for the test suites.
 *
 * THE DEFINITIONS MOVED TO src/lib/copyGuards.ts IN PHASE 11. They are unchanged;
 * only their home is different, and this file exists so that the twenty-one
 * import sites across eighteen suites did not have to move with them.
 *
 * Why they moved: AI output is generated at runtime and reaches the DOM without
 * ever passing through a test, so invariants 4, 9, and 10 now have to be
 * enforced in production code as well as asserted in suites. A guard that lives
 * under src/test cannot be imported by src/lib without inverting the dependency,
 * and two copies of a guard is how a guard drifts. There is a note in
 * copyGuards.ts about exactly that having happened once already.
 *
 * Import from either path. They are the same objects.
 */

export {
  CALENDAR_RATE_PATTERN,
  CAUSAL_PATTERN,
  DASH_PATTERN,
  DIAGNOSIS_PATTERN,
  DIRECTIVE_PATTERN,
  namesAlcohol,
  OBLIGATION_PATTERN,
  SCOLDING_PATTERN,
} from '../lib/copyGuards.ts'
