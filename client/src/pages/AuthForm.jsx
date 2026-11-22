// Shared login / register form
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Activity } from "lucide-react";
import API, { errorMessage } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Spinner } from "../components/ui";

export default function AuthForm({ mode }) {
  const register = mode === "register";
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await API.post(register ? "/auth/register" : "/auth/login", form);
      login(data.user, data.token);
      toast.success(register ? `Welcome, ${data.user.name.split(" ")[0]}!` : "Welcome back!");
      navigate(location.state?.from || "/history", { replace: true });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const f = (k) => ({ value: form[k], onChange: (e) => setForm({ ...form, [k]: e.target.value }) });

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-5 pt-24">
      <div className="card p-8">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-pulse text-white">
          <Activity size={22} />
        </span>
        <h1 className="mt-6 text-3xl font-bold">{register ? "Create your account" : "Welcome back"}</h1>
        <p className="mt-2 text-sm text-muted">{register ? "Save your results and track how your risk changes over time." : "Log in to see your saved results."}</p>
        <form onSubmit={submit} className="mt-8 space-y-4">
          {register && (
            <div>
              <label className="label" htmlFor="name">Name</label>
              <input id="name" className="input" required autoComplete="name" {...f("name")} />
            </div>
          )}
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" className="input" required autoComplete="email" {...f("email")} />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" type="password" className="input" required minLength={6} autoComplete={register ? "new-password" : "current-password"} {...f("password")} />
          </div>
          <button disabled={loading} className="btn-primary w-full py-3.5">
            {loading && <Spinner />} {register ? "Create account" : "Log in"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-muted">
          {register ? "Already have an account? " : "New here? "}
          <Link to={register ? "/login" : "/register"} state={location.state} className="font-semibold text-ink underline underline-offset-4">
            {register ? "Log in" : "Create an account"}
          </Link>
        </p>
      </div>
      <p className="mt-4 text-center text-xs text-muted">Passwords are stored securely hashed. You don't need an account to use the assessment.</p>
    </div>
  );
}
