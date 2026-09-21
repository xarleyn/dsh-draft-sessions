export const CLIENT_BUNDLE_BUDGET: number;

export interface ClientBundleBudgetResult {
  bytes: number;
  budget: number;
}

export function verifyClientBundleBudget(
  client: string,
  sourceMap: string,
): ClientBundleBudgetResult;
