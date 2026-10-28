# Analysis

Answering questions about a cleaned table, each one a short chain of methods on `df` that falls into one of seven patterns.

---

## Essentials

```python
df["target"].mean()
df.groupby("category")["target"].mean().sort_values()
df.groupby("category").agg(rows=("target", "size"), rate=("target", "mean"))
df.loc[(df["duration"] > 24) & (df["region"] == "north"), "channel"].value_counts()
df["duration_band"] = pd.cut(df["duration"], bins=[-1, 12, 36, 100], labels=["0-12", "13-36", "37+"])
df["amount_band"] = pd.qcut(df["amount"], q=4, labels=["q1", "q2", "q3", "q4"])
df["event_date"].dt.to_period("M").value_counts().sort_index()
df["duration"].corr(df["amount"])
df.merge(lookup, on="category", how="left")
df.pivot_table(index="category", columns="region", values="target", aggfunc="mean")
pd.crosstab(df["category"], df["region"], margins=True)
df.nlargest(5, "amount")
```

---

## The seven patterns

| pattern | question shape | idiom |
|---|---|---|
| aggregate | one number for the whole table | `df["col"].mean()` |
| group | one number per category | `df.groupby("key")["col"].mean()` |
| filter | rows that satisfy a condition | `df.loc[mask, "col"]` |
| derive | a new column from an old one | `pd.cut`, `pd.qcut`, `.dt`, `.str` |
| relate | how two columns move together | `df["a"].corr(df["b"])` |
| join | columns from a second table | `df.merge(lookup, on="key", how="left")` |
| reshape | one key down, another across | `df.pivot_table(...)`, `pd.crosstab(...)` |

Three words resolve most of the syntax. The key is the "per" or "by" noun and goes into `groupby`. The column is the measured thing and goes into the brackets after it. A value such as a label or a threshold belongs inside a condition, never in a column position.

---

## Aggregate

The mean of a 0/1 column is a rate. The same shape serves `median`, `sum`, `min`, `max`, `std` and `nunique`.

```python
df["target"].mean()
df["rate"].median()
df["amount"].sum()
df["category"].nunique()
```

---

## Group

`agg` with keyword arguments names the output columns. `"size"` counts every row of a group and `"count"` skips NaN.

```python
df.groupby("category")["target"].mean().round(3).sort_values()
df.groupby("target")["rate"].median()
df.groupby("category").agg(rows=("target", "size"),
                           rate=("target", "mean"),
                           median_amount=("amount", "median")).round(3)
```

---

## Filter

Each condition sits in parentheses, joined by `&`, `|` and `~`. A typo in a label returns zero rows without an error, so check spellings with `value_counts()` first.

```python
mask = (df["duration"] > 24) & (df["region"] == "north")
mask.sum()
df.loc[mask]
df.loc[mask, "channel"]
df.loc[df["target"] == 1, "channel"].value_counts()
df["channel"].value_counts().idxmax()
df.loc[df["target"] == 1].nlargest(5, "amount")[["channel", "duration", "amount"]]
```

---

## Derive

`cut` takes fixed edges, one more than labels, each bin closed on the right, so a value outside every bin becomes NaN. `qcut` takes a number of bands and picks the edges so that every band holds the same number of rows, which makes rates across bands comparable. `observed=True` drops bands that are empty.

```python
df["duration_band"] = pd.cut(df["duration"], bins=[-1, 12, 36, 100], labels=["0-12", "13-36", "37+"])
df["duration_band"].value_counts()
df.groupby("duration_band", observed=True)["target"].mean()

df["amount_band"] = pd.qcut(df["amount"], q=4, labels=["q1", "q2", "q3", "q4"])
df["amount_band"].value_counts().sort_index()
df.groupby("amount_band", observed=True)["target"].mean()
```

A datetime column exposes its parts through `.dt`. `to_period("M")` maps every date to its month, so a tally of it is a count per month. `idxmax()` names the label of the largest count and `max()` gives the count.

```python
df["event_date"] = pd.to_datetime(df["event_date"], errors="coerce")
df["event_date"].dt.year.value_counts().sort_index()
monthly = df.loc[df["event_date"].dt.year == 2023, "event_date"].dt.to_period("M").value_counts().sort_index()
monthly.idxmax(), monthly.max()
df.set_index("event_date")["amount"].resample("ME").mean()
df["channel"].str.lower().str.contains("card")
```

---

## Relate

Pearson correlation runs from -1 to 1 and skips rows with NaN in either column. The result is a NumPy float, so `.round(3)` works on it.

```python
df["duration"].corr(df["amount"]).round(3)
df[["duration", "amount"]].corr()
df.select_dtypes("number").corr()
```

---

## Join

A left merge keeps every row of `df` and leaves NaN where the key has no match. An inner merge drops those rows. More rows after a merge than before means the right table repeats a key. The check is the shape before and after and a NaN count on a column from the right table.

```python
lookup = pd.read_csv("lookup.csv")
merged = df.merge(lookup, on="category", how="left")
df.shape, merged.shape, merged["plan"].isna().sum()
inner = df.merge(lookup, on="category", how="inner")
len(df) - len(inner)
df.loc[~df["category"].isin(lookup["category"]), "category"].unique()
merged.groupby("plan", dropna=False)["target"].mean()
```

---

## Reshape

`pivot_table` is a groupby on two keys with one of them turned across the columns. `crosstab` does the same for counts and `margins=True` adds the totals.

```python
df.pivot_table(index="category", columns="region", values="target", aggfunc="mean").round(3)
pd.crosstab(df["category"], df["region"], margins=True)
pd.crosstab(df["category"], df["region"], normalize="index").round(3)
```

---

## Notebook habits

- One check per cell, or `print()` each one. A cell shows only its last expression.
- Numbered Markdown answers, the number, the value, one clause of interpretation.
- Restart Kernel and Run All before writing up. A result from a deleted cell is not reproducible.
