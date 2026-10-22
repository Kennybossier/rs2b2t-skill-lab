The adjacent JSON is a local copy of:
https://github.com/R-Dson/2004Tracker/blob/main/data/skill_rates.json

Retrieved 2026-10-21. Kept locally so calculations work without GitHub access.
Only the dashboard's 19 skills are considered; the source's Hunter, Construction
and Farming placeholder rates are unused. Hitpoints is absent from the source.

Rates apply from min_level up to max_level, using exact RuneScape XP thresholds.
Where methods overlap, the fastest applicable rate is selected. Cooking's 35–40
gap carries its preceding rate forward. EHP integrates earned XP; remaining time
integrates XP still needed to 99. Post-99 EHP uses the final rate.

Hitpoints adds no separate EHP or hours, assuming passive training with combat.
Bonus XP deductions are not applied. Totals are independent sums of training
requirements, not an optimized elapsed-time plan or an exact reproduction of the
original tracker's Python calculation.
