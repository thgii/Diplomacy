// src/App.jsx
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import SignInGate from "@/components/SignInGate";

// Pages
import GameLobby from "@/pages/GameLobby";   // <-- name matches component you render
import GameBoard from "@/pages/GameBoard";
import GameAdmin from "@/pages/GameAdmin";   // optional, if you actually have this page

export default function App() {
  return (
    <SignInGate>
      <Routes>
        {/* Default: send "/" to /GameLobby */}
        <Route path="/" element={<Navigate to="/GameLobby" replace />} />

        {/* Actual pages */}
        <Route path="/GameLobby" element={<GameLobby />} />
        <Route path="/GameBoard" element={<GameBoard />} />
        <Route path="/GameAdmin" element={<GameAdmin />} /> {/* remove if not needed */}

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/GameLobby" replace />} />
      </Routes>
    </SignInGate>
  );
}
