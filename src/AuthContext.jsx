import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext(null);

// Helper to parse responses safely and handle non-JSON or proxy errors
async function handleResponse(res) {
  const contentType = res.headers.get("content-type");
  let data = null;
  
  if (contentType && contentType.includes("application/json")) {
    try {
      data = await res.json();
    } catch (err) {
      throw new Error("Unable to parse server response.");
    }
  } else {
    // Read non-JSON error pages (like Vite proxy gateway timeout HTML)
    const text = await res.text();
    if (res.status === 504 || res.status === 502 || res.status === 404) {
      throw new Error("Backend server is offline. Please start the server by running 'npm run dev:all' or double-clicking 'start.bat'.");
    }
    throw new Error(text || `Server returned error status ${res.status}`);
  }
  
  if (!res.ok) {
    throw new Error(data?.message || `Request failed with status ${res.status}`);
  }
  
  return data;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading, null = logged out
  const [authLoading, setAuthLoading] = useState(true);

  const fetchUser = async (token) => {
    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await handleResponse(res);
      setUser({ uid: data.id, email: data.email, token });
    } catch (err) {
      console.error("Auth verify error:", err);
      localStorage.removeItem("token");
      setUser(null);
    } finally {
      setAuthLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      fetchUser(token);
    } else {
      setUser(null);
      setAuthLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await handleResponse(res);
      localStorage.setItem("token", data.token);
      setUser({ uid: data.user.id, email: data.user.email, token: data.token });
    } catch (err) {
      if (err.message === "Failed to fetch") {
        throw new Error("Cannot connect to server. Please verify you launched the backend server.");
      }
      throw err;
    }
  };

  const signup = async (email, password) => {
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await handleResponse(res);
      localStorage.setItem("token", data.token);
      setUser({ uid: data.user.id, email: data.user.email, token: data.token });
    } catch (err) {
      if (err.message === "Failed to fetch") {
        throw new Error("Cannot connect to server. Please verify you launched the backend server.");
      }
      throw err;
    }
  };

  const loginWithGoogle = async (googleAccessToken) => {
    try {
      const res = await fetch("/api/auth/google-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: googleAccessToken }),
      });
      const data = await handleResponse(res);
      localStorage.setItem("token", data.token);
      setUser({ uid: data.user.id, email: data.user.email, token: data.token });
    } catch (err) {
      if (err.message === "Failed to fetch") {
        throw new Error("Cannot connect to server. Please verify you launched the backend server.");
      }
      throw err;
    }
  };

  const signOut = async () => {
    localStorage.removeItem("token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, authLoading, login, signup, loginWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
