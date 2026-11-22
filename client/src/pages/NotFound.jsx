import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-5 pt-40 text-center">
      <p className="font-display text-8xl font-bold text-pulse">404</p>
      <h1 className="mt-4 text-3xl font-bold">Page not found</h1>
      <p className="mt-2 text-muted">The page you're looking for doesn't exist.</p>
      <Link to="/" className="btn-dark mt-8">Back home</Link>
    </div>
  );
}
