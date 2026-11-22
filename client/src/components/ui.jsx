import { motion } from "framer-motion";

export const Reveal = ({ children, delay = 0, className = "" }) => (
  <motion.div
    className={className}
    initial={{ opacity: 0, y: 24 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-60px" }}
    transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
  >
    {children}
  </motion.div>
);

// Pill buttons for choosing one option
export function Segmented({ value, onChange, options, name }) {
  return (
    <div role="radiogroup" aria-label={name} className="flex flex-wrap gap-2">
      {options.map(([v, label, icon]) => {
        const active = value === v;
        return (
          <button
            type="button"
            role="radio"
            aria-checked={active}
            key={String(v)}
            onClick={() => onChange(v)}
            className={`relative flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition ${
              active ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink/40"
            }`}
          >
            {icon}
            {label}
          </button>
        );
      })}
    </div>
  );
}

// Yes / No question with a short explanation
export function YesNo({ label, hint, value, onChange }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-medium">{label}</p>
        {hint && <p className="mt-0.5 text-sm text-muted">{hint}</p>}
      </div>
      <Segmented value={value} onChange={onChange} options={[[0, "No"], [1, "Yes"]]} name={label} />
    </div>
  );
}

export const Spinner = ({ className = "" }) => (
  <span className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} />
);
