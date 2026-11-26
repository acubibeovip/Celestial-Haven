# ADR-011 Hero portraits and placeholders

Status: Proposed (D10 in M1-01b)

When a hero's portrait or atlas is unavailable, the character card and preview use a generated placeholder with the hero's element color, initials, and a visible badge from the `ui.placeholder` string key. The badge appears in every build, including production preview. All ten heroes currently use the placeholder while the M0-02 asset audit is pending.

The asset manifest and real asset integration are separate work. M6-03 adds release asset validation and fails release builds while any hero still needs a placeholder. Public release materials follow the audited roster rule in ADR-010.
