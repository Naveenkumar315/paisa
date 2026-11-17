"""One payee, however the statement happens to spell it.

The same shop turns up as "SRI MURUGAN STORES" in one month and
"Sri Murugan Stores" in the next. Keyed on the raw string those are two
payees with two categories and two rows on every chart. The key folds
case and spacing only: anything cleverer (dropping "STORES", fuzzy
matching) would merge payees that really are different, and a wrong merge
moves money between categories silently.
"""

import re

_SPACE = re.compile(r"\s+")


def normalize_name(name: str) -> str:
    """'  Sri  Murugan STORES ' -> 'sri murugan stores'."""
    return _SPACE.sub(" ", name).strip().casefold()
