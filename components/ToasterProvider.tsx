"use client";

import { Toaster } from "react-hot-toast";

export function ToasterProvider() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 3500,
        style: {
          border: "1px solid #dfe7e1",
          borderRadius: "14px",
          color: "#17231b",
          boxShadow: "0 18px 44px rgba(23, 35, 27, 0.14)"
        },
        success: {
          iconTheme: {
            primary: "#006b2f",
            secondary: "#ffffff"
          }
        },
        error: {
          iconTheme: {
            primary: "#b42318",
            secondary: "#ffffff"
          }
        }
      }}
    />
  );
}
