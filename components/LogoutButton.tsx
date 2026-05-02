"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";

export function LogoutButton({ className = "secondary-button" }: { className?: string }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function handleLogout() {
    setIsPending(true);

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });

      if (!response.ok) {
        throw new Error("Logout failed.");
      }

      toast.success("Signed out successfully.");
      router.replace("/");
      router.refresh();
    } catch {
      toast.error("Unable to sign out. Please try again.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <button className={className} type="button" onClick={handleLogout} disabled={isPending}>
      {isPending ? "Signing out..." : "Logout"}
    </button>
  );
}
