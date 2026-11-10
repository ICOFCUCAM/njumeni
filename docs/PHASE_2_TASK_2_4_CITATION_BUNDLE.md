# Phase 2.4 — Reproducible legal citation bundles

Citation bundles are assembled only from passage identifiers returned by the retrieval result. Each entry preserves stable authority and version IDs, jurisdiction, official citation when supplied, pinpoint, source URI, source-content hash, legal effective period, source attribution and licence identifier.

The bundle refuses to include a passage that was not retrieved, belongs to another jurisdiction, lacks source attribution metadata or is not approved for display. It never invents an official citation when the source did not provide one. Quotation permission is separate from citation display permission: where quotation is prohibited, the citation may be retained with an explicit warning and no source passage text should be reproduced.

A bundle is marked complete only when every requested passage is included and no warning remains. This provides reproducible evidence metadata for downstream legal answer records and audit trails.
