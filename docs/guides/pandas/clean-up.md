# Clean-Up

A cleaning procedure for a fresh CSV, from load to the point where the frame is ready to split. Every step is look, fix and assign, check.

---

## Setup

```python
import pandas as pd
import numpy as np

df = pd.read_csv("data.csv")               # sep=";", encoding="latin-1", na_values=["?"] when the file needs them
df.shape
```

---

## Column-name normalisation

```python
df.columns.tolist()                                                                       # look
df.columns = df.columns.str.strip().str.lower().str.replace(r"[\s-]+", "_", regex=True)   # fix; spaces and hyphens -> one underscore, before any cell names a column
df.columns.tolist()                                                                       # check
```

---

## Deduplication

```python
df.duplicated().sum()                                    # look: identical rows
df.duplicated(subset=["record_id"]).sum()                # look: same key, different values
df = df.drop_duplicates().reset_index(drop=True)                                      # fix + assign: identical rows
df = df.drop_duplicates(subset=["record_id"], keep="last").reset_index(drop=True)     # fix + assign when the key look is nonzero; the last row wins
df.shape                                                                              # check
```

---

## Missing-value scan

```python
df.isna().sum()                            # detect only; read_csv already maps N/A, NA, null, None to NaN on load
df.isin([" ", "", "?", "-"]).sum()         # detect only; markers outside that default list, numeric coercion turns them into NaN, text columns need the replace in label normalisation
```

---

## Type inspection

```python
df.dtypes                                  # pandas 3 reports text as str; numbers or dates reporting str need coercion
df.head()
```

---

## Type coercion, numeric

```python
for c in df.columns[df.dtypes == "str"]:                                   # look: which text columns parse as numbers
    conv = pd.to_numeric(df[c], errors="coerce")
    print(c, conv.notna().sum(), conv.isna().sum() - df[c].isna().sum())   # parsed, new NaN; coerce by name, never the whole frame

df.loc[pd.to_numeric(df["amount"], errors="coerce").isna() & df["amount"].notna(), "amount"].value_counts()   # look: what is about to become NaN
df["amount"] = pd.to_numeric(df["amount"], errors="coerce")                # fix; unparseable -> NaN
df["amount"].isna().sum()                                                  # check against the scan count

df["price"] = pd.to_numeric(df["price"].str.replace(r"[^\d.\-]", "", regex=True), errors="coerce")   # "$1,200" -> 1200.0
df["flag"] = df["flag"].str.strip().str.lower().map({"yes": 1, "no": 0})   # yes/no text -> 0/1, a text target included
```

---

## Type coercion, datetime

```python
df["event_date"] = pd.to_datetime(df["event_date"], errors="coerce")      # fix; unparseable -> NaT; dayfirst=True for 31/12/2023, format="mixed" for several layouts
df["event_date"].isna().sum(), df["event_date"].min(), df["event_date"].max()   # check; a NaT count near the row count or a max past the known range is a wrong layout, not missing data, so retry with dayfirst=True
df["event_year"] = df["event_date"].dt.year                               # extract
df["event_month"] = df["event_date"].dt.month
df = df.drop(columns=["event_date"])                                      # drop raw datetime
```

---

## Categorical-label normalisation

```python
for c in df.columns[df.dtypes == "str"]:                                   # look: which text columns change under strip + lower
    print(c, df[c].nunique(), df[c].str.strip().str.lower().nunique())

df["category"].value_counts()                                   # look; synonyms show up here, not in the loop
df["category"] = df["category"].str.strip().str.lower()                         # fix + assign, by name; ids and case-bearing labels stay as they are
df["category"] = df["category"].replace({"": np.nan, "?": np.nan, "-": np.nan})   # fix: the markers the scan found become NaN, imputation fills them later
df["category"] = df["category"].replace({"ops": "operations"})                  # fix: merge synonyms
df["category"].value_counts()                                                   # check
```

---

## Range validation

```python
df.describe().T                                      # look: min and max against what is possible, one column at a time
(df["end_date"] < df["start_date"]).sum()            # look: cross-column rule describe cannot see
df.loc[df["amount"] < 0, "amount"] = np.nan          # fix: impossible -> NaN, imputation fills it next; report the count, never silently drop rows
df.loc[~df["duration"].between(0, 365), "duration"] = np.nan   # fix: both bounds at once; a value above the possible maximum is as impossible as a negative
```

---

## Imputation

```python
df.isna().mean().round(3)                                                       # look: share missing after coercion and validation
df = df.drop(columns=df.columns[df.isna().mean() > 0.5])                        # fix: mostly empty columns carry nothing
df[["duration", "amount"]].describe()                                           # mean vs 50%
df["duration"] = df["duration"].fillna(df["duration"].median())                 # skewed -> median; or SimpleImputer in the pipeline after the split
df["amount"] = df["amount"].fillna(df["rate"] * df["duration"])                 # reconstructable -> compute
df["category"] = df["category"].fillna(df["category"].mode()[0])                # text -> most common label
df.isna().sum().sum()                                                           # check: zero
```

---

## Feature pruning

```python
df.nunique()                               # look; = row count is an id, = 1 is a constant, a handful is categorical
df = df.drop(columns=["record_id"])        # fix + assign
df.shape                                   # check
```

---

## Final verification

```python
print(df.shape)                            # a gate, not a report; any count below that is not zero sends the frame back to the step that owns it
print(df.dtypes)                           # no str column left that a model is meant to use
print(df.isna().sum().sum())               # zero
print(df.duplicated().sum())               # zero; label fixes can create exact duplicates the first check missed
print(df["target"].mean().round(3))        # rate unchanged from the raw file
```
