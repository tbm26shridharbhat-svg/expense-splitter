"use server";

import { z } from "zod";
import { connectDB, User } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/session";
import { redirect } from "next/navigation";

const IdentifySchema = z.object({
  email: z.string().email(),
});

export async function identifyUserAction(email: string): Promise<{ exists: boolean }> {
  await connectDB();
  const user = await User.findOne({ email });
  return { exists: !!user };
}

const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  phoneNumber: z.string().min(10),
});

export async function signupAction(prevState: any, formData: FormData): Promise<{ error?: string }> {
  const parsed = SignupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid data." };

  await connectDB();
  const passwordHash = await hashPassword(parsed.data.password);
  const user = await User.create({ ...parsed.data, passwordHash });
  
  await setSessionCookie({ userId: user._id.toString(), email: user.email });
  redirect("/groups");
}

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function loginAction(prevState: any, formData: FormData): Promise<{ error?: string }> {
  const parsed = LoginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid data." };

  await connectDB();
  const user = await User.findOne({ email: parsed.data.email });
  if (!user || !user.passwordHash || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return { error: "Invalid credentials." };
  }
  
  await setSessionCookie({ userId: user._id.toString(), email: user.email });
  redirect("/groups");
}
