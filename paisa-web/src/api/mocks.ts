import type { Transaction, MonthSummary, PayeeSummary, ClockBucket } from "../types/api";

/**
 * Sampled from a real six-month Google Pay statement, so the screens are laid
 * out against the shape the data actually has: lopsided months, a long tail of
 * personal names, most payees with no category.
 *
 * Amounts are paise. Replace this file with nothing — just flip
 * VITE_USE_MOCKS to false once the backend serves the same shapes.
 */

export const mockMonths: MonthSummary[] = [
    {
        "month": "2026-04",
        "spending_paise": 851925,
        "transfers_paise": 677600,
        "received_paise": 86300,
        "self_transfer_paise": 0,
        "txn_count": 61
    },
    {
        "month": "2026-05",
        "spending_paise": 416300,
        "transfers_paise": 3600000,
        "received_paise": 1276200,
        "self_transfer_paise": 10100000,
        "txn_count": 60
    },
    {
        "month": "2026-06",
        "spending_paise": 717090,
        "transfers_paise": 2316000,
        "received_paise": 990400,
        "self_transfer_paise": 5000000,
        "txn_count": 67
    },
    {
        "month": "2026-07",
        "spending_paise": 618980,
        "transfers_paise": 3400000,
        "received_paise": 1936200,
        "self_transfer_paise": 5550000,
        "txn_count": 47
    },
    {
        "month": "2026-08",
        "spending_paise": 1348920,
        "transfers_paise": 5669700,
        "received_paise": 1380600,
        "self_transfer_paise": 1100000,
        "txn_count": 59
    },
    {
        "month": "2026-09",
        "spending_paise": 604780,
        "transfers_paise": 13800000,
        "received_paise": 5003000,
        "self_transfer_paise": 9000000,
        "txn_count": 55
    }
];

export const mockPayees: PayeeSummary[] = [
    {
        "name": "Jio Prepaid",
        "total_paise": 276930,
        "count": 24,
        "avg_paise": 11538,
        "category": "Mobile & bills"
    },
    {
        "name": "RAMACHANDRAN V",
        "total_paise": 97400,
        "count": 19,
        "avg_paise": 5126,
        "category": null
    },
    {
        "name": "BENAZEER BEGUM",
        "total_paise": 47900,
        "count": 12,
        "avg_paise": 3991,
        "category": null
    },
    {
        "name": "Umarani",
        "total_paise": 47400,
        "count": 10,
        "avg_paise": 4740,
        "category": null
    },
    {
        "name": "GADDAM HARIBABU REDDY",
        "total_paise": 42800,
        "count": 8,
        "avg_paise": 5350,
        "category": null
    },
    {
        "name": "MR MAHMOOD MUSTHAAQ N H",
        "total_paise": 32000,
        "count": 8,
        "avg_paise": 4000,
        "category": null
    },
    {
        "name": "SYED APUTHAHIR",
        "total_paise": 66500,
        "count": 7,
        "avg_paise": 9500,
        "category": null
    },
    {
        "name": "HAPPY CAFE",
        "total_paise": 58000,
        "count": 7,
        "avg_paise": 8285,
        "category": "Food & drink"
    },
    {
        "name": "AMUDHUNAVU",
        "total_paise": 26500,
        "count": 7,
        "avg_paise": 3785,
        "category": null
    },
    {
        "name": "amala a",
        "total_paise": 27500,
        "count": 5,
        "avg_paise": 5500,
        "category": null
    },
    {
        "name": "MR RAJKUMAR",
        "total_paise": 23200,
        "count": 5,
        "avg_paise": 4640,
        "category": null
    },
    {
        "name": "M S EKAYARS",
        "total_paise": 138000,
        "count": 5,
        "avg_paise": 27600,
        "category": null
    }
];

