# Analysis

Answering questions about a cleaned table, each one of five patterns and a short chain of methods on `df`.

---

## The five patterns

| pattern | question shape | idiom |
|---|---|---|
| aggregate | one number for the whole table | `df["col"].mean()` |
| group | one number per category | `df.groupby("key")["col"].mean()` |
| filter | rows that satisfy a condition | `df.loc[mask, "col"]` |
| derive | a new column from an old one | `pd.cut`, `pd.to_datetime`, `.dt`, `.str` |
| relate | how two columns move together | `df["a"].corr(df["b"])` |

---

## Aggregate

```python
df["target"].mean()                        # share of 1s in a 0/1 column, the rate; NumPy float, .round(4) works
df["rate"].median()                        # middle value, robust to outliers
df["col"].sum() / .min() / .max() / .std() / .nunique()
```

---

## Group

```python
df.groupby("category")["target"].mean().round(3).sort_values()   # key, column, calculation; sort_index() for label order
df.groupby("target")["rate"].median()                            # another key, column, calculation
df.groupby("category")["target"].agg(["mean", "count"])          # several calculations
df.groupby("duration_band", observed=True)["target"].mean()      # category key, drop empty bands
```

---

## Filter

```python
mask = (df["duration"] > 24) & (df["region"] == "north")   # each condition in parentheses; & and, | or, ~ not
mask.sum()                                                 # count of matching rows
df.loc[mask]                                               # the matching rows
df.loc[mask, "channel"]                                    # one column of the matching rows
df.loc[df["target"] == 1, "channel"].value_counts()        # tally, largest first
df["channel"].value_counts().idxmax()                      # label of the largest; check spellings here first, a typo returns zero rows silently
```

---

## Derive

```python
df["duration_band"] = pd.cut(df["duration"],
                             bins=[-1, 12, 36, 100],          # fence posts, one more than labels; (left, right]
                             labels=["0-12", "13-36", "37+"]) # outside every bin, and NaN, -> NaN
df["event_date"] = pd.to_datetime(df["event_date"], errors="coerce")   # unparseable -> NaT
df["event_date"].dt.year.value_counts().sort_index()                   # .dt: year, month, day, dayofweek, quarter
df["channel"].str.lower().str.contains("card")                         # .str: strip, lower, contains, replace
```

---

## Relate

```python
df["duration"].corr(df["amount"]).round(3)       # Pearson, -1 to 1, NaN rows skipped; a NumPy float, .round(3) works as on mean()
df[["duration", "amount"]].corr()                # matrix, answer at .iloc[0, 1]
df.select_dtypes("number").corr()                # all numeric pairs
```

---

## Notebook habits

- One check per cell, or `print()` each one. A cell shows only its last expression.
- Numbered Markdown answers, the number, the value, one clause of interpretation.
- Restart Kernel and Run All before writing up. A result from a deleted cell is not reproducible.
