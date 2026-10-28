# Model

A classifier or a regressor on a cleaned frame, from the split to the written result, inside one scikit-learn pipeline that learns from the training rows only.

---

## Essentials

```python
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score, roc_auc_score, recall_score

X = df.drop(columns=["target"])
y = df["target"]
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)
num_cols = X.select_dtypes("number").columns.tolist()
cat_cols = [c for c in X.columns if c not in num_cols]
numeric = Pipeline([("impute", SimpleImputer(strategy="median")), ("scale", StandardScaler())])
categorical = Pipeline([("impute", SimpleImputer(strategy="most_frequent")), ("onehot", OneHotEncoder(handle_unknown="ignore"))])
prep = ColumnTransformer([("num", numeric, num_cols), ("cat", categorical, cat_cols)])
pipe = Pipeline([("prep", prep), ("model", LogisticRegression(max_iter=1000))]).fit(X_train, y_train)
pred = pipe.predict(X_test)
proba = pipe.predict_proba(X_test)[:, 1]
round(accuracy_score(y_test, pred), 3), round(f1_score(y_test, pred), 3), round(roc_auc_score(y_test, proba), 3)
cross_val_score(pipe, X_train, y_train, cv=5, scoring="roc_auc").mean().round(3)
```

---

## The order

| step | idiom |
|---|---|
| split | `train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)` |
| baseline | `DummyClassifier(strategy="most_frequent")` |
| preprocess | `ColumnTransformer([("num", numeric, num_cols), ("cat", categorical, cat_cols)])` |
| fit | `Pipeline([("prep", prep), ("model", est)]).fit(X_train, y_train)` |
| score | `accuracy_score`, `f1_score` on `pred`, `roc_auc_score` on `proba` |
| validate | `cross_val_score(pipe, X_train, y_train, cv=5, scoring="roc_auc")` |
| threshold | `(proba >= 0.3).astype(int)` |
| explain | `pipe["model"].coef_[0]` against `pipe["prep"].get_feature_names_out()` |

---

## Split

The target leaves `X`, with the identifier and any raw datetime column. `stratify=y` keeps the class ratio in both halves. The seed makes the split reproducible. The four names come back in this order.

```python
X = df.drop(columns=["target"])
y = df["target"]
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)
X_train.shape, X_test.shape, y_train.mean().round(3), y_test.mean().round(3)
```

---

## Baseline

The majority-class accuracy is the number every model has to beat. With a 78/22 target it is 0.78, so accuracy alone says little and F1 or AUC carries the comparison.

```python
from sklearn.dummy import DummyClassifier
from sklearn.metrics import accuracy_score, f1_score, roc_auc_score, recall_score, classification_report, confusion_matrix

dummy = DummyClassifier(strategy="most_frequent").fit(X_train, y_train)
round(accuracy_score(y_test, dummy.predict(X_test)), 3)
```

---

## Preprocessing

Two column lists, numeric and the rest. The numeric recipe fills with the median, then scales. The text recipe fills with the most frequent label, then one-hot encodes with unknown labels ignored. `ColumnTransformer` sends each list to its recipe and `Pipeline` means then. Everything learns from the training rows at `fit` and is applied to the test rows at `predict`, which is what keeps the test set out of the model.

```python
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler, OneHotEncoder

num_cols = X.select_dtypes("number").columns.tolist()
cat_cols = [c for c in X.columns if c not in num_cols]
numeric = Pipeline([("impute", SimpleImputer(strategy="median")), ("scale", StandardScaler())])
categorical = Pipeline([("impute", SimpleImputer(strategy="most_frequent")), ("onehot", OneHotEncoder(handle_unknown="ignore"))])
prep = ColumnTransformer([("num", numeric, num_cols), ("cat", categorical, cat_cols)])
```

---

## Fit and predict

`predict` gives the class at the 0.5 threshold. `predict_proba` gives one column per class, and the second column is the probability of the positive class.

```python
from sklearn.linear_model import LogisticRegression

pipe = Pipeline([("prep", prep), ("model", LogisticRegression(max_iter=1000))]).fit(X_train, y_train)
pred = pipe.predict(X_test)
proba = pipe.predict_proba(X_test)[:, 1]
```

---

## Score

Accuracy and F1 take the hard predictions, AUC takes the probabilities. F1 is the harmonic mean of precision and recall for the positive class. AUC is the probability that a random positive scores above a random negative, independent of the threshold. The written result names the baseline next to the model and the metric chosen with its reason.

