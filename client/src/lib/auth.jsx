import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("nc_user"));
    } catch {
      return null;
    }
  });

  const login = (u, token) => {
    localStorage.setItem("nc_token", token);
    localStorage.setItem("nc_user", JSON.stringify(u));
    setUser(u);
  };
  const logout = () => {
    localStorage.removeItem("nc_token");
    localStorage.removeItem("nc_user");
    setUser(null);
  };

  useEffect(() => {
    const onLogout = () => setUser(null);
    window.addEventListener("nc:logout", onLogout);
    return () => window.removeEventListener("nc:logout", onLogout);
  }, []);

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
