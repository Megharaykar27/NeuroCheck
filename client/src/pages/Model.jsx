import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Area, AreaChart, Bar, CartesianGrid, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, ComposedChart } from "recharts";
import { ArrowRight, Database, GitBranch, Scale, Target, Copy, Layers } from "lucide-react";
import API, { errorMessage } from "../lib/api";
import { Reveal } from "../components/ui";

const tip = { contentStyle: { borderRadius: 12, border: "1px solid #E2DFD8", fontSize: 12 } };

const Section = ({ kicker, title, children, text }) => (
  <Reveal>
    <div className="card p-8 md:p-10">
      <p className="kicker">{kicker}</p>
      <h2 className="mt-2 text-2xl font-bold md:text-3xl">{title}</h2>
      {text && <p className="mt-3 max-w-3xl leading-relaxed text-muted">{text}</p>}
      <div className="mt-8">{children}</div>
    </div>
  </Reveal>
);

export default function Model() {
  const [m, setM] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    API.get("/model").then((r) => setM(r.data)).catch((e) => setError(errorMessage(e)));
  }, []);

  if (error) return <p className="px-5 pt-40 text-center text-muted">{error}</p>;
  if (!m)
    return (
      <div className="mx-auto max-w-6xl space-y-6 px-5 pt-28">
        {[1, 2, 3].map((i) => <div key={i} className="h-64 animate-pulse rounded-3xl bg-white" />)}
      </div>
    );

  const f = m.final_model, d = m.dataset, o = m.old_method;
  const cards = [
    [Target, f.roc_auc.toFixed(2), "ROC-AUC", "How well the model ranks a stroke patient above a healthy one (1.0 is perfect, 0.5 is guessing)."],
    [Scale, `${Math.round(f.recall_high * 100)}%`, "of strokes flagged", "Share of real stroke patients the app marks as 'elevated risk'."],
    [Layers, `${Math.round(f.specificity_high * 100)}%`, "of others not flagged", "Share of people without a stroke who are correctly not flagged."],
    [Copy, d.near_copies, "near-copies found", "Synthetic stroke rows detected and grouped so tests stay honest."],
  ];
  const comparison = m.comparison.map((c) => ({ ...c, name: c.model.replace(" (overfit, old style)", "*") }));
  const cm = f.confusion;

  return (
    <div className="mx-auto max-w-6xl px-5 pt-28">
      <p className="kicker">How it works</p>
      <h1 className="mt-2 max-w-3xl text-4xl font-bold md:text-5xl">An honest model, tested the right way.</h1>
      <p className="mt-4 max-w-2xl text-lg text-muted">
        NeuroCheck uses a calibrated logistic regression trained on {d.rows.toLocaleString("en-IN")} health records. Here is how it was built and tested, with every number measured on data the model never saw.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([Icon, value, label, text], i) => (
          <Reveal key={label} delay={i * 0.06}>
            <div className="card h-full p-6">
              <Icon size={20} className="text-pulse" />
              <p className="mt-4 font-display text-4xl font-bold">{value}</p>
              <p className="font-medium">{label}</p>
              <p className="mt-2 text-sm text-muted">{text}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <div className="mt-6 space-y-6">
        <Section
          kicker="1 · Why not just 'accuracy'?"
          title="A model that always says 'no stroke' would be 92% accurate."
          text="Only about 8% of the people in the data had a stroke. So accuracy hides the thing that matters: does the model find the people at risk? The first version of this project reported 84% accuracy, but it was tested on only 81 people, and the score changed a lot depending on which 81 were picked."
        >
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ["Always guessing 'no stroke'", `${Math.round(o.always_no_accuracy * 100)}%`, "accuracy, but finds zero stroke patients", "bg-paper"],
              ["Old version (81 test rows)", `${Math.round(o.accuracy_min * 100)}–${Math.round(o.accuracy_max * 100)}%`, `accuracy depending on the random split (avg ${Math.round(o.accuracy_mean * 100)}%)`, "bg-warn-soft"],
              ["NeuroCheck (all 5,140 rows)", f.roc_auc.toFixed(2), `ROC-AUC, catches ${Math.round(f.recall_high * 100)}% of strokes, stable across repeats`, "bg-calm-soft"],
            ].map(([t, v, s, bg]) => (
              <div key={t} className={`rounded-2xl p-6 ${bg}`}>
                <p className="text-sm font-medium">{t}</p>
                <p className="mt-2 font-display text-4xl font-bold">{v}</p>
                <p className="mt-1 text-sm text-muted">{s}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section
          kicker="2 · Hidden copies in the data"
          title={`${d.stroke_rows} stroke rows, but only about ${d.distinct_stroke_patients} real patients.`}
          text={`For ${Math.round(d.stroke_nn_same_label * 100)}% of stroke rows, the most similar row in the whole dataset is another stroke row, even though strokes are only 8% of the data. That pattern means synthetic copies were added. With normal testing, a model can "recognise" the copy of a patient it trained on. So we grouped near-copies and always kept a group on the same side of the train/test split. The bars show how much each model's score drops when this unfair advantage is removed.`}
        >
          <div className="space-y-5">
            {comparison.map((c, i) => {
              const x = (v) => `${Math.max(0, ((v - 0.7) / 0.25) * 100)}%`;
              const drop = c.auc_naive - c.auc_leak_safe;
              return (
                <div key={c.model} className="grid items-center gap-2 md:grid-cols-[200px_1fr_90px] md:gap-5">
                  <p className="text-sm font-medium">{c.name}</p>
                  <div className="space-y-1.5">
                    {[["auc_naive", "#CBD5E1"], ["auc_leak_safe", "#E5484D"]].map(([k, col], j) => (
                      <div key={k} className="flex items-center gap-3">
                        <div className="h-3 flex-1 rounded-full bg-paper">
                          <motion.div className="h-full rounded-full" style={{ background: col }} initial={{ width: 0 }} whileInView={{ width: x(c[k]) }} viewport={{ once: true }} transition={{ delay: i * 0.08 + j * 0.15, duration: 0.8 }} />
                        </div>
                        <span className="w-10 text-right text-xs tabular-nums text-muted">{c[k].toFixed(3)}</span>
                      </div>
                    ))}
                  </div>
                  <p className={`text-sm font-semibold md:text-right ${drop > 0.05 ? "text-pulse" : drop > 0.015 ? "text-warn" : "text-calm"}`}>
                    {drop > 0.001 ? `−${drop.toFixed(3)}` : "stable"}
                  </p>
                </div>
              );
            })}
            <div className="flex flex-wrap gap-5 pt-1 text-xs text-muted">
              <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#CBD5E1]" /> Normal testing (leaky)</span>
              <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-pulse" /> Leak-safe testing</span>
              <span>Bars start at 0.70 ROC-AUC</span>
            </div>
          </div>
          <p className="mt-3 text-sm text-muted">
            * A fully-grown random forest looks best with normal testing (0.91) but is the worst once copies are kept apart (0.79): it was memorising, not learning. Logistic regression barely changes, so it was chosen.
          </p>
        </Section>

        <div className="grid gap-6 lg:grid-cols-2">
          <Section kicker="3 · ROC curve" title="Finding strokes vs false alarms">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={m.roc} margin={{ left: -10 }}>
                  <defs>
                    <linearGradient id="roc" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#E5484D" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#E5484D" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#ECEAE4" />
                  <XAxis dataKey="fpr" type="number" domain={[0, 1]} tick={{ fontSize: 11 }} label={{ value: "False alarm rate", position: "insideBottom", offset: -2, fontSize: 11 }} />
                  <YAxis domain={[0, 1]} tick={{ fontSize: 11 }} />
                  <Tooltip {...tip} formatter={(v) => `${Math.round(v * 100)}%`} labelFormatter={(l) => `False alarms ${Math.round(l * 100)}%`} />
                  <Area type="monotone" dataKey="tpr" name="Strokes found" stroke="#E5484D" strokeWidth={2.5} fill="url(#roc)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Section>

          <Section kicker="4 · Calibration" title="Does '6%' really mean 6%?">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={m.calibration.map((c, i) => ({ ...c, group: `Group ${i + 1}` }))} margin={{ left: -10 }}>
                  <CartesianGrid vertical={false} stroke="#ECEAE4" />
                  <XAxis dataKey="group" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip {...tip} formatter={(v) => `${v}%`} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="observed" name="Real stroke rate" fill="#101418" radius={[6, 6, 0, 0]} />
                  <Line dataKey="predicted" name="Model's prediction" stroke="#E5484D" strokeWidth={2.5} dot={{ r: 4 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 text-sm text-muted">People were split into 5 groups by predicted risk. The predictions match the real stroke rates closely, so the percentages on the result page can be trusted.</p>
          </Section>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Section kicker="5 · What matters most" title="Influence of each question">
            <div className="space-y-3">
              {m.importance.map((r, i) => (
                <div key={r.feature}>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{r.label}</span>
                    <span className="text-muted">{Math.round((r.weight / m.importance[0].weight) * 100)}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-paper">
                    <div className="h-full rounded-full bg-ink" style={{ width: `${(r.weight / m.importance[0].weight) * 100}%`, opacity: 1 - i * 0.06 }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-muted">Relative influence, with age set to 100. Age matters far more than anything else, which matches medical research.</p>
          </Section>

          <Section kicker="6 · In plain numbers" title={`Out of ${cm.tp + cm.fn} real stroke patients…`}>
            <div className="grid grid-cols-2 gap-3 text-center">
              {[
                [cm.tp, "flagged as elevated risk", "bg-calm-soft text-calm"],
                [cm.fn, "missed (marked lower risk)", "bg-pulse-soft text-pulse"],
                [cm.tn.toLocaleString("en-IN"), "people without stroke, correctly not flagged", "bg-paper"],
                [cm.fp.toLocaleString("en-IN"), "people without stroke, flagged anyway", "bg-warn-soft text-warn"],
              ].map(([v, t, cls]) => (
                <div key={t} className={`rounded-2xl p-5 ${cls}`}>
                  <p className="font-display text-3xl font-bold">{v}</p>
                  <p className="mt-1 text-xs text-muted">{t}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-muted">
              For a screening tool, missing a real case is worse than a false alarm, so the "elevated" line is set to catch about 80% of strokes. Real patients are counted once each (copies merged).
            </p>
          </Section>
        </div>

        <Section kicker="7 · The pipeline" title="From raw CSV to live API">
          <div className="grid gap-4 md:grid-cols-4">
            {[
              [Database, "Data", "5,140 records, 10 questions. Missing BMI filled with the median. Categories one-hot encoded."],
              [GitBranch, "Leak-safe testing", "Near-copies grouped with a radius-neighbours graph. 5-fold StratifiedGroupKFold, repeated 3 times."],
              [Scale, "Calibrated model", "Logistic regression. Copies weighted as one patient, so probabilities are real risks (checked with a calibration test)."],
              [Target, "Explanations", "Each answer's exact effect, in percentage points. What-if changes are recalculated live by the Flask API."],
            ].map(([Icon, t, s], i) => (
              <div key={t} className="relative rounded-2xl bg-paper p-5">
                <span className="font-display text-xs font-bold text-muted">STEP {i + 1}</span>
                <Icon size={20} className="mt-3 text-pulse" />
                <p className="mt-3 font-semibold">{t}</p>
                <p className="mt-1 text-sm text-muted">{s}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-2 text-xs">
            {["Python", "scikit-learn", "pandas", "Flask", "SQLAlchemy", "JWT", "React", "Vite", "Tailwind CSS", "Framer Motion", "Recharts"].map((t) => (
              <span key={t} className="chip bg-paper text-ink ring-1 ring-line">{t}</span>
            ))}
          </div>
        </Section>
      </div>

      <div className="mt-10 text-center">
        <Link to="/assess" className="btn-primary px-8 py-4 text-base">
          Try the assessment <ArrowRight size={18} />
        </Link>
      </div>
    </div>
  );
}
