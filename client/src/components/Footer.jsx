import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 md:grid-cols-3">
        <div>
          <p className="font-display text-lg font-bold">NeuroCheck</p>
          <p className="mt-2 max-w-xs text-sm text-muted">An explainable machine-learning project that estimates stroke risk from 10 everyday questions.</p>
        </div>
        <div className="text-sm text-muted">
          <p className="font-semibold text-ink">Important</p>
          <p className="mt-2">
            This is an educational screening tool, not a diagnosis. Always talk to a doctor about your health. In an emergency in India, call <b className="text-ink">108</b>.
          </p>
        </div>
        <div className="flex flex-col gap-2 text-sm text-muted md:items-end">
          <Link to="/assess" className="hover:text-ink">Check my risk</Link>
          <Link to="/model" className="hover:text-ink">How the model works</Link>
          <p className="mt-4 text-xs">Built by Megha Raykar · {new Date().getFullYear()}</p>
        </div>
      </div>
    </footer>
  );
}
