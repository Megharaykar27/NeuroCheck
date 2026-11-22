import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowRight, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import API, { errorMessage } from "../lib/api";
import { LEVELS, pct, saveLastResult } from "../lib/risk";

const date = (d, time = false) =>
  new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", ...(time ? { hour: "numeric", minute: "2-digit" } : {}) });

export default function History() {
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [opening, setOpening] = useState(null);

  useEffect(() => {
    API.get("/history").then((r) => setItems(r.data)).catch((e) => toast.error(errorMessage(e)));
  }, []);

  const remove = async (id) => {
    if (!window.confirm("Delete this result?")) return;
    await API.delete(`/history/${id}`);
    setItems((x) => x.filter((i) => i.id !== id));
    toast.success("Deleted");
  };

  // Re-run a saved assessment to see its full explanation again
  const open = async (item) => {
    setOpening(item.id);
    try {
      const { data } = await API.post("/predict", item.inputs);
      const full = { ...data, saved_id: item.id };
      saveLastResult(full);
      navigate("/result", { state: full });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setOpening(null);
    }
  };

  if (!items) return <div className="mx-auto mt-28 h-80 max-w-5xl animate-pulse rounded-3xl bg-white" />;

  const chart = [...items].reverse().map((i) => ({ date: date(i.created_at), risk: +(i.risk * 100).toFixed(2) }));

  return (
    <div className="mx-auto max-w-5xl px-5 pt-28">
      <p className="kicker">My history</p>
      <h1 className="mt-2 text-4xl font-bold md:text-5xl">Your results over time</h1>

      {items.length === 0 ? (
        <div className="card mt-10 p-12 text-center">
          <p className="text-lg font-semibold">No saved results yet</p>
          <p className="mt-2 text-muted">Take the assessment while logged in and your results will appear here.</p>
          <Link to="/assess" className="btn-primary mt-6">
            Start assessment <ArrowRight size={16} />
          </Link>
        </div>
      ) : (
        <>
          {items.length > 1 && (
            <div className="card mt-10 p-8">
              <p className="font-semibold">Estimated risk trend</p>
              <div className="mt-6 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chart} margin={{ left: -15, right: 10 }}>
                    <CartesianGrid stroke="#ECEAE4" vertical={false} />
                    <ReferenceArea y1={0} y2={2.05} fill="#0F8A7E" fillOpacity={0.05} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} unit="%" />
                    <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} formatter={(v) => [`${v}%`, "Risk"]} />
                    <Line type="monotone" dataKey="risk" stroke="#E5484D" strokeWidth={3} dot={{ r: 5, fill: "#E5484D" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="mt-6 space-y-3">
            {items.map((i) => {
              const L = LEVELS[i.level];
              return (
                <div key={i.id} className="card flex flex-wrap items-center gap-5 p-5">
                  <p className="w-24 font-display text-3xl font-bold" style={{ color: L.color }}>
                    {pct(i.risk)}
                  </p>
                  <div className="flex-1">
                    <span className={`chip ${L.soft}`}>{L.label}</span>
                    <p className="mt-1 text-sm text-muted">
                      {date(i.created_at, true)} · Age {i.inputs.age} · Glucose {i.inputs.avg_glucose_level} · BMI {i.inputs.bmi ?? "unknown"}
                    </p>
                  </div>
                  <button onClick={() => open(i)} disabled={opening === i.id} className="btn-ghost py-2">
                    {opening === i.id ? "Opening…" : "View details"}
                  </button>
                  <button onClick={() => remove(i.id)} className="p-2 text-muted hover:text-pulse" aria-label="Delete">
                    <Trash2 size={18} />
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
