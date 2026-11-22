import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Calculator, Check } from "lucide-react";
import toast from "react-hot-toast";
import API, { errorMessage } from "../lib/api";
import { useAuth } from "../lib/auth";
import { DEFAULT_FORM, bmiBand, glucoseBand, loadLastResult, saveLastResult } from "../lib/risk";
import { Segmented, Spinner, YesNo } from "../components/ui";

const STEPS = ["About you", "Your health", "Lifestyle"];

const WORK = [
  ["Private", "Private job"],
  ["Self-employed", "Self-employed"],
  ["Govt_job", "Government job"],
];
const SMOKING = [
  ["never smoked", "Never smoked", "I have never been a smoker"],
  ["formerly smoked", "Used to smoke", "I quit in the past"],
  ["smokes", "I smoke now", "Cigarettes, beedi or similar"],
  ["Unknown", "Prefer not to say", "The model will treat this as unknown"],
];
const LABEL = {
  gender: "Gender", ever_married: "Ever married", Residence_type: "Area", work_type: "Work",
  hypertension: "High blood pressure", heart_disease: "Heart disease", avg_glucose_level: "Glucose", bmi: "BMI", smoking_status: "Smoking",
};

function NumberSlider({ value, onChange, min, max, step = 1, unit }) {
  return (
    <div className="flex items-center gap-4">
      <input type="range" min={min} max={max} step={step} value={value ?? min} onChange={(e) => onChange(Number(e.target.value))} className="h-2 flex-1 cursor-pointer" />
      <div className="flex w-32 items-center rounded-xl border border-line bg-white px-3 focus-within:border-ink">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
          className="w-full bg-transparent py-2.5 text-right font-display text-lg font-semibold outline-none"
        />
        {unit && <span className="ml-1 text-xs text-muted">{unit}</span>}
      </div>
    </div>
  );
}

function BmiHelper({ onResult }) {
  const [h, setH] = useState("");
  const [w, setW] = useState("");
  const bmi = h && w ? w / Math.pow(h / 100, 2) : null;
  return (
    <div className="mt-3 grid grid-cols-[1fr_1fr_auto] items-end gap-3 rounded-2xl bg-paper p-4">
      <div>
        <label className="text-xs font-medium text-muted">Height (cm)</label>
        <input className="input mt-1 py-2" type="number" value={h} onChange={(e) => setH(e.target.value)} placeholder="160" />
      </div>
      <div>
        <label className="text-xs font-medium text-muted">Weight (kg)</label>
        <input className="input mt-1 py-2" type="number" value={w} onChange={(e) => setW(e.target.value)} placeholder="58" />
      </div>
      <button type="button" disabled={!bmi || bmi < 10 || bmi > 60} onClick={() => onResult(Math.round(bmi * 10) / 10)} className="btn-dark py-2.5">
        Use {bmi ? bmi.toFixed(1) : "–"}
      </button>
    </div>
  );
}

