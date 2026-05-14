"use server";

import { z } from "zod";
import { connectDB, User } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/session";
import { redirect } from "next/navigation";

const Schema = z.object({
  email: z.string().email("Enter a valid email."),
  password: z.string().min(6, "Password must be at least 6 characters."),
  next: z.string().optional(),
});

export async function authAction(
  prevState: any,
  formData: FormData,
): Promise<{ error?: string }> {
  const rawEmail = formData.get("email") as string;
  const rawPassword = formData.get("password") as string;
  const next = formData.get("next") as string || "/groups";

  const parsed = Schema.safeParse({ email: rawEmail, password: rawPassword, next });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { email, password } = parsed.data;

  try {
    await connectDB();
    
    let user = await User.findOne({ email });

    if (user) {
      // Login attempt
      if (!user.passwordHash) {
        // Handle legacy users who used magic links
        // For simplicity, let's set their password now
        user.passwordHash = await hashPassword(password);
        await user.save();
      } else {
        const isValid = await verifyPassword(password, user.passwordHash);
        if (!isValid) {
          return { error: "Invalid email or password." };
        }
      }
    } else {
      // Signup
      const passwordHash = await hashPassword(password);
      user = await User.create({
        email,
        passwordHash,
        name: email.split("@")[0], // Default name from email
      });
    }

    await setSessionCookie({
      userId: user._id.toString(),
      email: user.email,
    });
  } catch (err) {
    console.error("[auth] action failed:", err);
    return { error: "Something went wrong. Please try again." };
  }

  redirect(next);
}
