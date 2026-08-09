# Sentinel holistic-review benchmark

Date: 8 August 2026
Cases: OBBS (260), OBMF (259), The Concord Review (255)
Method: official-source research was completed and frozen separately in `independent_expected.json`; Sentinel then ran through its real collection, dossier, mapping and validation pipeline with database persistence disabled.

## Outcome

| Opportunity | Before fixes | Final reviewer | Comparison with independent research |
|---|---|---|---|
| OBBS | Removed `Agosto` and wrote `null`; did not reconcile status | Produces a complete 2026 date, current official URL, concise description, clean audience, application steps, eligibility, tips and awards | Strong semantic match on most content fields. Deadline/status remain a documented official-source conflict: independent browser fetch showed 7 August, while Sentinel's raw HTTP source showed 14 August. Language remained unset because no citation explicitly stated it. |
| OBMF | Removed `Setembro` and wrote `null`; crawled regulations for unrelated olympiads | Produces `23 de setembro de 2026`, concise description, clean audience and concise benefits; only four relevant pages fetched | Exact deadline match. Existing level, location, cost, eligibility, type and status are semantically consistent with the independent set. Remaining gaps: language, application-process rewrite, applicant tips, and the optional Humanas classification. |
| The Concord Review | Did not follow `Submit`; returned no changes | Finds `/submit`, rolling admissions, $70 fee, clean audience, nonredundant eligibility and active status | Exact/semantic match on link, deadline, audience, cost, level, location, language and status. Application steps and specific applicant tips were not accepted because their citations were weak/nonliteral. The generic type was subsequently specialized to `Competições de Escrita`. |

## Deadline regression result

- `Agosto` no longer becomes `null` when a complete official interval is available. OBBS resolves the end of `Inscrições 20/05 a …/08` and formats it as `D de agosto de 2026`.
- `Setembro` now resolves to `23 de setembro de 2026` for OBMF.
- Rolling admissions resolve to `Inscrições contínuas`, not `Prazo não informado`, for The Concord Review.
- Event, test, result and medal-order dates remain excluded from the application deadline.

## Fixes driven by the comparison

1. Follow `Submit`/`Submission` pages and prioritize paths tied to the current opportunity.
2. Reject sibling-program regulations such as OBGP/OBLI while reviewing OBMF.
3. Infer the edition year for numeric day/month ranges, selecting the range end as the deadline.
4. Recover rolling admissions directly from official text.
5. Retry malformed structured responses and mechanically close JSON truncated only at the end.
6. Decode named HTML entities and compare literal evidence despite harmless punctuation differences.
7. Run a conditional coverage audit for suspicious fields instead of stopping after the first mapping pass.
8. Reject language and process updates whose citations do not mention language or application steps.
9. Remove catch-all audience tags when official eligibility is general.
10. Remove global reach, generic English requirements, fees, word counts and formatting rules from eligibility.
11. Reopen `Revisar`/`Encerrada` to `Aprovada` when an active complete or rolling deadline is proven.
12. Replace redirected or lateral catalog links with the official operational page.

## Known limitations

- OBBS currently exposes conflicting cached official values (`07/08` in the independent browser fetch and `14/08` in Sentinel's direct HTTP fetch). The benchmark records the conflict instead of hiding it.
- The mapping model remains stochastic. Deterministic recovery now protects deadlines, rolling status, redirected/application links, catch-all audiences and eligibility redundancy, but less critical prose fields can still be omitted when evidence is weak.
- Evidence is stored as one citation per field. A future improvement would allow multiple citations for compound fields such as eligibility and process.

## Official sources

- OBBS: https://synbiobr.org/olimpiada/
- OBMF: https://www.seletaeducacao.com.br/obmf
- OBMF regulation: https://www.seletaeducacao.com.br/obmf-regulamento
- The Concord Review submission page: https://www.tcr.org/submit
- The Concord Review submission FAQ: https://www.tcr.org/Submitting-papers-to-TCR
