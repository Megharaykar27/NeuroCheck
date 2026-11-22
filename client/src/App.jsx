import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Toaster } from "react-hot-toast";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import { useAuth } from "./lib/auth";

const Assess = lazy(() => import("./pages/Assess"));
const Result = lazy(() => import("./pages/Result"));
const Model = lazy(() => import("./pages/Model"));
const History = lazy(() => import("./pages/History"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const NotFound = lazy(() => import("./pages/NotFound"));

function Private({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  return user ? children : <Navigate to="/login" state={{ from: location.pathname }} replace />;
}

const Page = ({ children }) => (
  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
    {children}
  </motion.div>
);

export default function App() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const p = (el) => <Page>{el}</Page>;

  return (
    <div className="flex min-h-screen flex-col">
      <Toaster position="bottom-center" toastOptions={{ style: { borderRadius: 999, background: "#101418", color: "#fff", fontSize: 14 } }} />
      <Navbar />
      <main className="flex-1">
        <Suspense fallback={<div className="py-40 text-center text-muted">Loading…</div>}>
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={p(<Home />)} />
              <Route path="/assess" element={p(<Assess />)} />
              <Route path="/result" element={p(<Result />)} />
              <Route path="/model" element={p(<Model />)} />
              <Route path="/history" element={p(<Private><History /></Private>)} />
              <Route path="/login" element={p(<Login />)} />
              <Route path="/register" element={p(<Register />)} />
              <Route path="*" element={p(<NotFound />)} />
            </Routes>
          </AnimatePresence>
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
