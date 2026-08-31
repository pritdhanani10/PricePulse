"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Activity, AlertCircle, ArrowRight, Lock, Mail, User } from "lucide-react";
import { api } from "../../services/api";
import { useAuth } from "../../context/AuthContext";

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await api.register({ name, email, password });
      login(res.access_token, res.user);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[75vh] items-center justify-center p-2 sm:p-0">
      <div className="w-full max-w-md rounded-2xl border border-surface-border bg-surface p-5 sm:p-8 shadow-2xl">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-950 border border-cyan-800 text-cyan-400 mb-3">
            <Activity className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-black text-white">Create Trader Account</h1>
          <p className="text-xs text-gray-400 mt-1">Get real-time market alerts on NIFTY and NSE stocks</p>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 p-3 rounded-xl bg-red-950/80 border border-red-800 text-red-200 text-xs">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">Full Name</label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Pritam Trader"
                className="w-full rounded-xl bg-surface-light border border-surface-border pl-10 pr-4 py-2.5 text-xs text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none font-sans"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="trader@example.com"
                className="w-full rounded-xl bg-surface-light border border-surface-border pl-10 pr-4 py-2.5 text-xs text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none font-sans"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl bg-surface-light border border-surface-border pl-10 pr-4 py-2.5 text-xs text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none font-sans"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 flex items-center justify-center gap-2 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-cyan-600/30 transition-all hover:scale-[1.01]"
          >
            {loading ? "Creating Account..." : "Complete Registration"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-gray-400">
          Already have an account?{" "}
          <Link href="/login" className="text-cyan-400 font-bold hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
