"""Parse a Google Pay transaction statement PDF into structured rows.

pdfplumber only, no command-line tools, so it runs the same on Windows.
"""

import re
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal

import pdfplumber

# The statement PDF stores no space characters; pdfplumber infers word breaks
# from x positions. 1.5 is the widest tolerance that still splits "Paid to".
X_TOLERANCE = 1.5

# "01 Apr, 2026 Paid to AYYANRAJPANDY ₹60"
HEADER = re.compile(
    r"^(?P<date>\d{2} \w{3}, \d{4}) "
    r"(?P<kind>Paid to|Received from|Self transfer to) "
    r"(?P<party>.+?) "
    r"₹(?P<amount>[\d,]+(?:\.\d+)?)$"
)
# "08:07 AM UPI Transaction ID: 609175237501"
DETAIL = re.compile(
    r"^(?P<time>\d{2}:\d{2} [AP]M) UPI Transaction ID: (?P<txn_id>\d+)")
# "Paid by Axis Bank 1714" / "Paid to Axis Bank 1714"
ACCOUNT = re.compile(r"^Paid (?:by|to) (?P<bank>.+?) (?P<last4>\d{4})$")


@dataclass(frozen=True)
class ParsedTxn:
    txn_id: str
    occurred_at: datetime
    direction: str            # "debit" | "credit"
    is_self_transfer: bool
    counterparty_raw: str
    amount_paise: int         # money is never a float
    bank: str
    account_last4: str


def to_paise(raw: str) -> int:
    """'3,40,212.95' -> 34021295. Indian grouping, so commas just drop out."""
    return int(Decimal(raw.replace(",", "")) * 100)


def parse_statement(path: str) -> list[ParsedTxn]:
    lines: list[str] = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            text = page.extract_text(x_tolerance=X_TOLERANCE) or ""
            lines.extend(line.strip() for line in text.splitlines())

    rows: list[ParsedTxn] = []
    for i, line in enumerate(lines):
        head = HEADER.match(line)
        if not head:
            continue

        # The time, id and account sit on the next two or three lines.
        detail = account = None
        for nxt in lines[i + 1: i + 4]:
            detail = detail or DETAIL.match(nxt)
            account = account or ACCOUNT.match(nxt)
        if detail is None:
            continue

        kind = head.group("kind")
        rows.append(
            ParsedTxn(
                txn_id=detail.group("txn_id"),
                occurred_at=datetime.strptime(
                    f"{head.group('date')} {detail.group('time')}", "%d %b, %Y %I:%M %p"
                ),
                direction="credit" if kind == "Received from" else "debit",
                is_self_transfer=kind == "Self transfer to",
                counterparty_raw=re.sub(
                    r"\s+", " ", head.group("party")).strip(),
                amount_paise=to_paise(head.group("amount")),
                bank=account.group("bank") if account else "",
                account_last4=account.group("last4") if account else "",
            )
        )

    return rows
