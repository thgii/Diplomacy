

import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Crown, MessageSquare, Map, Users, Settings, LogIn, LogOut, Trash2 } from "lucide-react";
import { User } from "@/api/entities";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

const navigationItems = [
  {
    title: "Game Lobby",
    url: createPageUrl("GameLobby"),
    icon: Users,
  },
];

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await User.me();
      setUser(currentUser);
    } catch (error) {
      // User not logged in
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    try {
      await User.login();
    } catch (error) {
      console.error("Login error:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await User.logout();
      setUser(null);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const isAdmin = user?.role === 'admin';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center space-y-6 p-8">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-800 to-blue-900 rounded-xl flex items-center justify-center shadow-lg mx-auto">
            <Crown className="w-10 h-10 text-yellow-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Diplomacy</h1>
            <p className="text-slate-600 text-lg">Strategic Warfare Awaits</p>
          </div>
          <Button 
            onClick={handleLogin}
            size="lg" 
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
          >
            <LogIn className="w-5 h-5 mr-2" />
            Enter the Arena
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <style>{`
          :root {
            --diplomatic-navy: #1e3a5f;
            --diplomatic-gold: #d4af37;
            --diplomatic-cream: #faf9f6;
            --diplomatic-gray: #2d3748;
            --diplomatic-light: #e2e8f0;
          }
          
          /* Custom scrollbar styles */
          .scrollbar-thin {
            scrollbar-width: thin;
            scrollbar-color: #cbd5e1 #f1f5f9;
          }
          
          .scrollbar-thin::-webkit-scrollbar {
            width: 6px;
            height: 6px;
          }
          
          .scrollbar-thin::-webkit-scrollbar-track {
            background: #f1f5f9;
            border-radius: 3px;
          }
          
          .scrollbar-thin::-webkit-scrollbar-thumb {
            background: #cbd5e1;
            border-radius: 3px;
          }
          
          .scrollbar-thin::-webkit-scrollbar-thumb:hover {
            background: #94a3b8;
          }
          
          .scrollbar-thumb-slate-300::-webkit-scrollbar-thumb {
            background: #cbd5e1;
          }
          
          .scrollbar-track-slate-100::-webkit-scrollbar-track {
            background: #f1f5f9;
          }
        `}</style>
        
        <Sidebar className="border-r border-slate-200 bg-slate-50">
          <SidebarHeader className="border-b border-slate-200 p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-800 to-blue-900 rounded-xl flex items-center justify-center shadow-lg">
                <Crown className="w-6 h-6 text-yellow-400" />
              </div>
              <div>
                <h2 className="font-bold text-xl text-slate-900">Diplomacy</h2>
                <p className="text-sm text-slate-500">Strategic Warfare</p>
              </div>
            </div>
          </SidebarHeader>
          
          <SidebarContent className="p-3">
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-3">
                Navigation
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navigationItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        asChild 
                        className={`hover:bg-blue-50 hover:text-blue-700 transition-all duration-200 rounded-xl mb-1 ${
                          location.pathname === item.url ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-slate-700'
                        }`}
                      >
                        <Link to={item.url} className="flex items-center gap-3 px-4 py-3">
                          <item.icon className="w-5 h-5" />
                          <span className="font-medium">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Admin Access */}
            {location.pathname.includes('GameBoard') && (
              <SidebarGroup>
                <SidebarGroupLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-3">
                  Admin Tools
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild className="hover:bg-amber-50 hover:text-amber-700 transition-all duration-200 rounded-xl mb-1 text-slate-700">
                        <Link to={createPageUrl(`GameAdmin?gameId=${new URLSearchParams(window.location.search).get('gameId')}`)} className="flex items-center gap-3 px-4 py-3">
                          <Settings className="w-5 h-5" />
                          <span className="font-medium">Game Admin</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}

            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-3">
                Quick Stats
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <div className="px-4 py-3 space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <Map className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-600">Active Games</span>
                    <span className="ml-auto font-semibold text-slate-900">0</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <MessageSquare className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-600">Messages</span>
                    <span className="ml-auto font-semibold text-slate-900">0</span>
                  </div>
                </div>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="border-t border-slate-200 p-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-gradient-to-br from-slate-200 to-slate-300 rounded-full flex items-center justify-center">
                  <span className="text-slate-700 font-semibold text-sm">
                    {user?.full_name?.charAt(0) || 'D'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 text-sm truncate">
                    {user?.full_name || 'Diplomat'}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {isAdmin ? 'Administrator' : 'Strategic Player'}
                  </p>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleLogout}
                className="w-full"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col bg-slate-50">
          <header className="bg-white border-b border-slate-200 px-6 py-4 md:hidden">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="hover:bg-slate-100 p-2 rounded-xl transition-colors duration-200" />
              <h1 className="text-xl font-bold text-slate-900">Diplomacy</h1>
            </div>
          </header>

          <div className="flex-1 overflow-auto bg-gradient-to-br from-slate-50 to-slate-100">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}

