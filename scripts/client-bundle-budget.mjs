export const CLIENT_BUNDLE_BUDGET = 80 * 1024;

const ZOD_SOURCE_PATTERN = /(?:^|[\\/])zod(?:[\\/]|$)/u;

export function verifyClientBundleBudget(client, sourceMap) {
  const bytes = Buffer.byteLength(client);

  if (ZOD_SOURCE_PATTERN.test(client) || ZOD_SOURCE_PATTERN.test(sourceMap)) {
    throw new Error("client bundle must not contain Zod");
  }

  if (bytes > CLIENT_BUNDLE_BUDGET) {
    throw new Error(
      `client bundle is ${bytes} bytes and exceeds the 80 KiB budget (${CLIENT_BUNDLE_BUDGET} bytes)`,
    );
  }

  return { bytes, budget: CLIENT_BUNDLE_BUDGET };
}
