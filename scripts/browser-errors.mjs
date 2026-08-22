const EXPECTED_HOST_OUTAGE_ERROR =
  /\b(?:net::ERR_(?:CONNECTION_(?:ABORTED|CLOSED|REFUSED|RESET)|INCOMPLETE_CHUNKED_ENCODING)|WebSocket connection to '.+' failed: Connection closed before receiving a handshake response)\b/;

export function isExpectedBrowserError(error) {
  return (
    (error.duringHostOutage &&
      EXPECTED_HOST_OUTAGE_ERROR.test(error.message)) ||
    error.message.includes("the server responded with a status of 404")
  );
}
