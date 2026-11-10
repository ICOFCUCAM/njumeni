# CMP Legacy Archive — Preservation Manifest

**Status:** PREPARED — awaiting creation of the separate archive repository  
**Source repository:** `ICOFCUCAM/njumeni`  
**Original source commit:** `0d9c90ff8e45477d25ed681aa6e29135b0bfbe7f`  
**Source commit URL:** https://github.com/ICOFCUCAM/njumeni/commit/0d9c90ff8e45477d25ed681aa6e29135b0bfbe7f  
**Intended archive repository:** `ICOFCUCAM/njumeni-cmp-archive`

## Preservation rule

The files listed below belong to the legacy Consent Management Platform (CMP), not to the Njumeni legal platform. They must be copied without modification into the separate archive repository. Do not delete, rename, or repurpose the source files in Njumeni until the archive repository contains every file, its tree has been inspected, and the archive commit is verified.

## Exact source inventory

All blob identifiers below were retrieved from the original source commit, not inferred from the current working tree.

| Original path | Original Git blob SHA | Bytes (UTF-8 character count) | Archive path |
|---|---|---:|---|
| `README.md` | `2719594cd0bc8428ec901574692b60daa7aa8673` | 919 | `README.md` |
| `docs/ARCHITECTURE.md` | `b43ba24467af97c0fb3aa45270a42297d1555ba8` | 12,532 | `docs/ARCHITECTURE.md` |
| `site/index.html` | `31062afaedcf58046583730c6e8c9db876287441` | 32,779 | `site/index.html` |
| `site/css/main.css` | `50844c38edbf32156e5aae059eeb520efdf106c1` | 29,007 | `site/css/main.css` |
| `site/css/tokens.css` | `7444002bf771d07fc8848c7aced2eda45d70674c` | 3,720 | `site/css/tokens.css` |
| `site/js/main.js` | `b5fbe80473f6427c2274fba9b86752d2f75fc0ce` | 7,006 | `site/js/main.js` |

## Transfer and verification checklist

- [ ] Create `ICOFCUCAM/njumeni-cmp-archive` as a separate GitHub repository.
- [ ] Transfer all six files at the exact archive paths above, preserving their contents.
- [ ] Include this manifest in the archive repository.
- [ ] Verify all six archived file contents against the source commit/blob IDs.
- [ ] Verify the archive tree contains the expected six files plus this manifest and no Njumeni legal-platform source or customer data.
- [ ] Record the archive commit SHA and repository URL here and in `docs/PHASE_REGISTER.md`.
- [ ] Only after verification, remove CMP files from the Njumeni repository in a separately reviewed commit.

## Notes

- The current Njumeni `README.md` has since been replaced by the legal-platform README. The original CMP README must be taken from the source commit above.
- The current `docs/ARCHITECTURE.md` and `site/` files remain in the Njumeni tree pending verified transfer.
- This manifest records provenance and transfer requirements; it is not itself proof that the separate archive exists.
