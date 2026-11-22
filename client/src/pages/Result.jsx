import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowDown, ArrowRight, BookmarkPlus, Info, Pencil, Printer, Sparkles, Stethoscope } from "lucide-react";
import toast from "react-hot-toast";
import API, { errorMessage } from "../lib/api";
import { useAuth } from "../lib/auth";
import { LEVELS, bmiBand, glucoseBand, inHundred, loadLastResult, pct, saveLastResult } from "../lib/risk";
import RiskGauge from "../components/RiskGauge";
import { Reveal, Segmented, Spinner } from "../components/ui";

const FIXED = new Set(["age", "gender", "ever_married", "work_type", "Residence_type"]);

function FactorBars({ factors }) {
  const top = factors.filter((f) => Math.abs(f.points) >= 0.05).slice(0, 7);
  const max = Math.max(...top.map((f) => Math.abs(f.points)), 0.5);
  return (
    <div className="space-y-4">
      {top.map((f, i) => {
        const up = f.points > 0;
        return (
          <div key={f.feature}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium">
                {f.label}
                {FIXED.has(f.feature) && <span className="ml-2 text-xs font-normal text-muted">can't change</span>}
              </span>
              <span className={`font-semibold tabular-nums ${up ? "text-pulse" : "text-calm"}`}>
                {up ? "+" : "−"}
                {Math.abs(f.points).toFixed(1)} pts
              </span>
            </div>
            <div className="mt-1.5 grid grid-cols-2 gap-0.5">
              <div className="flex h-2.5 justify-end rounded-l-full bg-paper">
                {!up && <motion.div className="h-full rounded-l-full bg-calm" initial={{ width: 0 }} animate={{ width: `${(Math.abs(f.points) / max) * 100}%` }} transition={{ delay: 0.2 + i * 0.07, duration: 0.7 }} />}
              </div>
              <div className="h-2.5 rounded-r-full bg-paper">
                {up && <motion.div className="h-full rounded-r-full bg-pulse" initial={{ width: 0 }} animate={{ width: `${(Math.abs(f.points) / max) * 100}%` }} transition={{ delay: 0.2 + i * 0.07, duration: 0.7 }} />}
              </div>
            </div>
          </div>
        );
      })}
      <div className="flex justify-between pt-1 text-xs text-muted">
        <span>← lowers your risk</span>
        <span>raises your risk →</span>
      </div>
    </div>
  );
}

function WhatIf({ base }) {
  const [sim, setSim] = useState({ ...base.inputs });
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef();
  const changed = ["avg_glucose_level", "bmi", "hypertension", "heart_disease"].some((k) => sim[k] !== base.inputs[k]);

  useEffect(() => {
    if (!changed) return setRes(null);
    clearTimeout(timer.current);
    setBusy(true);
    timer.current = setTimeout(() => {
      API.post("/predict", sim)
        .then((r) => setRes(r.data))
        .catch((e) => toast.error(errorMessage(e)))
        .finally(() => setBusy(false));
    }, 350);
    return () => clearTimeout(timer.current);
  }, [sim]); // eslint-disable-line react-hooks/exhaustive-deps

  const now = res?.risk ?? base.risk;
  const diff = (now - base.risk) * 100;
  const g = glucoseBand(sim.avg_glucose_level);
  const b = bmiBand(sim.bmi);

  return (
    <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr]">
      <div className="space-y-6">
        <div>
          <div className="flex justify-between text-sm">
            <span className="font-medium">Blood sugar</span>
            <span>
              <b className="tabular-nums">{sim.avg_glucose_level}</b> mg/dL · <span className={g.cls}>{g.label}</span>
            </span>
          </div>
          <input type="range" min={50} max={300} value={sim.avg_glucose_level} onChange={(e) => setSim({ ...sim, avg_glucose_level: Number(e.target.value) })} className="mt-2 w-full" />
        </div>
        {sim.bmi != null && (
          <div>
            <div className="flex justify-between text-sm">
              <span className="font-medium">BMI</span>
              <span>
                <b className="tabular-nums">{sim.bmi}</b> · <span className={b?.cls}>{b?.label}</span>
              </span>
            </div>
            <input type="range" min={15} max={50} step={0.5} value={sim.bmi} onChange={(e) => setSim({ ...sim, bmi: Number(e.target.value) })} className="mt-2 w-full" />
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-medium">High blood pressure</p>
            <Segmented value={sim.hypertension} onChange={(v) => setSim({ ...sim, hypertension: v })} options={[[0, "Controlled / no"], [1, "Yes"]]} name="BP" />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Heart disease</p>
            <Segmented value={sim.heart_disease} onChange={(v) => setSim({ ...sim, heart_disease: v })} options={[[0, "No"], [1, "Yes"]]} name="Heart" />
          </div>
        </div>
        {changed && (
          <button onClick={() => setSim({ ...base.inputs })} className="text-sm font-medium text-muted underline underline-offset-4">
            Reset to my answers
          </button>
        )}
      </div>

      <div className="flex flex-col justify-center rounded-3xl bg-paper p-6 text-center">
        <p className="text-sm text-muted">{changed ? "With these changes" : "Move a slider to see what changes"}</p>
        <p className="mt-2 font-display text-5xl font-bold tabular-nums" style={{ color: LEVELS[res?.level || base.level].color }}>
          {busy ? <Spinner className="h-8 w-8 text-muted" /> : pct(now)}
        </p>
        {changed && !busy && (
          <p className={`mt-2 inline-flex items-center justify-center gap-1 text-sm font-semibold ${diff < 0 ? "text-calm" : diff > 0 ? "text-pulse" : "text-muted"}`}>
            {diff < 0 && <ArrowDown size={14} />}
            {diff === 0 ? "No change" : `${diff > 0 ? "+" : ""}${diff.toFixed(1)} points vs now (${pct(base.risk)})`}
          </p>
        )}
      </div>
    </div>
  );
}

export default function Result() {
  const location = useLocation();
  const { user } = useAuth();
  const [data, setData] = useState(() => location.state || loadLastResult());
  const [saving, setSaving] = useState(false);

  if (!data) return <Navigate to="/assess" replace />;
  const L = LEVELS[data.level];
  const band = data.age_band;
  const maxBar = Math.max(data.risk, band.avg_risk) * 1.15;

  const save = async () => {
    setSaving(true);
    try {
      const { data: d } = await API.post("/predict", { ...data.inputs, save: true });
      setData(d);
      saveLastResult(d);
      toast.success("Saved to your history");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-5 pt-28">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker">Your result</p>
          <h1 className="mt-2 text-4xl font-bold md:text-5xl">Here's what your answers say.</h1>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <Link to="/assess" className="btn-ghost">
            <Pencil size={15} /> Edit answers
          </Link>
          <button onClick={() => window.print()} className="btn-ghost">
            <Printer size={15} /> Print / save PDF
          </button>
          {user && !data.saved_id && (
            <button onClick={save} disabled={saving} className="btn-dark">
              <BookmarkPlus size={15} /> {saving ? "Saving…" : "Save to history"}
            </button>
          )}
        </div>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        {/* Gauge */}
        <Reveal>
          <div className="card h-full p-8 text-center">
            <RiskGauge risk={data.risk} level={data.level} thresholds={data.thresholds} />
            <span className={`chip mt-4 ${L.soft}`}>{L.label}</span>
            <p className="mx-auto mt-4 max-w-sm text-muted">
              In our data, <b className="text-ink">{inHundred(data.risk)}</b> people with answers like yours had a stroke.
            </p>
          </div>
        </Reveal>

        {/* Comparison + doctor note */}
        <Reveal delay={0.1}>
          <div className="card flex h-full flex-col p-8">
            <h2 className="text-xl font-semibold">Compared with people your age</h2>
            <p className="mt-1 text-sm text-muted">
              Average for ages {band.from}–{band.to === 120 ? "100" : band.to - 1}: {pct(band.avg_risk)}
            </p>
            <div className="mt-6 space-y-4">
              {[
                ["You", data.risk, L.color],
                [`Average, age ${band.from}–${band.to === 120 ? "100" : band.to - 1}`, band.avg_risk, "#94A3B8"],
              ].map(([label, v, c], i) => (
                <div key={label}>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{label}</span>
                    <span className="font-semibold tabular-nums">{pct(v)}</span>
                  </div>
                  <div className="mt-1.5 h-3 rounded-full bg-paper">
                    <motion.div className="h-full rounded-full" style={{ background: c }} initial={{ width: 0 }} animate={{ width: `${(v / maxBar) * 100}%` }} transition={{ delay: 0.3 + i * 0.15, duration: 0.8 }} />
                  </div>
                </div>
              ))}
            </div>
            {data.relative_to_age && (
              <p className="mt-5 text-sm text-muted">
                That's{" "}
                <b className="text-ink">
                  {data.relative_to_age >= 1.1 ? `${data.relative_to_age.toFixed(1)}× higher than` : data.relative_to_age <= 0.9 ? `${(1 / data.relative_to_age).toFixed(1)}× lower than` : "about the same as"}
                </b>{" "}
                the average for your age group.
              </p>
            )}

            <div className={`mt-auto rounded-2xl p-5 ${data.level === "high" ? "bg-pulse-soft" : "bg-paper"}`}>
              <p className="flex items-center gap-2 font-semibold">
                {data.level === "high" ? <AlertTriangle size={17} className="text-pulse" /> : <Stethoscope size={17} className="text-calm" />}
                {data.level === "high" ? "Worth talking to a doctor" : "Keep up regular check-ups"}
              </p>
              <p className="mt-1 text-sm text-muted">
                {data.level === "high"
                  ? "Your estimated risk is higher than most people's. A doctor can check your blood pressure, sugar and cholesterol and advise you. This tool is not a diagnosis."
                  : "This is an estimate, not a diagnosis. Yearly check-ups of blood pressure and sugar are still a good idea."}
              </p>
            </div>
          </div>
        </Reveal>
      </div>

      {/* Factors */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Reveal>
          <div className="card h-full p-8">
            <h2 className="text-xl font-semibold">What's driving your result</h2>
            <p className="mb-6 mt-1 text-sm text-muted">How many percentage points each answer adds or removes, compared with an average person in the data.</p>
            <FactorBars factors={data.factors} />
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="card h-full p-8">
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <Sparkles size={18} className="text-pulse" /> Changes that would help
            </h2>
            {data.what_if.length === 0 ? (
              <p className="mt-4 text-muted">Your blood sugar, weight and blood pressure answers are already in healthy ranges. Keep it up!</p>
            ) : (
              <ul className="mt-5 space-y-3">
                {data.what_if.map((w) => (
                  <li key={w.title} className="rounded-2xl border border-line p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-semibold">{w.title}</p>
                      {w.drop != null && <span className="chip shrink-0 bg-calm-soft text-calm">−{w.drop.toFixed(1)} pts</span>}
                    </div>
                    <p className="mt-1 text-sm text-muted">{w.detail}</p>
                    {w.new_risk != null && (
                      <p className="mt-2 text-sm">
                        Risk would go from <b>{pct(data.risk)}</b> to <b className="text-calm">{pct(w.new_risk)}</b>
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Reveal>
      </div>

      {/* What-if */}
      <Reveal className="no-print">
        <div className="card mt-6 p-8">
          <h2 className="text-xl font-semibold">Try it yourself: what if…?</h2>
          <p className="mb-8 mt-1 text-sm text-muted">Change the things you can control and watch your estimated risk update live.</p>
          <WhatIf base={data} />
        </div>
      </Reveal>

      <div className="mt-6 flex items-start gap-3 rounded-2xl bg-paper p-5 text-sm text-muted ring-1 ring-line">
        <Info size={18} className="mt-0.5 shrink-0" />
        <p>
          NeuroCheck is a student machine-learning project for education. It estimates risk from patterns in a public dataset and cannot diagnose a stroke or replace a doctor.{" "}
          <Link to="/model" className="inline-flex items-center gap-1 font-medium text-ink underline underline-offset-4">
            How the model works <ArrowRight size={13} />
          </Link>
        </p>
      </div>
    </div>
  );
}
