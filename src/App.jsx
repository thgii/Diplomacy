import React from "react";
import SignInGate from "@/components/SignInGate";   // add this import
import { Routes, Route } from "react-router-dom";
// (import your pages/components as before)

export default function App() {
  return (
    <SignInGate>
      {/* your existing app routes / layout */}
      <Routes>
        {/* ... */}
      </Routes>
    </SignInGate>
  );
}
