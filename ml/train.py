"""
NeuroCheck — model training

What this script does, in order:
1. Loads the brain stroke dataset (5,140 people, 407 marked as stroke).
2. Finds near-copies of stroke patients (synthetic rows that were added to the
   dataset) and groups them, so a copy never sits in both the training and the
   test fold. Without this, scores look much better than they really are.
3. Compares several models with this leak-safe 5-fold cross-validation.
4. Trains the final model (logistic regression) and checks its calibration,
   so "12% risk" really means about 12 in 100 similar people.
5. Saves the model and every number the app shows to ../server/model/.

Run:  python train.py
"""
import json
import warnings
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import ExtraTreesClassifier, HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (average_precision_score, brier_score_loss, confusion_matrix, precision_score,
                             recall_score, roc_auc_score, roc_curve)
from sklearn.model_selection import StratifiedGroupKFold, StratifiedKFold, cross_val_predict, train_test_split
from sklearn.neighbors import radius_neighbors_graph
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

warnings.filterwarnings("ignore")
HERE = Path(__file__).parent
OUT = HERE.parent / "server" / "model"
OUT.mkdir(parents=True, exist_ok=True)
SEED = 42

NUM = ["age", "avg_glucose_level", "bmi"]
BIN = ["hypertension", "heart_disease"]
CAT = ["gender", "ever_married", "work_type", "Residence_type", "smoking_status"]
FEATURES = NUM + BIN + CAT

LABELS = {
    "age": "Age", "avg_glucose_level": "Blood sugar (glucose)", "bmi": "Body mass index (BMI)",
    "hypertension": "High blood pressure", "heart_disease": "Heart disease", "gender": "Gender",
    "ever_married": "Marital status", "work_type": "Type of work", "Residence_type": "Area (urban/rural)",
    "smoking_status": "Smoking",
}

# --------------------------------------------------------------------------- data
df = pd.read_csv(HERE / "data" / "brain_stroke.csv")
X, y = df[FEATURES], df["stroke"].values
print(f"Loaded {len(df)} rows, {y.sum()} stroke ({y.mean():.1%})")


# --------------------------------------------------------- find synthetic copies
def find_copy_groups(radius=0.3):
    """Link stroke rows that are almost identical (same categories, very close
    age / glucose / BMI). Each connected group is treated as one patient."""
    Z = pd.get_dummies(X, dtype=float)
    Z["bmi"] = Z["bmi"].fillna(Z["bmi"].median())
    Z[NUM] = (Z[NUM] - Z[NUM].mean()) / Z[NUM].std()
    G = radius_neighbors_graph(Z.values, radius=radius, mode="connectivity").tocoo()
    s = y == 1
    keep = s[G.row] & s[G.col]
    G = coo_matrix((np.ones(keep.sum()), (G.row[keep], G.col[keep])), shape=G.shape)
    return connected_components(G, directed=False)[1]


groups = find_copy_groups()
group_size = pd.Series(groups).map(pd.Series(groups).value_counts()).values
n_real = len(set(groups[y == 1]))
print(f"Stroke rows collapse into {n_real} distinct patients -> about {y.sum() - n_real} are near-copies")

# Nearest-neighbour evidence (shown on the 'How it works' page)
from sklearn.neighbors import NearestNeighbors  # noqa: E402

Zs = pd.get_dummies(X, dtype=float); Zs["bmi"] = Zs["bmi"].fillna(Zs["bmi"].median())
Zs[NUM] = (Zs[NUM] - Zs[NUM].mean()) / Zs[NUM].std()
_, idx = NearestNeighbors(n_neighbors=2).fit(Zs.values).kneighbors(Zs.values)
stroke_nn_same = float((y[idx[:, 1]] == 1)[y == 1].mean())


# ------------------------------------------------------------------ preprocessing
def linear_pre():
    return ColumnTransformer([
        ("num", Pipeline([("impute", SimpleImputer(strategy="median")), ("scale", StandardScaler())]), NUM),
        ("bin", "passthrough", BIN),
        ("cat", OneHotEncoder(handle_unknown="ignore", drop="if_binary"), CAT),
    ])


def tree_pre():
    return ColumnTransformer([
        ("num", SimpleImputer(strategy="median"), NUM), ("bin", "passthrough", BIN),
        ("cat", OneHotEncoder(handle_unknown="ignore"), CAT),
    ])


