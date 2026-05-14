"use client";

import { useState, useActionState } from "react";
import { identifyUserAction, loginAction, signupAction } from "./actions";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [step, setStep] = useState<"identify" | "login" | "signup" | "loading">("identify");
  const [email, setEmail] = useState("");
  const [loginState, loginFormAction, isLoginPending] = useActionState(loginAction, {});
  const [signupState, signupFormAction, isSignupPending] = useActionState(signupAction, {});

  async function handleIdentify(e: React.FormEvent) {
    e.preventDefault();
    setStep("loading"); // Added loading state
    const { exists } = await identifyUserAction(email);
    setStep(exists ? "login" : "signup");
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-6">
      {step === "loading" && <div className="w-full max-w-sm h-48 bg-card rounded-2xl border animate-pulse" />}
      
      {step === "identify" && (
        <form onSubmit={handleIdentify} className="w-full max-w-sm p-6 bg-card rounded-2xl border">
          <h1 className="text-2xl font-bold mb-4">Welcome</h1>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required className="w-full h-12 px-4 mb-4 rounded-xl border" />
          <button type="submit" className="w-full h-12 bg-accent text-white rounded-xl">Continue</button>
        </form>
      )}


      {step === "login" && (
        <form action={loginFormAction} className="w-full max-w-sm p-6 bg-card rounded-2xl border">
          <h1 className="text-2xl font-bold mb-4">Welcome Back</h1>
          <input type="hidden" name="email" value={email} />
          <input type="password" name="password" placeholder="Password" required className="w-full h-12 px-4 mb-4 rounded-xl border" />
          <button type="submit" className="w-full h-12 bg-accent text-white rounded-xl">Login</button>
          {loginState.error && <p className="text-debt mt-2">{loginState.error}</p>}
        </form>
      )}

      {step === "signup" && (
        <form action={signupFormAction} className="w-full max-w-sm p-6 bg-card rounded-2xl border">
          <h1 className="text-2xl font-bold mb-4">Let's get you set up</h1>
          <input type="hidden" name="email" value={email} />
          <input type="text" name="name" placeholder="Name" required className="w-full h-12 px-4 mb-4 rounded-xl border" />
          <input type="tel" name="phoneNumber" placeholder="Phone" required className="w-full h-12 px-4 mb-4 rounded-xl border" />
          <input type="password" name="password" placeholder="Create Password" required className="w-full h-12 px-4 mb-4 rounded-xl border" />
          <button type="submit" className="w-full h-12 bg-accent text-white rounded-xl">Sign Up</button>
          {signupState.error && <p className="text-debt mt-2">{signupState.error}</p>}
        </form>
      )}
    </div>
  );
}
