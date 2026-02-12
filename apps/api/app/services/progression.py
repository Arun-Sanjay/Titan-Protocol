from __future__ import annotations


def xp_to_next_level(level: int, base: int = 100, growth: int = 25) -> int:
    return base + growth * (level**2)


def compute_level(total_xp: int, base: int = 100, growth: int = 25) -> dict:
    total_xp = max(0, int(total_xp))

    level = 1
    xp_remaining = total_xp

    while True:
        required = xp_to_next_level(level, base=base, growth=growth)
        if xp_remaining < required:
            break
        xp_remaining -= required
        level += 1

    return {
        "level": level,
        "xp_into_level": xp_remaining,
        "xp_for_next_level": xp_to_next_level(level, base=base, growth=growth),
    }

