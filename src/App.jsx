// src/App.jsx
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import SignInGate from "@/components/SignInGate";
import Layout from "@/pages/Layout";
import GameLobby from "@/pages/GameLobby";
import GameBoard from "@/pages/GameBoard";
import GameAdmin from "@/pages/GameAdmin"; // if you have it

export default function App() {
  return (
    <SignInGate>
      <Routes>
        {/* Everything uses the Layout (which shows the left nav) */}
        <Route element={<Layout />}>
          {/* default route -> /GameLobby */}
          <Route path="/" element={<Navigate to="/GameLobby" replace />} />
          <Route path="/gamelobby" element={<GameLobby />} />
          <Route path="/gameboard" element={<GameBoard />} />
          <Route path="/gameadmin" element={<GameAdmin />} />
          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/GameLobby" replace />} />
        </Route>
      </Routes>
    </SignInGate>
  );
}
