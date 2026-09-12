# Design QA — 英语自建词书复习页

## Evidence

- Source visual truth: `/Users/hans/.codex/generated_images/01a0946f-8a0f-7551-8532-0e832f494469/exec-8dbafc1f-c5dc-4920-8609-182eac7544f8.png`
- Rendered implementation: `/Users/hans/Documents/ChatGPT/小程序开发/english-review-web/public/qa/implementation.png`
- Side-by-side comparison: `/Users/hans/Documents/ChatGPT/小程序开发/english-review-web/public/qa/compare.html`
- Browser viewport: 1400 × 1200; device screen verified at 393 × 852 CSS px; device scale factor 1.
- Source dimensions: 853 × 1844 px, normalized to 393 × 852 px for comparison.
- Implementation dimensions: 393 × 852 px.
- State: `/review`, first `follow through` card, answer revealed, white theme.
- Runtime note: the protected mobile template supplies the status bar, rounded screen mask and home indicator. The source omits this system chrome, so app-content vertical positions were compared relative to the progress line rather than treating the 54 px runtime region as drift.

## Full-view comparison

The final side-by-side comparison shows the same information hierarchy and reading path: top progress, context prompt, two-line English sentence with apricot phrase highlight, sentence audio, separator, blue answer term, type, IPA audio, Chinese meaning, example translation and bottom review choices. No app-specific content is clipped at 393 × 852.

## Focused-region comparison

- Context region: the sentence now wraps to the same two lines as the source; highlight placement, cobalt audio action and separator spacing align after runtime normalization.
- Answer region: term scale, type tag, IPA-row speaker position, Chinese meaning and explicit `例句翻译` label follow the source structure.
- Action region: both controls remain visible, use inline rating/interval labels, meet the 52 px touch minimum and sit above the system home indicator.

## Required fidelity surfaces

- Fonts and typography: system sans-serif fallback is visually close to the source; heading weight, line height, negative tracking and two-line wrap were checked at 1:1. The exact source typeface is unknown, so the remaining optical difference is P3.
- Spacing and layout rhythm: 18 px content edges, full-width separators, answer spacing and sticky bottom actions match the source rhythm after accounting for protected system chrome.
- Colors and tokens: white, cobalt blue, apricot highlight, muted gray and semantic red use shared tokens; no gradients were introduced. Blue/white primary controls and body text retain practical contrast.
- Image quality and assets: the source contains no photos or illustrations. All visible app icons use the installed Radix icon set; no inline SVG, emoji or placeholder art was substituted.
- Copy and content: the selected sample sentence, answer, meaning and translation match the source state. The progress count is data-driven (`1/3` instead of `7/18`) and is an expected content difference.

## Interaction and accessibility evidence

- Browser-clicked flows: local phone verification, today dashboard, review reveal, three automatic next-card transitions, completion/check-in, entry creation and book detail rendering.
- Network-write behavior: the cloud path throws before local mutation/advance when `submitReview` is non-OK; local mode persists synchronously.
- Touch audit: zero visible prototype buttons below 52 px in width or height on the review state.
- Keyboard/input: phone, code and entry fields were filled through the template keyboard controls; visible focus treatment is present.
- Console: fresh QA tab reported 0 error-level messages after the final fixes.

## Comparison history

1. First comparison — blocked:
   - P2: retained scroll position hid the header and exposed a stale keyboard surface.
   - Fix: reset scroll and active input on navigation; hide the keyboard dock when its runtime state is false.
   - Evidence: subsequent capture showed the full header and no keyboard obstruction.
2. Second comparison — blocked:
   - P2: the context wrapped to three lines; answer speaker placement, translation label and stacked rating labels differed from the source.
   - Fix: widened the context region, tightened heading tracking, moved the term speaker into the IPA row, restored the translation label and changed rating labels to inline form.
   - Evidence: final 393 × 852 capture matches the two-line context and answer/action structure.
3. Third comparison — passed:
   - No actionable P0, P1 or P2 mismatch remains after protected runtime normalization.

## Follow-up polish

- P3: the Radix outline speaker icon is lighter than the filled icon in the generated source.
- P3: the exact source font is unavailable; the system fallback has a slightly different optical width in small text.

final result: passed
