# Clean-Up

A cleaning procedure for a fresh CSV, from load to the point where the frame is ready to split. Every step is look, fix and assign, check.

---

## Essentials

```python
import pandas as pd
import numpy as np

df = pd.read_csv("data.csv")
df.columns = df.columns.str.strip().str.lower().str.replace(r"[\s-]+", "_", regex=True)
df = df.drop_duplicates().reset_index(drop=True)
df.isna().sum()
df.dtypes
df["amount"] = pd.to_numeric(df["amount"], errors="coerce")
df["event_date"] = pd.to_datetime(df["event_date"], errors="coerce")
df["category"] = df["category"].str.strip().str.lower()
df.describe().T
df.loc[~df["duration"].between(0, 365), "duration"] = np.nan
df["duration"] = df["duration"].fillna(df["duration"].median())
df = df.drop(columns=["record_id"])
df.shape, df.isna().sum().sum()
```

---

## Setup

`sep`, `encoding` and `na_values` go into `read_csv` when the file needs them.

```python
import pandas as pd
import numpy as np

df = pd.read_csv("data.csv")
df.shape
```

---

## Column-name normalisation

Spaces and hyphens become one underscore, before any cell names a column.

```python
df.columns.tolist()
df.columns = df.columns.str.strip().str.lower().str.replace(r"[\s-]+", "_", regex=True)
df.columns.tolist()
```

---

## Deduplication

Identical rows go first. A repeated key with different values is a second look, and when that count is nonzero the key dedup follows, the last row winning.

```python
df.duplicated().sum()
df.duplicated(subset=["record_id"]).sum()
df = df.drop_duplicates().reset_index(drop=True)
df = df.drop_duplicates(subset=["record_id"], keep="last").reset_index(drop=True)
df.shape
```

---

## Missing-value scan

`read_csv` maps N/A, NA, null and None to NaN on load. Markers outside that list show up in the second line. Numeric coercion turns them into NaN, and text columns get the replace in label normalisation.

```python
df.isna().sum()
df.isin([" ", "", "?", "-"]).sum()
```

---

## Type inspection

pandas 3 reports text as `str`. A number or a date reporting `str` needs coercion.

```python
df.dtypes
df.head()
```

---

## Type coercion, numeric

The loop shows which text columns parse as numbers and how many new NaN the coercion would create. Coercion goes by column name, never over the whole frame, after a look at the values about to become NaN. A currency string loses its symbols and separators before coercion. Yes/no text maps to 0 and 1, a text target included.

```python
for c in df.columns[df.dtypes == "str"]:
    conv = pd.to_numeric(df[c], errors="coerce")
    print(c, conv.notna().sum(), conv.isna().sum() - df[c].isna().sum())

df.loc[pd.to_numeric(df["amount"], errors="coerce").isna() & df["amount"].notna(), "amount"].value_counts()
df["amount"] = pd.to_numeric(df["amount"], errors="coerce")
df["amount"].isna().sum()

df["price"] = pd.to_numeric(df["price"].str.replace(r"[^\d.\-]", "", regex=True), errors="coerce")
df["flag"] = df["flag"].str.strip().str.lower().map({"yes": 1, "no": 0})
```

---

## Type coercion, datetime

`dayfirst=True` reads 31/12/2023, `format="mixed"` reads several layouts in one column. A NaT count near the row count or a maximum past the known range is a wrong layout, not missing data. The raw datetime leaves the frame once its parts are extracted.

```python
df["event_date"] = pd.to_datetime(df["event_date"], errors="coerce")
df["event_date"].isna().sum(), df["event_date"].min(), df["event_date"].max()
df["event_year"] = df["event_date"].dt.year
df["event_month"] = df["event_date"].dt.month
df = df.drop(columns=["event_date"])
```

---

## Categorical-label normalisation

The loop shows which text columns change under strip and lower. Synonyms show in the tally, not in the loop. Identifiers and case-bearing labels stay as they are. The markers the scan found become NaN here and imputation fills them later.

```python
for c in df.columns[df.dtypes == "str"]:
    print(c, df[c].nunique(), df[c].str.strip().str.lower().nunique())

df["category"].value_counts()
df["category"] = df["category"].str.strip().str.lower()
df["category"] = df["category"].replace({"": np.nan, "?": np.nan, "-": np.nan})
df["category"] = df["category"].replace({"ops": "operations"})
df["category"].value_counts()
```

---

## Range validation

`describe` gives the minimum and maximum of every column to read against what is possible. A rule across two columns needs its own comparison. An impossible value becomes NaN and imputation fills it next, with the count reported and no row dropped silently. A value above the possible maximum is as impossible as a negative one, so `between` covers both bounds at once.

```python
df.describe().T
(df["end_date"] < df["start_date"]).sum()
df.loc[df["amount"] < 0, "amount"] = np.nan
df.loc[~df["duration"].between(0, 365), "duration"] = np.nan
```

---

## Imputation

A mostly empty column carries nothing. The median fills a skewed column, a computation fills a reconstructable one, the most common label fills text. `SimpleImputer` inside the pipeline after the split is the alternative for numeric columns.

```python
df.isna().mean().round(3)
df = df.drop(columns=df.columns[df.isna().mean() > 0.5])
df[["duration", "amount"]].describe()
df["duration"] = df["duration"].fillna(df["duration"].median())
df["amount"] = df["amount"].fillna(df["rate"] * df["duration"])
df["category"] = df["category"].fillna(df["category"].mode()[0])
df.isna().sum().sum()
```

---

## Feature pruning

A column with as many distinct values as rows is an identifier, with one value a constant, with a handful a categorical.

```python
df.nunique()
df = df.drop(columns=["record_id"])
df.shape
```

---

## Final verification

A gate, not a report. No `str` column that a model is meant to use remains, the NaN count and the duplicate count are zero, and the target rate matches the raw file. Label fixes can create exact duplicates the first check missed. Any count that is not zero sends the frame back to the step that owns it.

```python
print(df.shape)
print(df.dtypes)
print(df.isna().sum().sum())
print(df.duplicated().sum())
print(df["target"].mean().round(3))
```
