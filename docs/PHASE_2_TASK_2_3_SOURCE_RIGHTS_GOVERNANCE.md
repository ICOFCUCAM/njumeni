# Phase 2.3 — Legal-source rights and permissions governance

The rights record is distinct from a source's technical availability. A reachable URL or public document does not establish a right to retrieve, store, normalise, index, quote, display or redistribute it.

The governance contract requires a source-specific licence identifier, optional version, HTTPS terms URI, attribution text, reviewer identity, review timestamp, permission matrix, restrictions and optional review expiry. The ingestion gate requires explicit retrieve, store, normalise and index permissions plus an approved, active and enabled source. Display/quotation and redistribution have separate checks and are not inferred from ingestion approval.

Rights review is time-bounded where an expiry is supplied. Expired evidence blocks use. Source-specific legal review must be recorded before updating the database source record to approved/active/enabled. These TypeScript checks complement, but do not replace, database constraints and human legal review.