export const mockClock: ClockBucket[] = [
    {
        "bucket": "Evening 5–10pm",
        "amount_paise": 2060370,
        "count": 145
    },
    {
        "bucket": "Afternoon 12–5pm",
        "amount_paise": 1434320,
        "count": 84
    },
    {
        "bucket": "Morning 6am–12pm",
        "amount_paise": 552505,
        "count": 63
    },
    {
        "bucket": "Night 10pm–6am",
        "amount_paise": 510800,
        "count": 39
    }
];

export const mockTransactions: Transaction[] = [
    {
        "id": "mock-0",
        "txn_id": "627125514035",
        "occurred_at": "2026-09-28T22:52:00",
        "direction": "debit",
        "is_self_transfer": false,
        "counterparty_raw": "THAMOTHIRAN",
        "amount_paise": 6800,
        "amount": "68.00",
        "bank": "Axis Bank",
        "account_last4": "1714"
    },
    {
        "id": "mock-1",
        "txn_id": "663667516600",
        "occurred_at": "2026-09-27T22:09:00",
        "direction": "debit",
        "is_self_transfer": false,
        "counterparty_raw": "ABDULLAH TIFFEN CENTER",
        "amount_paise": 5000,
        "amount": "50.00",
        "bank": "Axis Bank",
        "account_last4": "1714"
    },
    {
        "id": "mock-2",
        "txn_id": "627097683943",
        "occurred_at": "2026-09-27T16:41:00",
        "direction": "debit",
        "is_self_transfer": false,
        "counterparty_raw": "Jio Prepaid",
        "amount_paise": 4900,
        "amount": "49.00",
        "bank": "Axis Bank",
        "account_last4": "1714"
    },
    {
        "id": "mock-3",
        "txn_id": "663534366656",
        "occurred_at": "2026-09-26T14:29:00",
        "direction": "debit",
        "is_self_transfer": false,
        "counterparty_raw": "Vellaiammal store",
        "amount_paise": 7000,
        "amount": "70.00",
        "bank": "Axis Bank",
        "account_last4": "1714"
    },
    {
        "id": "mock-4",
        "txn_id": "663584255580",
        "occurred_at": "2026-09-26T14:19:00",
        "direction": "debit",
        "is_self_transfer": false,
        "counterparty_raw": "THAMOTHIRAN",
        "amount_paise": 6400,
        "amount": "64.00",
        "bank": "Axis Bank",
        "account_last4": "1714"
    },
    {
        "id": "mock-5",
        "txn_id": "663540850230",
        "occurred_at": "2026-09-26T14:13:00",
        "direction": "debit",
        "is_self_transfer": false,
        "counterparty_raw": "ROGEN",
        "amount_paise": 7000,
        "amount": "70.00",
        "bank": "Axis Bank",
        "account_last4": "1714"
    },
    {
        "id": "mock-6",
        "txn_id": "663408110054",
        "occurred_at": "2026-09-25T22:24:00",
        "direction": "debit",
        "is_self_transfer": false,
        "counterparty_raw": "Vellaiammal store",
        "amount_paise": 4000,
        "amount": "40.00",
        "bank": "Axis Bank",
        "account_last4": "1714"
    },
    {
        "id": "mock-7",
        "txn_id": "663479326967",
        "occurred_at": "2026-09-25T21:55:00",
        "direction": "debit",
        "is_self_transfer": false,
        "counterparty_raw": "ABDULLAH TIFFEN CENTER",
        "amount_paise": 7000,
        "amount": "70.00",
        "bank": "Axis Bank",
        "account_last4": "1714"
    },
    {
        "id": "mock-8",
        "txn_id": "626860597911",
        "occurred_at": "2026-09-25T18:49:00",
        "direction": "debit",
        "is_self_transfer": false,
        "counterparty_raw": "CMRL AIRPORT METRO TOM 11",
        "amount_paise": 4000,
        "amount": "40.00",
        "bank": "Axis Bank",
        "account_last4": "1714"
    },
    {
        "id": "mock-9",
        "txn_id": "626869271682",
        "occurred_at": "2026-09-25T15:32:00",
        "direction": "debit",
        "is_self_transfer": false,
        "counterparty_raw": "FALCONS TRANSPORT SERVICES",
        "amount_paise": 2000,
        "amount": "20.00",
        "bank": "Axis Bank",
        "account_last4": "1714"
    },
    {
        "id": "mock-10",
        "txn_id": "626888168402",
        "occurred_at": "2026-09-25T14:49:00",
        "direction": "debit",
        "is_self_transfer": false,
        "counterparty_raw": "EKAYARS",
        "amount_paise": 30000,
        "amount": "300.00",
        "bank": "Axis Bank",
        "account_last4": "1714"
    },
    {
        "id": "mock-11",
        "txn_id": "626825659354",
        "occurred_at": "2026-09-25T14:44:00",
        "direction": "debit",
        "is_self_transfer": false,
        "counterparty_raw": "JAISHNAVI ENTERPRISES",
        "amount_paise": 4000,
        "amount": "40.00",
        "bank": "Axis Bank",
        "account_last4": "1714"
    },
    {
        "id": "mock-12",
        "txn_id": "626818676758",
        "occurred_at": "2026-09-25T13:08:00",
        "direction": "debit",
        "is_self_transfer": false,
        "counterparty_raw": "Ramachandran V",
        "amount_paise": 4200,
        "amount": "42.00",
        "bank": "Axis Bank",
        "account_last4": "1714"
    },
    {
        "id": "mock-13",
        "txn_id": "626874773699",
        "occurred_at": "2026-09-25T13:03:00",
        "direction": "debit",
        "is_self_transfer": false,
        "counterparty_raw": "HOTEL BS BIRIYANI",
        "amount_paise": 13000,
        "amount": "130.00",
        "bank": "Axis Bank",
        "account_last4": "1714"
    },
    {
        "id": "mock-14",
        "txn_id": "626757320109",
        "occurred_at": "2026-09-24T21:39:00",
        "direction": "debit",
        "is_self_transfer": false,
        "counterparty_raw": "SRI GOMATHI RAVI SWEETS",
        "amount_paise": 1000,
        "amount": "10.00",
        "bank": "Axis Bank",
        "account_last4": "1714"
    },
    {
        "id": "mock-15",
        "txn_id": "626777216506",
        "occurred_at": "2026-09-24T21:37:00",
        "direction": "debit",
        "is_self_transfer": false,
        "counterparty_raw": "Sophiaj 0811",
        "amount_paise": 11000,
        "amount": "110.00",
        "bank": "Axis Bank",
        "account_last4": "1714"
    },
    {
        "id": "mock-16",
        "txn_id": "663397483674",
        "occurred_at": "2026-09-24T17:54:00",
        "direction": "debit",
        "is_self_transfer": false,
        "counterparty_raw": "HAPPY CAFE",
        "amount_paise": 9500,
        "amount": "95.00",
        "bank": "Axis Bank",
        "account_last4": "1714"
    },
    {
        "id": "mock-17",
        "txn_id": "626585339091",
        "occurred_at": "2026-09-22T23:16:00",
        "direction": "debit",
        "is_self_transfer": false,
        "counterparty_raw": "ABDULLAH TIFFEN CENTER",
        "amount_paise": 4000,
        "amount": "40.00",
        "bank": "Axis Bank",
        "account_last4": "1714"
    },
    {
        "id": "mock-18",
        "txn_id": "626579611587",
        "occurred_at": "2026-09-22T18:46:00",
        "direction": "debit",
        "is_self_transfer": false,
        "counterparty_raw": "Kolkata Lassi House",
        "amount_paise": 4000,
        "amount": "40.00",
        "bank": "Axis Bank",
        "account_last4": "1714"
    },
    {
        "id": "mock-19",
        "txn_id": "663047115228",
        "occurred_at": "2026-09-21T19:14:00",
        "direction": "debit",
        "is_self_transfer": false,
        "counterparty_raw": "ANANDHA VILAS POS 4",
        "amount_paise": 2500,
        "amount": "25.00",
        "bank": "Axis Bank",
        "account_last4": "1714"
    },
    {
        "id": "mock-20",
        "txn_id": "662982988417",
        "occurred_at": "2026-09-20T15:15:00",
        "direction": "debit",
        "is_self_transfer": false,
        "counterparty_raw": "Jio Prepaid",
        "amount_paise": 4900,
        "amount": "49.00",
        "bank": "Axis Bank",
        "account_last4": "1714"
    },
    {
        "id": "mock-21",
        "txn_id": "662984251404",
        "occurred_at": "2026-09-20T10:02:00",
        "direction": "debit",
        "is_self_transfer": false,
        "counterparty_raw": "Anubalaji store",
        "amount_paise": 6000,
        "amount": "60.00",
        "bank": "Axis Bank",
        "account_last4": "1714"
    },
    {
        "id": "mock-22",
        "txn_id": "662979957737",
        "occurred_at": "2026-09-20T09:58:00",
        "direction": "debit",
        "is_self_transfer": false,
        "counterparty_raw": "Umarani",
        "amount_paise": 5400,
        "amount": "54.00",
        "bank": "Axis Bank",
        "account_last4": "1714"
    },
    {
        "id": "mock-23",
        "txn_id": "662838110482",
        "occurred_at": "2026-09-19T19:20:00",
        "direction": "debit",
        "is_self_transfer": false,
        "counterparty_raw": "MUGAVAI CAFE",
        "amount_paise": 5000,
        "amount": "50.00",
        "bank": "Axis Bank",
        "account_last4": "1714"
    },
    {
        "id": "mock-24",
        "txn_id": "662808828350",
        "occurred_at": "2026-09-19T16:55:00",
        "direction": "debit",
        "is_self_transfer": false,
        "counterparty_raw": "Jio Prepaid",
        "amount_paise": 4900,
        "amount": "49.00",
        "bank": "Axis Bank",
        "account_last4": "1714"
    },
    {
        "id": "mock-25",
        "txn_id": "626281472585",
        "occurred_at": "2026-09-19T11:02:00",
        "direction": "debit",
        "is_self_transfer": false,
        "counterparty_raw": "Umarani",
        "amount_paise": 3900,
        "amount": "39.00",
        "bank": "Axis Bank",
        "account_last4": "1714"
    },
    {
        "id": "mock-26",
        "txn_id": "626152022869",
        "occurred_at": "2026-09-18T21:15:00",
        "direction": "debit",
        "is_self_transfer": false,
        "counterparty_raw": "ANANDA HOTEL",
        "amount_paise": 45000,
        "amount": "450.00",
        "bank": "Axis Bank",
        "account_last4": "1714"
    },
    {
        "id": "mock-27",
        "txn_id": "662786551648",
        "occurred_at": "2026-09-18T13:48:00",
        "direction": "debit",
        "is_self_transfer": false,
        "counterparty_raw": "HAPPY CAFE",
        "amount_paise": 5000,
        "amount": "50.00",
        "bank": "Axis Bank",
        "account_last4": "1714"
    },
    {
        "id": "mock-28",
        "txn_id": "662736058560",
        "occurred_at": "2026-09-18T12:14:00",
        "direction": "debit",
        "is_self_transfer": false,
        "counterparty_raw": "Blinkit",
        "amount_paise": 37100,
        "amount": "371.00",
        "bank": "Axis Bank",
        "account_last4": "1714"
    },
    {
        "id": "mock-29",
        "txn_id": "662654934131",
        "occurred_at": "2026-09-17T23:40:00",
        "direction": "debit",
        "is_self_transfer": false,
        "counterparty_raw": "VARSHA TIFFIN CENTER",
        "amount_paise": 5000,
        "amount": "50.00",
        "bank": "Axis Bank",
        "account_last4": "1714"
    },
    {
        "id": "mock-30",
        "txn_id": "662548632116",
        "occurred_at": "2026-09-16T09:41:00",
        "direction": "debit",
        "is_self_transfer": false,
        "counterparty_raw": "Vellaiammal store",
        "amount_paise": 8000,
        "amount": "80.00",
        "bank": "Axis Bank",
        "account_last4": "1714"
    },
    {
        "id": "mock-31",
        "txn_id": "662498531090",
        "occurred_at": "2026-09-15T23:35:00",
        "direction": "debit",
        "is_self_transfer": false,
        "counterparty_raw": "Syed Fast food",
        "amount_paise": 4000,
        "amount": "40.00",
        "bank": "Axis Bank",
        "account_last4": "1714"
    },
    {
        "id": "mock-32",
        "txn_id": "625862599172",
        "occurred_at": "2026-09-15T17:11:00",
        "direction": "debit",
        "is_self_transfer": false,
        "counterparty_raw": "BENAZEER BEGUM",
        "amount_paise": 2500,
        "amount": "25.00",
        "bank": "Axis Bank",
        "account_last4": "1714"
    },
    {
        "id": "mock-33",
        "txn_id": "625766216615",
        "occurred_at": "2026-09-14T19:22:00",
        "direction": "debit",
        "is_self_transfer": false,
        "counterparty_raw": "Kolkata Lassi House",
        "amount_paise": 4000,
        "amount": "40.00",
        "bank": "Axis Bank",
        "account_last4": "1714"
    },
    {
        "id": "mock-34",
        "txn_id": "187108066216",
        "occurred_at": "2026-09-14T14:02:00",
        "direction": "credit",
        "is_self_transfer": false,
        "counterparty_raw": "RAMACHANDIRAN THIPPANNAM",
        "amount_paise": 3000,
        "amount": "30.00",
        "bank": "Indian Bank",
        "account_last4": "2192"
    },
    {
        "id": "mock-35",
        "txn_id": "662212115627",
        "occurred_at": "2026-09-13T19:47:00",
        "direction": "debit",
        "is_self_transfer": false,
        "counterparty_raw": "MUGAVAI CAFE",
        "amount_paise": 8000,
        "amount": "80.00",
        "bank": "Axis Bank",
        "account_last4": "1714"
    },
    {
        "id": "mock-36",
        "txn_id": "662110659992",
        "occurred_at": "2026-09-12T11:41:00",
        "direction": "debit",
        "is_self_transfer": false,
        "counterparty_raw": "Vellaiammal store",
        "amount_paise": 8600,
        "amount": "86.00",
        "bank": "Axis Bank",
        "account_last4": "1714"
    },
    {
        "id": "mock-37",
        "txn_id": "661975890360",
        "occurred_at": "2026-09-10T18:46:00",
        "direction": "debit",
        "is_self_transfer": false,
        "counterparty_raw": "ANANDHA VILAS POS 4",
        "amount_paise": 2500,
        "amount": "25.00",
        "bank": "Axis Bank",
        "account_last4": "1714"
    },
    {
        "id": "mock-38",
        "txn_id": "625313674947",
        "occurred_at": "2026-09-10T17:24:00",
        "direction": "debit",
        "is_self_transfer": false,
        "counterparty_raw": "GOVINTHARAJ RAJA",
        "amount_paise": 3000000,
        "amount": "30000.00",
        "bank": "Indian Bank",
        "account_last4": "2192"
    },
    {
        "id": "mock-39",
        "txn_id": "661815111944",
        "occurred_at": "2026-09-09T22:46:00",
        "direction": "debit",
        "is_self_transfer": false,
        "counterparty_raw": "Sri Brijwasi sweet",
        "amount_paise": 13400,
        "amount": "134.00",
        "bank": "Axis Bank",
        "account_last4": "1714"
    }
];

export const mockTotalTransactions = 399;