CANDIDATES = {
    "Logistic Regression": lambda: Pipeline([("pre", linear_pre()), ("model", LogisticRegression(C=0.1, class_weight="balanced", max_iter=5000))]),
    "Random Forest": lambda: Pipeline([("pre", tree_pre()), ("model", RandomForestClassifier(400, min_samples_leaf=30, class_weight="balanced_subsample", n_jobs=-1, random_state=SEED))]),
    "Gradient Boosting": lambda: Pipeline([("pre", tree_pre()), ("model", HistGradientBoostingClassifier(learning_rate=0.03, max_depth=3, max_iter=250, l2_regularization=1.0, class_weight="balanced", random_state=SEED))]),
    "Extra Trees": lambda: Pipeline([("pre", tree_pre()), ("model", ExtraTreesClassifier(400, min_samples_leaf=15, class_weight="balanced", n_jobs=-1, random_state=SEED))]),
    "Random Forest (overfit, old style)": lambda: Pipeline([("pre", tree_pre()), ("model", RandomForestClassifier(400, min_samples_leaf=1, class_weight="balanced_subsample", n_jobs=-1, random_state=SEED))]),
}

# ------------------------------------------------------------ model comparison
comparison = []
for name, make in CANDIDATES.items():
    naive, safe = [], []
    for rep in range(3):
        p = cross_val_predict(make(), X, y, cv=StratifiedKFold(5, shuffle=True, random_state=rep), method="predict_proba")[:, 1]
        naive.append(roc_auc_score(y, p))
        p = cross_val_predict(make(), X, y, groups=groups, cv=StratifiedGroupKFold(5, shuffle=True, random_state=rep), method="predict_proba")[:, 1]
        safe.append(roc_auc_score(y, p))
    comparison.append({"model": name, "auc_naive": round(np.mean(naive), 3), "auc_leak_safe": round(np.mean(safe), 3)})
    print(f"  {name:36s} naive AUC {np.mean(naive):.3f} | leak-safe AUC {np.mean(safe):.3f}")

# --------------------------------------------- the OLD project's method, measured
old_enc = {"gender": {"Female": 0, "Male": 1}, "ever_married": {"No": 0, "Yes": 1},
           "work_type": {"children": 0, "Govt_job": 1, "Private": 2, "Self-employed": 3},
           "Residence_type": {"Rural": 0, "Urban": 1},
           "smoking_status": {"formerly smoked": 0, "never smoked": 1, "smokes": 2, "Unknown": 3}}
old = pd.concat([df[df.stroke == 0].head(400), df[df.stroke == 1].head(407)]).dropna().replace(old_enc)
old_accs = []
for s in range(20):
    a, b, c, d = train_test_split(old.drop(columns="stroke"), old.stroke, stratify=old.stroke, test_size=0.1, random_state=s)
    old_accs.append((ExtraTreesClassifier(n_estimators=15, random_state=42, max_features="log2").fit(a, c).predict(b) == d).mean())

# ---------------------------------------------------------------- final model
# Each group of near-copies counts as ONE patient (weight 1/size), and no class
# balancing, so the predicted probability is a real, calibrated risk.
weights = np.where(y == 1, 1.0 / group_size, 1.0)


def make_final():
    return Pipeline([("pre", linear_pre()), ("model", LogisticRegression(C=0.1, max_iter=5000))])


oof = np.zeros(len(y))
for rep in range(3):
    p = np.zeros(len(y))
    for tr, te in StratifiedGroupKFold(5, shuffle=True, random_state=rep).split(X, y, groups):
        m = make_final().fit(X.iloc[tr], y[tr], model__sample_weight=weights[tr])
        p[te] = m.predict_proba(X.iloc[te])[:, 1]
    oof += p / 3

auc = roc_auc_score(y, oof, sample_weight=weights)
ap = average_precision_score(y, oof, sample_weight=weights)
brier = brier_score_loss(y, oof, sample_weight=weights)
real_rate = float(np.average(y, weights=weights))

