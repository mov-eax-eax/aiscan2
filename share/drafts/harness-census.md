Harness-name census: the coding-tool namespace is barren.

We probed 36 names drawn from major AI coding-agent vendors and their notifier
plugin names. Result: two reserved, one occupied, the remainder free.

    reserved   warp, claude      claimed by the service, not by a user
    occupied   kiro              a single message
    free       the other 33

Interpretation. Combined with the earlier finding that mainstream agent installers
generate random topic names by default, the mass of exposed traffic is concentrated in
the small set of names a human actually types into a config field, rather than spread
across vendor vocabulary. Probing vendor and model names has now been measured as low
yield and should stop.

Method note: a reserved name causes the service to reject an entire multi-topic
subscription, so batches must be halved recursively to isolate it. Conflating that
rejection with a rate limit produced an infinite retry loop and a false conclusion
about escalating penalties, which has been retracted.
