import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Activity, Menu, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "../lib/auth";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const dark = pathname === "/" && !scrolled;

  useEffect(() => {
    const f = () => setScrolled(window.scrollY > 40);
    f();
    window.addEventListener("scroll", f);
    return () => window.removeEventListener("scroll", f);
  }, []);
  useEffect(() => setOpen(false), [pathname]);

  const links = [
    ["/assess", "Check my risk"],
    ["/model", "How it works"],
    ...(user ? [["/history", "My history"]] : []),
  ];
  const linkCls = ({ isActive }) =>
    `rounded-full px-4 py-2 text-sm font-medium transition ${
      dark ? (isActive ? "bg-white/10 text-white" : "text-white/70 hover:text-white") : isActive ? "bg-ink/5 text-ink" : "text-muted hover:text-ink"
    }`;

  return (
    <nav className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${dark ? "bg-transparent" : "border-b border-line bg-paper/85 backdrop-blur-md"}`}>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link to="/" className={`flex items-center gap-2 font-display text-lg font-bold ${dark ? "text-white" : "text-ink"}`}>
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-pulse text-white">
            <Activity size={18} strokeWidth={2.5} />
          </span>
          NeuroCheck
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {links.map(([to, label]) => (
            <NavLink key={to} to={to} className={linkCls}>
              {label}
            </NavLink>
          ))}
          {user ? (
            <button
              onClick={() => {
                logout();
                navigate("/");
              }}
              className={`ml-2 text-sm font-medium ${dark ? "text-white/70 hover:text-white" : "text-muted hover:text-ink"}`}
            >
              Log out ({user.name.split(" ")[0]})
            </button>
          ) : (
            <Link to="/login" className={`ml-2 ${dark ? "btn-ghost-dark" : "btn-ghost"} px-5 py-2`}>
              Log in
            </Link>
          )}
        </div>

        <button className={`md:hidden ${dark ? "text-white" : ""}`} onClick={() => setOpen((o) => !o)} aria-label="Menu">
          {open ? <X /> : <Menu />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden border-t border-line bg-paper md:hidden">
            <div className="flex flex-col gap-1 p-4">
              {links.map(([to, label]) => (
                <NavLink key={to} to={to} className="rounded-xl px-4 py-3 font-medium hover:bg-ink/5">
                  {label}
                </NavLink>
              ))}
              {user ? (
                <button onClick={logout} className="rounded-xl px-4 py-3 text-left font-medium hover:bg-ink/5">
                  Log out
                </button>
              ) : (
                <Link to="/login" className="rounded-xl px-4 py-3 font-medium hover:bg-ink/5">
                  Log in
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
