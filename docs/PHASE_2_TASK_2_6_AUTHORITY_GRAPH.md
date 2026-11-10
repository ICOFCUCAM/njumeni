# Phase 2.6 — Legal authority graph traversal

The authority graph contract traverses source-backed, directed legal relationships such as amendment, repeal, implementation, interpretation, application, overruling and citation. Traversal is breadth-first, bounded by depth and node count, supports an explicit as-of date and relationship-type filter, and preserves the provenance URI on every traversed edge.

Cycles are safely ignored within an individual path. The traversal reports when a node limit truncates expansion. It does not infer that an authority is legally repealed, amended or binding merely because a relationship edge exists; legal effect remains dependent on verified source evidence, effective dates and jurisdiction-specific rules.
