"""Loads the trained model and turns a person's answers into a clear result."""
import json
from pathlib import Path

import numpy as np

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
        # model.json holds the trained logistic regression as plain numbers
        # (written by ml/train.py), so no scikit-learn is needed at runtime.
        model = json.loads((MODEL_DIR / "model.json").read_text())
        self.intercept = model["intercept"]
        self.columns = model["columns"]
        self.labels = model["labels"]
        self.coef = np.array([c["coef"] for c in self.columns])
        self.baseline = np.array([c["baseline"] for c in self.columns])
        self.col_feature = [c["feature"] for c in self.columns]
        self.metrics = json.loads((MODEL_DIR / "metrics.json").read_text())
        self.thresholds = self.metrics["thresholds"]

    def transform(self, row):
        """Turn one person's answers into the numbers the model was trained on:
        numbers are scaled, yes/no stays 0/1, categories become 0/1 columns."""
        out = []
        for c in self.columns:
            v = row[c["feature"]]
            if c["kind"] == "numeric":
                v = c["median"] if v is None else v
                out.append((v - c["mean"]) / c["scale"])
            elif c["kind"] == "binary":
                out.append(float(v))
            else:
                out.append(1.0 if v == c["value"] else 0.0)
        return np.array(out)

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
        z = self.intercept + float(self.coef @ self.transform(row))
        return float(1 / (1 + np.exp(-z)))

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
        xt = self.transform(row)
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
