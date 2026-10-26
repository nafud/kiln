# Clean-Up

A cleaning procedure for a fresh CSV, from load to the point where the frame is ready to split.

## Setup

```python
import pandas as pd
import numpy as np

df = pd.read_csv("data.csv")
raw = df.copy()                            # untouched copy for lookups
```

---

## Deduplication

```python
df.duplicated().sum()                      # look
df = df.drop_duplicates()                  # fix + assign
df.shape                                   # check
```

---

## Column-name normalisation

```python
df.columns.tolist()                                                                  # look
df.columns = df.columns.str.strip().str.lower().str.replace(r"[\s-]+", "_", regex=True)   # fix
df.columns.tolist()                                                                  # check
```

---

## Missing-value scan

```python
df.isna().sum()                            # missing pandas already recognises
df.isin([" ", "", "?", "N/A"]).sum()       # missing disguised as text; coercion turns these into NaN
```

---

## Type inspection

```python
df.dtypes                                  # pandas 3 reports text as str
df.head()
```

---

## Type coercion, numeric

```python
df["amount"] = pd.to_numeric(df["amount"], errors="coerce")        # fix; unparseable -> NaN
df["amount"].isna().sum()                                          # check against the scan count
raw.loc[df.index[df["amount"].isna()], "amount"].value_counts()    # what the NaN used to be
```

---

## Type coercion, datetime

```python
df["event_date"] = pd.to_datetime(df["event_date"], errors="coerce")      # fix; unparseable -> NaT
df["event_date"].isna().sum(), df["event_date"].min(), df["event_date"].max()   # check NaT and range
df["event_year"] = df["event_date"].dt.year                               # extract
df["event_month"] = df["event_date"].dt.month
df = df.drop(columns=["event_date"])                                      # drop raw datetime
```

---

## Categorical-label normalisation

```python
df["category"].value_counts()                                   # look
df["category"] = df["category"].str.strip().str.lower()         # fix + assign
df["category"].value_counts()                                   # check
```

---

## Imputation

```python
df.isna().sum()                                                                 # complete picture after coercion
df[["duration", "amount"]].describe()                                           # mean vs 50%
df["duration"] = df["duration"].fillna(df["duration"].median())                 # skewed -> median
df["amount"] = df["amount"].fillna(df["rate"] * df["duration"])                 # reconstructable -> compute
df.isna().sum()                                                                 # check: all zero
```

---

## Range validation

```python
df.describe().T                            # min and max against what is possible
```

---

## Feature pruning

```python
df.nunique()                               # look; = row count is an id, = 1 is a constant
df = df.drop(columns=["record_id"])        # fix + assign
df.shape                                   # check
```

---

## Final verification

```python
print(df.shape)
print(df.dtypes)
print(df.isna().sum().sum())
print(df["target"].mean().round(3))        # rate unchanged from the raw file
```
