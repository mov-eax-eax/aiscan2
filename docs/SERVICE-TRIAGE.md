# SERVICE TRIAGE - a few pointed questions, not a sweep

The idea: do not enumerate a service. CLASSIFY it. A handful of high-information
questions decides whether a service is in the exposed-namespace class, and almost all of
them are answered by READING the documentation rather than by touching anything.

A sweep costs N requests and answers one question badly. Triage costs 0-3 requests and
tells you whether the sweep was even meaningful.

The instrument inverts the usual order: establish the class from design, and probe ONLY
to break a tie.


## THE DOMINATING QUESTION

    WHO CHOOSES THE IDENTIFIER - the user, or the system?

If the system generates it (128 random bits, a UUID), the answer is NO and you are done.
There is nothing to enumerate. This single question eliminates most services during a
documentation read, and it is the reason ntfy is unusual: it puts the password field in
the user's hands.

Everything below only matters after this question returns "the user".


## TIER 0 - DOCUMENTATION ONLY, ZERO REQUESTS

    Q1  Who chooses the identifier?              user  |  system-generated
    Q2  Namespace shape?                         flat & global  |  per-account tenant
    Q3  Does CLAIMING a name require auth?       yes  |  no
    Q4  Does READING require auth?               yes  |  the identifier IS the secret
    Q5  Is there an ENUMERATION PRIMITIVE?       wildcard / index / search / feed  |  none
    Q6  Does the identifier appear in URLs,      yes  |  no
        logs, caches or referrers?

Q5 is the most under-appreciated. It decides your METHOD, not your verdict:

    PRIMITIVE EXISTS     the name list is irrelevant. ONE request replaces the entire
                         sweep - subscribe the wildcard, read the index, page the feed.
                         Guessing names on such a service is strictly wasted effort.
    NO PRIMITIVE         the namespace is only reachable by guessing. This is the ntfy
                         case, and it is the ONLY case where name enumeration is
                         even a coherent technique.

Q6 is why capability URLs are worse than they look: the identifier leaks into every
proxy, cache and Referer header on the path. An architecture decision record found in
the wild states the rule plainly - tokens never in URLs - which is exactly anotifier's
warning in different words ("ntfy topic names are guessable rather than access-controlled
secrets"). The correct design is known, documented and shipped. The exposed population is
the error rate of that default.


## TIER 1 - AT MOST THREE PROBES, AND ONLY TO BREAK A TIE

Run these ONLY when the docs are ambiguous - which is rare. Each answers a distinct
question, and the third one is the only probe that could ever justify a larger effort.

    P1  Request ONE deliberately-unlikely random identifier.
        Three things fall out of one request:
          - side effect: does asking CREATE it? (a read with a write side effect)
          - auth layer: 401/403 vs 200
          - distinguishability: is "unknown" different from "empty"?

    P2  Request ONE obviously-common name (a bare word).
        Does a claim/auth layer exist at all, and is the obvious name already taken?

    P3  Request the ENUMERATION PRIMITIVE, if Q5 says one exists.
        Wildcard subscribe, index page, search endpoint, public feed.
        THIS IS THE ONE REQUEST THAT SUBSTITUTES FOR A SWEEP.

If Q5 is "none" and Q1 is "user", then the class is real AND only reachable by guessing -
and that combination is the single case where enumeration has any point. It is also
exactly the case we were banned for pursuing. Prefer P3 or read someone else's results.


## CALIBRATION - four services, one table

                          ntfy.sh        public MQTT     Firebase RTDB    AWS SNS
    Q1 who chooses        user           user            user             user
    Q2 namespace          flat/global    flat/global     global ids       PER-ACCOUNT
    Q3 claim requires auth NONE          NONE            account          account (IAM)
    Q4 read requires auth  NONE          NONE            rules-dependent  IAM
    Q5 enumeration       none native    WILDCARD #      index via API    none
    Q6 id in URLs         YES (the path) logged          project subdomain ARN, not secret
    ---------------------------------------------------------------- ------------
    VERDICT               IN CLASS       IN CLASS, WORSE  IN CLASS (read)  OUT OF CLASS

The last column is the most useful one, because it is the NEGATIVE CONTROL. SNS is the
same MECHANISM - a pub/sub notification service, and Elastic Security Labs documented it
being used for data exfiltration, which is our finding one layer over. It is still out of
class. Why: the namespace is per-account and IAM governs access, so abuse requires
credentials and there is nothing to enumerate.

    SAME MECHANISM, DIFFERENT NAMESPACE, COMPLETELY DIFFERENT EXPOSURE.

That is the thesis of the whole project in one row. The pub/sub is not the problem. The
absent tenant boundary is.


## THE DECISION RULE

    1. Q1 returns "system-generated"        -> OUT. Stop. Costs one doc read.
    2. Q2 is per-tenant AND Q3/Q4 authed    -> OUT. Stop. (This is SNS.)
    3. Any of Q3 / Q4 / Q5 is open          -> IN CLASS.
    4. IN CLASS, and already measured by an accountable party (Censys, Shodan, a vendor
       research team, an academic group)   -> READ IT. Do not re-scan.
    5. IN CLASS, Q5 says a primitive exists -> ONE request. Never a sweep.
    6. IN CLASS, no primitive, unmeasured  -> this is the only genuinely open case, and
                                              it is where you decide whether the answer is
                                              worth creating resources on a third party.

Step 4 is the one that matters most in practice, because the measurement industry already
exists: Censys publishes continuous internet-wide scans, publishes AI-exposure trends, and
published an internet census of exposed MCP servers - which is where our single topic-mcp
artifact came from. We are a row in that dataset. Reading it would have taught us the
same thing for free.


## WHY THIS INSTEAD OF A SWEEP

    A sweep answers ONE question badly at N requests per service.
    Triage answers SIX questions at 0-3 requests, and tells you whether the sweep meant
    anything at all.

    Polling an unknown name CREATES it. A 200-service sweep is a resource-creation event
    on 200 third parties, to learn a property already established.

    The generalisation was never the bottleneck. The ntfy result generalised immediately
    and completely - and OpenAI's own later disclosure supplied the same shape at the
    frontier: ~700 agents, coordinating through an UNAUTHORISED MESSAGE BOARD, with
    nearly one in five interested in manipulating the evidence.

    We already had the answer. We needed a better question, not a bigger scan.
