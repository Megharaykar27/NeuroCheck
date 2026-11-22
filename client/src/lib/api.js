import axios from "axios";

// Local: Flask runs on port 5001. In production set VITE_API_URL.
const API = axios.create({ baseURL: import.meta.env.VITE_API_URL || "http://localhost:5001/api" });

API.interceptors.request.use((config) => {
  const token = localStorage.getItem("nc_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

API.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && localStorage.getItem("nc_token")) {
      localStorage.removeItem("nc_token");
      localStorage.removeItem("nc_user");
      window.dispatchEvent(new Event("nc:logout"));
    }
    return Promise.reject(err);
  }
);

export const errorMessage = (err) =>
  err?.response?.data?.message || (err?.request ? "Can't reach the server. Is the Flask API running?" : "Something went wrong.");

export default API;
