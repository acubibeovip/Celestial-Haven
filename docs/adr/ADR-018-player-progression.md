# ADR-018 Player progression

Status: Accepted (owner accepted D35 growth values; numbers provisional)

The numbers are provisional. [ADR-017 §6](ADR-017-m2-content.md#6-levels-and-xp) defines the level cap, XP thresholds, and provisional sources. [ADR-012](ADR-012-templates-and-starter-gear.md) defines base stats and starter gear.

## D35 Per-level stat growth

Each template in `templates.json` has a `growth` object of non-negative integers.

| Template | maxHp | maxMana | power | guard |
| --- | ---: | ---: | ---: | ---: |
| close | 8 | 2 | 1 | 1 |
| ranged | 6 | 4 | 1 | 1 |
| support | 6 | 6 | 1 | 1 |

For each stat, `projectStats` adds the template base, growth multiplied by `level - 1`, and the bonuses from equipped gear. Level 1 uses the existing base and starter gear values.

## D36 XP storage

`PlayerState.xp` stores progress inside the current level. Below the cap, XP is at least zero and less than `xpToNext[level - 1]`. At the cap XP stays zero and further valid gains are ignored. The content registry validates `progression.json` and passes the plain data to the domain through the catalog. Quest and encounter XP belong to their respective content.

## D37 XP gains

`gainXp(state, amount, progression)` returns `Result<{ state, levelsGained }, XpError>`. A gain must be a positive safe integer. Other amounts return `INVALID_XP_AMOUNT` and leave the input intact. A gain can cross several thresholds and advances the level at each exact threshold. At the cap a valid gain returns the original state and zero levels gained.

The rule is pure and uses no clock or RNG. Future commands apply it inside their own atomic transactions.
