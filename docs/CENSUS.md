# The census scanner: explained

## What we found on topic `mcp`

    {"jsonrpc":"2.0","id":6075992,"method":"initialize","params":{
      "protocolVersion":"2025-06-18",
      "capabilities":{"sampling":{},"elicitation":{},"roots":{"listChanged":true}},
      "clientInfo":{"name":"internet-census-mcp-scanner","version":"1.0.0"}}}

Frozen: same id, same timestamp, hours apart. One probe, never repeated.

## The mechanism: cross-protocol path collision

ntfy-mcp (github.com/jpetrucciani/ntfy-mcp) is a Rust MCP server whose transport is
MCP Streamable HTTP at the path /mcp. It uses ntfy only to SEND notifications.

m-q-t/mcp-server-scanner is a Go tool: "detect exposed mcp servers over the internet
and enumerate their tools".

So an internet scanner walks hosts and POSTs a JSON-RPC initialize to
https://<host>/mcp. But https://ntfy.sh/mcp is a valid ntfy PUBLISH endpoint, and
"mcp" is just a topic name. The scanner's MCP handshake was therefore accepted by
ntfy and stored as an ordinary notification in the public topic mcp.

It is not a peer on ntfy. It is an MCP scanner hitting a URL that happens to look
like an MCP endpoint. The request id 6075992 is that scanner's probe counter across
its entire internet sweep.

## Why this matters

ntfy's namespace is /<topic>. MCP's conventional endpoint is /mcp. Any topic whose
name matches a well-known HTTP endpoint path will silently collect other people's
probe traffic: mcp, sse, messages, jsonrpc, rpc, api, v1, tools, initialize,
webhook, hook, callback, health, status, metrics, admin, graphql, rest.

This is a NEW detection category: probe-crossfire - traffic that is not a user of
ntfy at all, but a scanner of some other protocol colliding with the path namespace.

We cannot verify by publishing to those topics; that would add to the collision.

## The related paper

arXiv 2609.14119, "Same Name, Different Server: A Security Census of Silent Drift in
the Model Context Protocol Ecosystem", submitted 12 Sep 2026. This is a DIFFERENT
census: the public MCP registry, not internet exposure.

  21,643 servers, 72,606 version records harvested
  14,353 server sources fetched and pattern-scanned
  9.57% of scanned servers showed unauthenticated network exposure
  51.1% of multi-version servers changed what they advertise
  40.6% did so silently
  4.2% redirected their remote endpoint to a different host, keeping registry identity
  silent drift -> OR 2.96 for a high-severity finding

"Unauthenticated network exposure" is exactly what an ntfy topic does when it
collides with /mcp: it answers, unauthenticated, to a protocol it does not speak.