```python
round(accuracy_score(y_test, pred), 3), round(f1_score(y_test, pred), 3), round(roc_auc_score(y_test, proba), 3)
print(classification_report(y_test, pred))
confusion_matrix(y_test, pred)
```

---

## Threshold

A new threshold needs no refit. A lower one marks more rows positive, so recall rises and precision and accuracy fall. The choice is justified by the cost of a miss against the cost of a false alarm.

```python
pred_30 = (proba >= 0.3).astype(int)
round(recall_score(y_test, pred_30), 3), round(f1_score(y_test, pred_30), 3), round(accuracy_score(y_test, pred_30), 3)
```

---

## Cross-validation

Five fits on five folds of the training rows, each fold held out once, the test set untouched. For a classifier and an integer `cv` the folds are stratified. Passing the pipeline, not the bare model, refits the preprocessing inside every fold. The mean is the estimate and the standard deviation says how far a single split can mislead. Scoring names are `"accuracy"`, `"f1"`, `"roc_auc"`, `"r2"` and `"neg_root_mean_squared_error"`.

```python
from sklearn.model_selection import cross_val_score

scores = cross_val_score(pipe, X_train, y_train, cv=5, scoring="roc_auc")
scores.round(3), scores.mean().round(3), scores.std().round(3)
```

---

## Explain

Logistic regression coefficients come out in the order of `get_feature_names_out()`. A positive coefficient pushes toward the positive class, and scaled numeric columns are comparable with each other. The signs have to agree with the groupby rates from the analysis. A tree ensemble exposes `feature_importances_` instead, in the same order.

```python
names = pipe["prep"].get_feature_names_out()
coef = pd.Series(pipe["model"].coef_[0], index=names).sort_values()
coef.head(5), coef.tail(5)
```

---

## Other classifiers

The estimator is the only thing that changes. Trees do not need scaling and the scaler does them no harm, so the preprocessing stays.

```python
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier

for name, est in {"logreg": LogisticRegression(max_iter=1000),
                  "forest": RandomForestClassifier(n_estimators=300, random_state=42),
                  "boost": GradientBoostingClassifier(random_state=42)}.items():
    p = Pipeline([("prep", prep), ("model", est)]).fit(X_train, y_train)
    print(name, round(roc_auc_score(y_test, p.predict_proba(X_test)[:, 1]), 3))
```

---

## Regression

A numeric target takes the same pipeline with a regressor and no `stratify`. The baseline predicts the training mean. RMSE is in the unit of the target and punishes large misses, MAE is the average miss, and R² is the share of variance explained, 1 for a perfect fit, 0 for the mean baseline, negative for worse than the mean. A right-skewed target is fit on `log1p` and the predictions come back through `expm1`, with the metrics on the original scale. A row without a target is dropped before the split, never imputed.

```python
from sklearn.dummy import DummyRegressor
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import root_mean_squared_error, mean_absolute_error, r2_score

df = df.dropna(subset=["amount"])
X = df.drop(columns=["amount"])
y = df["amount"]
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
num_cols = X.select_dtypes("number").columns.tolist()
cat_cols = [c for c in X.columns if c not in num_cols]
prep = ColumnTransformer([("num", numeric, num_cols), ("cat", categorical, cat_cols)])

base = DummyRegressor(strategy="mean").fit(X_train, y_train).predict(X_test)
round(root_mean_squared_error(y_test, base), 2), round(mean_absolute_error(y_test, base), 2)

reg = Pipeline([("prep", prep), ("model", LinearRegression())]).fit(X_train, y_train)
pred = reg.predict(X_test)
round(root_mean_squared_error(y_test, pred), 2), round(mean_absolute_error(y_test, pred), 2), round(r2_score(y_test, pred), 3)

boost = Pipeline([("prep", prep), ("model", GradientBoostingRegressor(random_state=42))]).fit(X_train, y_train)
round(r2_score(y_test, boost.predict(X_test)), 3)

log_reg = Pipeline([("prep", prep), ("model", LinearRegression())]).fit(X_train, np.log1p(y_train))
round(root_mean_squared_error(y_test, np.expm1(log_reg.predict(X_test))), 2)

cross_val_score(reg, X_train, y_train, cv=5, scoring="r2").mean().round(3)
```
