import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, ClipboardList, Cpu, LineChart, ShieldCheck, Smile, Hand, MessageSquare, PhoneCall } from "lucide-react";
import API from "../lib/api";
import NeuralCanvas from "../components/NeuralCanvas";
import { Reveal } from "../components/ui";

// Shown until the API answers, so the page never looks empty
const FALLBACK = {
  dataset: { rows: 5140, stroke_rows: 407, distinct_stroke_patients: 246, near_copies: 161 },
  final_model: { roc_auc: 0.84, recall_high: 0.8 },
};

function CountUp({ to, decimals = 0, suffix = "" }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf, start;
    const step = (t) => {
      start ??= t;
      const k = Math.min(1, (t - start) / 1200);
      setV(to * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return (
    <>
      {v.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </>
  );
}

export default function Home() {
  const [m, setM] = useState(FALLBACK);
  useEffect(() => {
    API.get("/model").then((r) => setM(r.data)).catch(() => {});
  }, []);

  const stats = [
    [<CountUp key="a" to={m.dataset.rows} />, "health records analysed"],
    [<CountUp key="b" to={m.final_model.roc_auc} decimals={2} />, "ROC-AUC on leak-safe tests"],
    [<CountUp key="c" to={m.final_model.recall_high * 100} suffix="%" />, "of strokes flagged as elevated risk"],
    [<CountUp key="d" to={10} />, "simple questions, about 2 minutes"],
  ];

  return (
    <div>
      {/* ---------------- HERO ---------------- */}
      <section className="relative overflow-hidden bg-night text-white">
        <div className="absolute inset-0">
          <NeuralCanvas />
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_40%,rgba(229,72,77,0.18),transparent_55%)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-24 pt-32 md:grid-cols-[1.15fr_1fr] md:pb-32 md:pt-40">
          <div>
            <motion.span initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="chip bg-white/10 text-white/80 ring-1 ring-white/15">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-pulse" /> Explainable machine learning
            </motion.span>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.7 }}
              className="mt-6 text-5xl font-bold leading-[1.02] sm:text-6xl lg:text-7xl"
            >
              Know your
              <br />
              <span className="text-pulse">stroke risk</span>
              <br />
              in two minutes.
            </motion.h1>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }} className="mt-6 max-w-lg text-lg leading-relaxed text-white/70">
              Answer 10 everyday questions. NeuroCheck estimates your risk, shows exactly which answers raise or lower it, and lets you see how healthy changes would move the number.
            </motion.p>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-10 flex flex-wrap gap-3">
              <Link to="/assess" className="btn-primary px-7 py-3.5 text-base">
                Check my risk <ArrowRight size={18} />
              </Link>
              <Link to="/model" className="btn-ghost-dark px-7 py-3.5 text-base">
                How the model works
              </Link>
            </motion.div>
          </div>

          {/* Floating sample result card */}
          <motion.div
            initial={{ opacity: 0, y: 30, rotate: 2 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="relative hidden md:block"
          >
            <motion.div animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }} className="rounded-3xl border border-white/10 bg-white/[0.06] p-7 backdrop-blur-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">Sample result</p>
              <div className="mt-4 flex items-end justify-between">
                <p className="font-display text-6xl font-bold text-warn">3.8%</p>
                <span className="chip bg-warn/15 text-warn">Moderate risk</span>
              </div>
              <p className="mt-2 text-sm text-white/60">About 4 in 100 people with these answers had a stroke.</p>
              <div className="mt-6 space-y-3">
                {[
                  ["Age 58", 62, "#E5484D"],
                  ["Blood sugar 152 mg/dL", 38, "#E5484D"],
                  ["Never smoked", 18, "#0F8A7E"],
                ].map(([label, w, c], i) => (
                  <div key={label}>
                    <div className="flex justify-between text-xs text-white/60">
                      <span>{label}</span>
                      <span style={{ color: c }}>{c === "#0F8A7E" ? "lowers" : "raises"}</span>
                    </div>
                    <div className="mt-1.5 h-2 rounded-full bg-white/10">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${w}%` }} transition={{ delay: 0.9 + i * 0.2, duration: 0.9 }} className="h-full rounded-full" style={{ background: c }} />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ---------------- STATS ---------------- */}
      <section className="relative z-10 mx-auto -mt-12 max-w-6xl px-5">
        <div className="card grid grid-cols-2 divide-line md:grid-cols-4 md:divide-x">
          {stats.map(([value, label], i) => (
            <div key={i} className={`p-6 md:p-8 ${i < 2 ? "border-b border-line md:border-b-0" : ""} ${i % 2 === 0 ? "border-r border-line md:border-r-0" : ""}`}>
              <p className="font-display text-3xl font-bold md:text-4xl">{value}</p>
              <p className="mt-1 text-sm text-muted">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- HOW IT WORKS ---------------- */}
      <section className="mx-auto max-w-6xl px-5 py-24">
        <Reveal>
          <p className="kicker">How it works</p>
          <h2 className="mt-3 max-w-xl text-4xl font-bold md:text-5xl">From answers to a clear, explained result.</h2>
        </Reveal>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {[
            [ClipboardList, "Answer 10 questions", "Age, blood pressure, heart health, blood sugar, BMI and lifestyle. Each question explains why it's asked."],
            [Cpu, "The model scores your risk", "A calibrated model trained on 5,000+ health records turns your answers into a real probability, not a scary yes/no."],
            [LineChart, "See what drives it", "Find out which answers raise or lower your risk, and test what would change if you lowered your blood sugar or weight."],
          ].map(([Icon, title, text], i) => (
            <Reveal key={title} delay={i * 0.1}>
              <div className="card h-full p-7">
                <div className="flex items-center justify-between">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-pulse-soft text-pulse">
                    <Icon size={22} />
                  </span>
                  <span className="font-display text-5xl font-bold text-line">0{i + 1}</span>
                </div>
                <h3 className="mt-6 text-xl font-semibold">{title}</h3>
                <p className="mt-2 leading-relaxed text-muted">{text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------------- HONEST ML ---------------- */}
      <section className="mx-auto max-w-6xl px-5">
        <div className="overflow-hidden rounded-[2rem] bg-night text-white">
          <div className="grid gap-10 p-8 md:grid-cols-2 md:p-14">
            <Reveal>
              <span className="chip bg-calm/20 text-[#5FD3C6]">
                <ShieldCheck size={14} /> Built honestly
              </span>
              <h2 className="mt-5 text-4xl font-bold leading-tight">We found hidden copies in the data, and removed their unfair advantage.</h2>
              <p className="mt-5 leading-relaxed text-white/65">
                The dataset has {m.dataset.stroke_rows} stroke cases, but many are near-identical copies. They really come from about {m.dataset.distinct_stroke_patients} real patients. Normal testing lets the model "remember" a copy it saw in training, which makes scores look better than they are.
                NeuroCheck keeps copies together when testing, so every number on this site is honest.
              </p>
              <Link to="/model" className="mt-8 inline-flex items-center gap-2 font-semibold text-[#FF8F93] hover:text-white">
                See the full analysis <ArrowRight size={16} />
              </Link>
            </Reveal>
            <Reveal delay={0.15} className="flex flex-col justify-center gap-4">
              {[
                ["Stroke rows in the dataset", m.dataset.stroke_rows, 100, "#94AAC8"],
                ["Real patients behind them", m.dataset.distinct_stroke_patients, (m.dataset.distinct_stroke_patients / m.dataset.stroke_rows) * 100, "#5FD3C6"],
                ["Near-copies found", m.dataset.near_copies, (m.dataset.near_copies / m.dataset.stroke_rows) * 100, "#E5484D"],
              ].map(([label, value, w, c], i) => (
                <div key={label}>
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-white/65">{label}</span>
                    <span className="font-display text-2xl font-bold">{value}</span>
                  </div>
                  <div className="mt-2 h-3 rounded-full bg-white/10">
                    <motion.div initial={{ width: 0 }} whileInView={{ width: `${w}%` }} viewport={{ once: true }} transition={{ delay: 0.2 + i * 0.2, duration: 1 }} className="h-full rounded-full" style={{ background: c }} />
                  </div>
                </div>
              ))}
            </Reveal>
          </div>
        </div>
      </section>

      {/* ---------------- FAST ---------------- */}
      <section className="mx-auto max-w-6xl px-5 py-24">
        <Reveal>
          <p className="kicker">Know the warning signs</p>
          <h2 className="mt-3 text-4xl font-bold md:text-5xl">
            Think <span className="text-pulse">F.A.S.T.</span>
          </h2>
          <p className="mt-3 max-w-xl text-muted">A stroke is an emergency. If you see these signs, don't wait for a risk score: get help immediately.</p>
        </Reveal>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["F", "Face", "One side of the face droops when smiling.", Smile],
            ["A", "Arms", "One arm drifts down when both are raised.", Hand],
            ["S", "Speech", "Words are slurred or strange.", MessageSquare],
            ["T", "Time", "Call 108 right away. Every minute counts.", PhoneCall],
          ].map(([letter, title, text, Icon], i) => (
            <Reveal key={letter} delay={i * 0.08}>
              <div className={`card h-full p-6 ${letter === "T" ? "border-pulse bg-pulse text-white" : ""}`}>
                <div className="flex items-center justify-between">
                  <span className="font-display text-5xl font-bold">{letter}</span>
                  <Icon size={24} className={letter === "T" ? "text-white" : "text-pulse"} />
                </div>
                <p className="mt-4 font-semibold">{title}</p>
                <p className={`mt-1 text-sm ${letter === "T" ? "text-white/85" : "text-muted"}`}>{text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------------- CTA ---------------- */}
      <section className="mx-auto max-w-6xl px-5">
        <Reveal>
          <div className="card flex flex-col items-start justify-between gap-6 p-10 md:flex-row md:items-center">
            <div>
              <h2 className="text-3xl font-bold">Ready? It takes about two minutes.</h2>
              <p className="mt-2 text-muted">No sign-up needed. Create an account only if you want to track your results over time.</p>
            </div>
            <Link to="/assess" className="btn-primary shrink-0 px-8 py-4 text-base">
              Start the assessment <ArrowRight size={18} />
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
