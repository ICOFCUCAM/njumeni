# Third-party notices and reuse conditions

Njumeni references these upstream projects for engineering research:

- OpenContracts — https://github.com/Open-Source-Legal/OpenContracts — MIT
- CaseCite — https://github.com/thomasunise/casecite — Apache-2.0
- Lawgent — https://github.com/heyutkarshverma/Lawgent — no licence file found in the initial review; do not copy or distribute its code without permission or a clarified licence.
- Lovspor — https://github.com/bartoszkobylinski/lovspor — AGPL-3.0
- Mike — https://github.com/open-legal-products/mike — AGPL-3.0

Licence observations above are based on the upstream licence files inspected during setup. Re-check the exact commit and all dependency licences before adoption. A repository being public does not itself grant permission to copy, modify, distribute or deploy its code.

For AGPL-3.0 projects, assess the obligations that can apply when modified software is made available over a network. Do not combine AGPL code with Njumeni's proprietary components without a deliberate legal review.

When code is adopted, record the exact upstream commit SHA, licence and version, copyright notices, required licence text, modifications, and Njumeni module using it.

## Data and worker-only runtimes (Task 2.8)

- **Lovdata public data**: https://api.lovdata.no/ — the free datasets of current acts and central regulations are licensed under the Norwegian Licence for Open Government Data (NLOD) 2.0 (stated on https://api.lovdata.no/om-api-tjenesten/, checked 2026-11-12). Short excerpts of two acts are used as test fixtures in `apps/web/tests/legal-knowledge-lovdata.test.mjs`. Source: Lovdata. Downloaded archives are never committed.
- **seek-bzip 2.0.0**: https://github.com/cscott/seek-bzip — MIT. Optional, worker-only bzip2 decoder, installed with `--no-save` on the worker host. It is not a dependency of the web application.
- **intfloat/multilingual-e5-small** (ONNX build `Xenova/multilingual-e5-small`) — MIT. Run by the optional worker-only `@huggingface/transformers` runtime.
