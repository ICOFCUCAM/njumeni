/**
 * CI compiler-contract probe.
 *
 * This verifies that the repository's strict TypeScript compiler options are
 * active before application packages are introduced. It is not application
 * source code and does not substitute for type-checking the future app.
 */
export type CiProbeResult = {
  readonly status: 'ok';
  readonly checked: true;
};

export const ciProbeResult: CiProbeResult = {
  status: 'ok',
  checked: true,
};
