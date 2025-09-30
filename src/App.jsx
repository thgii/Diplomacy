import React from "react";
import { Routes, Route } from "react-router-dom";
import SignInGate from "@/components/SignInGate";
// import your pages...

export default function App() {
  return (
    <SignInGate>
      <Routes>
        {/* your routes */}
        {/* <Route path="/" element={<Home/>} /> etc. */}
      </Routes>
    </SignInGate>
  );
}