# Risk levels. "High" is set so the app catches about 80% of real strokes.
fpr, tpr, thr = roc_curve(y, oof, sample_weight=weights)
HIGH = float(thr[np.argmax(tpr >= 0.80)])
MODERATE = float(np.quantile(oof[y == 0], 0.50))
pred_high = (oof >= HIGH).astype(int)
cm = confusion_matrix(y, pred_high, sample_weight=weights)
recall = recall_score(y, pred_high, sample_weight=weights)
precision = precision_score(y, pred_high, sample_weight=weights)
specificity = cm[0, 0] / cm[0].sum()

# Calibration table: predicted vs observed in 5 risk bands
bands = pd.qcut(oof, 5, labels=False, duplicates="drop")
calibration = [{"predicted": round(float(np.average(oof[bands == b], weights=weights[bands == b])) * 100, 1),
                "observed": round(float(np.average(y[bands == b], weights=weights[bands == b])) * 100, 1)}
               for b in sorted(set(bands))]

print(f"\nFinal model (leak-safe CV): ROC-AUC {auc:.3f} | PR-AUC {ap:.3f} | Brier {brier:.4f}")
print(f"High-risk cut-off {HIGH:.3f}: catches {recall:.0%} of strokes, specificity {specificity:.0%}")

final = make_final().fit(X, y, model__sample_weight=weights)

# ------------------------------------------------ data for the explanations
pre = final.named_steps["pre"]; lr = final.named_steps["model"]
names = pre.get_feature_names_out()
Xt = pre.transform(X)
baseline_t = np.average(Xt, axis=0, weights=weights)  # the "average person" in model space

coef_by_feature = {}
for n, c in zip(names, lr.coef_[0]):
    block, col = n.split("__", 1)
    feat = next(f for f in FEATURES if col == f or col.startswith(f + "_"))
    coef_by_feature.setdefault(feat, 0.0)
    coef_by_feature[feat] += abs(c) * float(np.std(Xt[:, list(names).index(n)]))
importance = sorted(({"feature": f, "label": LABELS[f], "weight": round(v, 4)} for f, v in coef_by_feature.items()),
                    key=lambda r: -r["weight"])

# Average risk by age band (for "people like you")
all_p = final.predict_proba(X)[:, 1]
age_bands = []
for lo, hi in [(0, 18), (18, 30), (30, 40), (40, 50), (50, 60), (60, 70), (70, 120)]:
    m = (df.age >= lo) & (df.age < hi)
    age_bands.append({"from": lo, "to": hi, "avg_risk": round(float(np.average(all_p[m], weights=weights[m])), 4)})

roc_points = [{"fpr": round(float(a), 3), "tpr": round(float(b), 3)} for a, b in zip(fpr, tpr)][:: max(1, len(fpr) // 60)] + [{"fpr": 1.0, "tpr": 1.0}]

joblib.dump({"pipeline": final, "feature_names": list(names), "baseline": baseline_t,
             "features": FEATURES, "labels": LABELS}, OUT / "model.joblib")

metrics = {
    "dataset": {"rows": int(len(df)), "stroke_rows": int(y.sum()), "distinct_stroke_patients": int(n_real),
                "near_copies": int(y.sum() - n_real), "stroke_nn_same_label": round(stroke_nn_same, 3),
                "stroke_rate_real": round(real_rate, 4)},
    "final_model": {"name": "Logistic Regression (calibrated, copy-aware)", "roc_auc": round(auc, 3), "pr_auc": round(ap, 3),
                    "brier": round(brier, 4), "recall_high": round(float(recall), 3), "precision_high": round(float(precision), 3),
                    "specificity_high": round(float(specificity), 3),
                    "confusion": {"tn": round(float(cm[0, 0])), "fp": round(float(cm[0, 1])), "fn": round(float(cm[1, 0])), "tp": round(float(cm[1, 1]))}},
    "thresholds": {"moderate": round(MODERATE, 4), "high": round(HIGH, 4)},
    "old_method": {"accuracy_mean": round(float(np.mean(old_accs)), 3), "accuracy_min": round(float(min(old_accs)), 3),
                   "accuracy_max": round(float(max(old_accs)), 3), "test_rows": 81, "always_no_accuracy": round(1 - float(y.mean()), 3)},
    "comparison": comparison, "importance": importance, "age_bands": age_bands,
    "calibration": calibration, "roc": roc_points,
}
(OUT / "metrics.json").write_text(json.dumps(metrics, indent=2))
print(f"\nSaved model and metrics to {OUT}")
