"""Loads the trained model and turns a person's answers into a clear result."""
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

MODEL_DIR = Path(__file__).parent / "model"

CHOICES = {
    "gender": ["Male", "Female"],
    "ever_married": ["Yes", "No"],
    "work_type": ["Private", "Self-employed", "Govt_job", "children"],
    "Residence_type": ["Urban", "Rural"],
    "smoking_status": ["never smoked", "formerly smoked", "smokes", "Unknown"],
}


class ValidationError(ValueError):
    pass


class Predictor:
    def __init__(self):
        bundle = joblib.load(MODEL_DIR / "model.joblib")
        self.pipe = bundle["pipeline"]
        self.pre = self.pipe.named_steps["pre"]
        self.coef = self.pipe.named_steps["model"].coef_[0]
        self.intercept = self.pipe.named_steps["model"].intercept_[0]
        self.names = bundle["feature_names"]
        self.baseline = bundle["baseline"]
        self.features = bundle["features"]
        self.labels = bundle["labels"]
        self.metrics = json.loads((MODEL_DIR / "metrics.json").read_text())
        self.thresholds = self.metrics["thresholds"]
        # Which original question each model column belongs to
        self.col_feature = []
        for n in self.names:
            col = n.split("__", 1)[1]
            self.col_feature.append(next(f for f in self.features if col == f or col.startswith(f + "_")))

    # ------------------------------------------------------------ validation
    @staticmethod
    def clean(data):
        """Check every answer and return a tidy dict, or raise ValidationError."""
        def number(key, lo, hi, label, optional=False):
            v = data.get(key)
            if v in (None, ""):
                if optional:
                    return None
                raise ValidationError(f"{label} is required")
            try:
                v = float(v)
            except (TypeError, ValueError):
                raise ValidationError(f"{label} must be a number")
            if not lo <= v <= hi:
                raise ValidationError(f"{label} must be between {lo} and {hi}")
            return v

        def yes_no(key, label):
            v = data.get(key)
            if v in (True, 1, "1", "yes", "Yes", "true"):
                return 1
            if v in (False, 0, "0", "no", "No", "false"):
                return 0
            raise ValidationError(f"Please answer: {label}")

        out = {
            "age": number("age", 1, 100, "Age"),
            "avg_glucose_level": number("avg_glucose_level", 50, 300, "Glucose level"),
            "bmi": number("bmi", 10, 60, "BMI", optional=True),
            "hypertension": yes_no("hypertension", "high blood pressure"),
            "heart_disease": yes_no("heart_disease", "heart disease"),
        }
        for key, options in CHOICES.items():
            v = data.get(key)
            if v not in options:
                raise ValidationError(f"Invalid value for {key.replace('_', ' ')}")
            out[key] = v
        if out["age"] < 16 and out["work_type"] != "children":
            out["work_type"] = "children"
        return out

    # ------------------------------------------------------------ prediction
    def _prob(self, row):
        return float(self.pipe.predict_proba(pd.DataFrame([row])[self.features])[0, 1])

    def level(self, p):
        if p >= self.thresholds["high"]:
            return "high"
        if p >= self.thresholds["moderate"]:
            return "moderate"
        return "low"

    def age_average(self, age):
        for band in self.metrics["age_bands"]:
            if band["from"] <= age < band["to"]:
                return band
        return self.metrics["age_bands"][-1]

    def explain(self, row, p):
        """How much each answer moves the risk compared with an average person.
        Logistic regression adds up evidence, so we can take each answer out
        and see exactly how much it changed the result."""
        xt = self.pre.transform(pd.DataFrame([row])[self.features])
        xt = np.asarray(xt.todense() if hasattr(xt, "todense") else xt)[0]
        contrib = {}
        for i, f in enumerate(self.col_feature):
            contrib[f] = contrib.get(f, 0.0) + self.coef[i] * (xt[i] - self.baseline[i])
        logit = np.log(p / (1 - p))
        out = []
        for f, c in contrib.items():
            without = 1 / (1 + np.exp(-(logit - c)))
            out.append({"feature": f, "label": self.labels[f], "points": round((p - without) * 100, 2)})
        return sorted(out, key=lambda r: -abs(r["points"]))

    def what_if(self, row, p):
        """Changes a person could make, and how the risk would move."""
        ideas = []

        def test(change, title, detail):
            new = self._prob({**row, **change})
            if new < p - 0.0005:
                ideas.append({"title": title, "detail": detail, "new_risk": round(new, 4),
                              "drop": round((p - new) * 100, 2), "change": change})

        if row["avg_glucose_level"] > 140:
            test({"avg_glucose_level": 100.0}, "Bring blood sugar to a healthy range", "Fasting glucose around 100 mg/dL or below is considered healthy.")
        if row["bmi"] and row["bmi"] > 25:
            test({"bmi": 24.5}, "Reach a healthy weight", "A BMI between 18.5 and 24.9 is considered healthy.")
        if row["hypertension"] == 1:
            test({"hypertension": 0}, "Keep blood pressure under control", "Regular check-ups and medication (if prescribed) help a lot.")
        ideas.sort(key=lambda r: -r["drop"])
        # In this dataset former smokers are mostly older people, so the model
        # can't measure the benefit of quitting. Medical research is clear, so
        # we give the advice without a misleading number.
        if row["smoking_status"] == "smokes":
            ideas.append({"title": "Quit smoking", "drop": None, "new_risk": None, "change": None,
                          "detail": "Smoking roughly doubles stroke risk in medical studies. This dataset can't measure the benefit of quitting, so no number is shown."})
        return ideas

    def predict(self, data):
        row = self.clean(data)
        p = self._prob(row)
        band = self.age_average(row["age"])
        return {
            "inputs": row,
            "risk": round(p, 4),
            "level": self.level(p),
            "thresholds": self.thresholds,
            "age_band": band,
            "relative_to_age": round(p / band["avg_risk"], 2) if band["avg_risk"] else None,
            "factors": self.explain(row, p),
            "what_if": self.what_if(row, p),
        }


predictor = Predictor()
