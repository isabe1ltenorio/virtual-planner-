import { useState, type ReactNode } from "react";
import type { User } from "../types/domain";
import { AuthContext } from "./AuthContextInstance";

export function AuthProvider({ children }: { children: ReactNode }) {
  // Hidrata o usuário a partir do localStorage já no estado inicial, evitando
  // setState síncrono dentro de um efeito.
  const [user, setUser] = useState<User | null>(() => {
    const storedUser = localStorage.getItem("@VirtualPlanner:user");
    return storedUser ? JSON.parse(storedUser) : null;
  });

  const login = (email: string) => {
    // Simulação de login/cadastro simples mantendo no localStorage
    const newUser = { id: Date.now(), name: email.split("@")[0], email };
    setUser(newUser);
    localStorage.setItem("@VirtualPlanner:user", JSON.stringify(newUser));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("@VirtualPlanner:user");
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