export default function Assess() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [form, setForm] = useState(() => ({ ...DEFAULT_FORM, ...(loadLastResult()?.inputs || {}) }));
  const [bmiUnknown, setBmiUnknown] = useState(() => loadLastResult()?.inputs?.bmi === null);
  const [showCalc, setShowCalc] = useState(false);
  const [save, setSave] = useState(true);
  const [loading, setLoading] = useState(false);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const child = Number(form.age) < 16;

  const valid = [
    form.age >= 1 && form.age <= 100,
    form.avg_glucose_level >= 50 && form.avg_glucose_level <= 300 && (bmiUnknown || (form.bmi >= 10 && form.bmi <= 60)),
    true,
  ];

  const go = (n) => {
    setDir(n > step ? 1 : -1);
    setStep(n);
  };

  const submit = async () => {
    setLoading(true);
    const payload = { ...form, bmi: bmiUnknown ? null : form.bmi, work_type: child ? "children" : form.work_type, save: Boolean(user && save) };
    try {
      const { data } = await API.post("/predict", payload);
      saveLastResult(data);
      if (data.saved_id) toast.success("Saved to your history");
      navigate("/result", { state: data });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const g = glucoseBand(form.avg_glucose_level);
  const b = bmiBand(bmiUnknown ? null : form.bmi);

  const summary = Object.entries({ ...form, work_type: child ? "Child" : WORK.find((w) => w[0] === form.work_type)?.[1], bmi: bmiUnknown ? "Not known" : form.bmi })
    .filter(([k]) => k !== "age")
    .map(([k, v]) => [LABEL[k], v === 1 ? "Yes" : v === 0 ? "No" : SMOKING.find((s) => s[0] === v)?.[1] || v]);

  return (
    <div className="mx-auto max-w-3xl px-5 pb-10 pt-28">
      <p className="kicker">Stroke risk assessment</p>
      <h1 className="mt-2 text-4xl font-bold md:text-5xl">{STEPS[step]}</h1>

      {/* progress */}
      <div className="mt-8 flex gap-2">
        {STEPS.map((s, i) => (
          <button key={s} onClick={() => i < step && go(i)} className="flex-1 text-left" disabled={i > step}>
            <div className="h-1.5 overflow-hidden rounded-full bg-line">
              <motion.div className="h-full bg-pulse" initial={false} animate={{ width: i <= step ? "100%" : "0%" }} transition={{ duration: 0.4 }} />
            </div>
            <p className={`mt-2 text-xs font-medium ${i <= step ? "text-ink" : "text-muted"}`}>
              {i + 1}. {s}
            </p>
          </button>
        ))}
      </div>

      <div className="relative mt-10 min-h-[420px]">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={step}
            custom={dir}
            initial={{ opacity: 0, x: dir * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -40 }}
            transition={{ duration: 0.3 }}
            className="space-y-8"
          >
            {step === 0 && (
              <>
                <div>
                  <label className="label">How old are you?</label>
                  <NumberSlider value={form.age} onChange={set("age")} min={1} max={100} unit="years" />
                  <p className="mt-2 text-sm text-muted">Age is the strongest risk factor for stroke.</p>
                </div>
                <div>
                  <label className="label">Gender</label>
                  <Segmented value={form.gender} onChange={set("gender")} options={[["Female", "Female"], ["Male", "Male"]]} name="Gender" />
                </div>
                <div className="grid gap-8 sm:grid-cols-2">
                  <div>
                    <label className="label">Have you ever been married?</label>
                    <Segmented value={form.ever_married} onChange={set("ever_married")} options={[["Yes", "Yes"], ["No", "No"]]} name="Married" />
                  </div>
                  <div>
                    <label className="label">Where do you live?</label>
                    <Segmented value={form.Residence_type} onChange={set("Residence_type")} options={[["Urban", "City / town"], ["Rural", "Village"]]} name="Area" />
                  </div>
                </div>
                <div>
                  <label className="label">What kind of work do you do?</label>
                  {child ? (
                    <p className="rounded-2xl bg-paper p-4 text-sm text-muted">Under 16, so this is set to "child" automatically.</p>
                  ) : (
                    <Segmented value={form.work_type} onChange={set("work_type")} options={WORK} name="Work" />
                  )}
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <YesNo label="Do you have high blood pressure?" hint="Diagnosed by a doctor, or you take BP medicine." value={form.hypertension} onChange={set("hypertension")} />
                <YesNo label="Do you have any heart disease?" hint="For example a heart attack, angina or heart failure." value={form.heart_disease} onChange={set("heart_disease")} />
                <div>
                  <div className="flex items-baseline justify-between">
                    <label className="label">Average blood sugar (glucose)</label>
                    <span className={`text-sm font-semibold ${g.cls}`}>{g.label}</span>
                  </div>
                  <NumberSlider value={form.avg_glucose_level} onChange={set("avg_glucose_level")} min={50} max={300} unit="mg/dL" />
                  <p className="mt-2 text-sm text-muted">From a recent blood test. Not sure? 90–100 mg/dL is typical for a healthy adult.</p>
                </div>
                <div>
                  <div className="flex items-baseline justify-between">
                    <label className="label">Body mass index (BMI)</label>
                    {b && <span className={`text-sm font-semibold ${b.cls}`}>{b.label}</span>}
                  </div>
                  {!bmiUnknown && <NumberSlider value={form.bmi} onChange={set("bmi")} min={10} max={60} step={0.1} unit="kg/m²" />}
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                    <button type="button" onClick={() => setShowCalc((s) => !s)} className="inline-flex items-center gap-1.5 font-medium text-pulse">
                      <Calculator size={15} /> Calculate from height & weight
                    </button>
                    <label className="flex cursor-pointer items-center gap-2 text-muted">
                      <input type="checkbox" checked={bmiUnknown} onChange={(e) => setBmiUnknown(e.target.checked)} className="h-4 w-4 accent-pulse" />I don't know my BMI
                    </label>
                  </div>
                  {showCalc && (
                    <BmiHelper
                      onResult={(v) => {
                        setBmiUnknown(false);
                        set("bmi")(v);
                        setShowCalc(false);
                      }}
                    />
                  )}
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div>
                  <label className="label">Do you smoke?</label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {SMOKING.map(([v, title, text]) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => set("smoking_status")(v)}
                        className={`relative rounded-2xl border p-5 text-left transition ${form.smoking_status === v ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink/40"}`}
                      >
                        {form.smoking_status === v && <Check size={16} className="absolute right-4 top-4" />}
                        <p className="font-semibold">{title}</p>
                        <p className={`mt-1 text-sm ${form.smoking_status === v ? "text-white/70" : "text-muted"}`}>{text}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="card p-6">
                  <p className="font-display text-lg font-semibold">Review your answers</p>
                  <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-muted">Age</dt>
                      <dd className="font-medium">{form.age} years</dd>
                    </div>
                    {summary.map(([k, v]) => (
                      <div key={k}>
                        <dt className="text-muted">{k}</dt>
                        <dd className="font-medium">{String(v)}</dd>
                      </div>
                    ))}
                  </dl>
                  {user ? (
                    <label className="mt-5 flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} className="h-4 w-4 accent-pulse" /> Save this result to my history
                    </label>
                  ) : (
                    <p className="mt-5 text-sm text-muted">
                      <Link to="/login" state={{ from: "/assess" }} className="font-medium text-pulse">Log in</Link> if you want to save results and track them over time.
                    </p>
                  )}
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-10 flex items-center justify-between border-t border-line pt-6">
        <button onClick={() => go(step - 1)} disabled={step === 0} className="btn-ghost disabled:invisible">
          <ArrowLeft size={16} /> Back
        </button>
        {step < 2 ? (
          <button onClick={() => go(step + 1)} disabled={!valid[step]} className="btn-dark px-8">
            Continue <ArrowRight size={16} />
          </button>
        ) : (
          <button onClick={submit} disabled={loading} className="btn-primary px-8">
            {loading ? <Spinner /> : null} {loading ? "Analysing…" : "See my result"}
          </button>
        )}
      </div>
    </div>
  );
}
