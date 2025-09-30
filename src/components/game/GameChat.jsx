
import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  X, Send, MessageSquare, Users, Plus, Crown, Shield, 
  Globe, Lock 
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import CreateThreadDialog from "./CreateThreadDialog";

const countryAbbrevs = {
  England: "E",
  France: "F",
  Germany: "G",
  Italy: "I",
  Austria: "A",
  Russia: "R",
  Turkey: "T",
};


const formatMountainTime = (dateString) => {
  const date = new Date(dateString);
  // 'America/Denver' is the standard IANA time zone name for Mountain Time (MST/MDT)
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Denver',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false, // Use 24-hour format
  });

  // Rebuild the string to match the desired "MMM d, HH:mm" format
  const parts = formatter.formatToParts(date);
  const findPart = (type) => parts.find(p => p.type === type)?.value;
  
  const month = findPart('month');
  const day = findPart('day');
  const hour = findPart('hour');
  const minute = findPart('minute');

  return `${month} ${day}, ${hour}:${minute}`;
};

export default function GameChat({ game, user, messages, onSendMessage, onClose }) {
  const [newMessage, setNewMessage] = useState("");
  const [activeThread, setActiveThread] = useState("public");
  const [showCreateThread, setShowCreateThread] = useState(false);
  const [threads, setThreads] = useState([]); // Changed to state
  const messagesEndRef = useRef(null); // Changed from scrollRef

  const normId = (v) => String(v ?? "public");

// --- Unread counter helpers/state ---

  const getThreadId = (m) => normId(
    m.threadId ?? m.thread_id ?? m.thread ?? "public"
  );

  const getTimestamp = (m) => {
    const v = m.createdAt ?? m.created_at ?? m.created_date ?? m.timestamp ?? m.time ?? m.sentAt;
    return v ? new Date(v).getTime() : 0;
  };

  const getSenderId = (m) =>
    m.userId ?? m.user_id ?? m.senderId ?? m.sender_email ?? m.sender?.id ?? m.authorId;

  const [unreadByThread, setUnreadByThread] = useState({});
  const [lastReadByThread, setLastReadByThread] = useState(() => {
    try {
      const key = `chat:lastRead:${game?.id}:${user?.id ?? user?.email}`;
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      const key = `chat:lastRead:${game?.id}:${user?.id ?? user?.email}`;
      localStorage.setItem(key, JSON.stringify(lastReadByThread));
    } catch {}
  }, [lastReadByThread, game?.id, user?.id, user?.email]);


  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    // This effect ensures we scroll to the bottom when messages are loaded
    // or when the active chat thread is changed.
    scrollToBottom();
  }, [messages, activeThread]);

// recompute unread counters
  useEffect(() => {
   if (!Array.isArray(messages)) return;

    const me = String(user?.email ?? user?.id ?? "");  // who am I?
    const nextCounts = {};

    for (const msg of messages) {
      const t = getThreadId(msg);             // ← THIS is the line in question
      const ts = getTimestamp(msg);
      const sender = String(getSenderId(msg) ?? "");

      const isOwn = sender === me;
      const isActive = t === normId(activeThread || "public");
      const seenAt = lastReadByThread[t] ?? 0;

    // Count as unread only if:
    // - it's NOT the currently open thread
    // - it's NOT my own message
    // - it arrived AFTER I last viewed that thread
      if (!isActive && !isOwn && ts > seenAt) {
        nextCounts[t] = (nextCounts[t] ?? 0) + 1;
      }
    }

    setUnreadByThread(nextCounts);
  }, [messages, activeThread, lastReadByThread, user?.email, user?.id]);

  useEffect(() => {
    const id = normId(activeThread || "public");
    if (!Array.isArray(messages)) return;

    // Find the newest message timestamp in the *active* thread
    const latestInActive = messages
      .filter((m) => getThreadId(m) === id)
      .reduce((max, m) => Math.max(max, getTimestamp(m)), 0);

    if (latestInActive > (lastReadByThread[id] ?? 0)) {
      setLastReadByThread((prev) => ({ ...prev, [id]: latestInActive }));
      setUnreadByThread((prev) => ({ ...prev, [id]: 0 }));
    }
  }, [messages, activeThread, lastReadByThread]);



  useEffect(() => {
    const threadMap = new Map();
    
    // Always start with public thread
    threadMap.set("public", {
      id: "public",
      name: "Public Channel",
      participants: game.players?.map(p => p.email) || [],
      isPublic: true
    });

    // Process private threads from messages
    messages.forEach((msg) => {
      const id = getThreadId(msg);
      if (id !== "public" && msg.thread_participants?.includes(user.email)) {
        if (!threadMap.has(id)) {
          const participantCountries = msg.thread_participants
            .map((email) => game.players?.find((p) => p.email === email)?.country)
            .filter(Boolean)
            .sort();

          const abbrevName = participantCountries
            .map((c) => countryAbbrevs[c] ?? (c?.[0] ?? "?"))
            .join("-");

          threadMap.set(id, {
            id,
            name: abbrevName,           // e.g., "E-G" or "A-F-I"
            participants: msg.thread_participants || [],
            isPublic: false,
          });

        }
      }
    });


    setThreads(Array.from(threadMap.values()));
  }, [messages, game.players, user.email]);

  // Filter messages for active thread
  const threadMessages = messages.filter(
    (msg) => getThreadId(msg) === normId(activeThread || "public")
  );

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const currentThread = threads.find((t) => normId(t.id) === normId(activeThread));
    if (!currentThread) return; // Guard against sending to non-existent thread
    
    const participants = currentThread.participants || [];

    onSendMessage(newMessage, activeThread, participants);
    setNewMessage("");
  };

  const handleCreateThread = ({ participants, name }) => {
    const threadId = `thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newThread = {
        id: threadId,
        name: name,
        participants: participants,
        isPublic: false
    };

    // Add the new thread to the local state immediately
    setThreads(prevThreads => {
        // Avoid adding duplicates if a thread was somehow already created
        if (prevThreads.some(t => t.id === threadId)) {
            return prevThreads;
        }
        return [...prevThreads, newThread];
    });

    // Set it as the active thread
    setActiveThread(threadId);
    setShowCreateThread(false);
  };

  const getUserCountry = (email) => {
    return game.players?.find(p => p.email === email)?.country || email;
  };

  const getUserColor = (email) => {
    return game.players?.find(p => p.email === email)?.color || "#6c757d";
  };

  const getThreadIcon = (thread) => {
    if (thread.isPublic) {
      return <Globe className="w-4 h-4" />;
    }
    return <Lock className="w-4 h-4" />;
  };

  const handleSelectThread = (threadId) => {
    // 1) mark the *current* thread (the one you're leaving) as read up to the latest message
    const currentId = normId(activeThread || "public");
    const latestInCurrent = Array.isArray(messages)
      ? messages
          .filter((m) => getThreadId(m) === currentId)
          .reduce((max, m) => Math.max(max, getTimestamp(m)), 0)
      : 0;

    setLastReadByThread((prev) => ({
      ...prev,
      [currentId]: Math.max(prev[currentId] ?? 0, latestInCurrent, Date.now()),
    }));

    // 2) switch to the new thread and clear its badge immediately for snappy UX
    const id = normId(threadId);
    setActiveThread(id);
    setLastReadByThread((prev) => ({ ...prev, [id]: Date.now() }));
    setUnreadByThread((prev) => ({ ...prev, [id]: 0 }));
  };


  useEffect(() => {
    if (!activeThread) return;
    const id = normId(activeThread);
    setLastReadByThread((prev) => ({ ...prev, [id]: Date.now() }));
    setUnreadByThread((prev) => ({ ...prev, [id]: 0 }));
  }, [activeThread]);


  useEffect(() => {
    const t = normId(activeThread || "public");
    setLastReadByThread((prev) => (prev[t] ? prev : { ...prev, [t]: Date.now() }));
    setUnreadByThread((prev) => (prev[t] ? { ...prev, [t]: 0 } : prev));

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // on first mount only


  return (
    <div className="h-full flex flex-col bg-white">
      <CardHeader className="border-b border-slate-200 pb-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageSquare className="w-5 h-5 text-blue-600" />
            Diplomatic Channels
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose} className="w-8 h-8">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>

      <div className="flex-1 flex flex-col min-h-0">
        {/* Thread Tabs */}
        <div className="border-b border-slate-200 p-2 flex-shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            {threads.map((thread) => (
              <Button
                key={thread.id}
                variant={activeThread === normId(thread.id) ? "default" : "outline"}
                size="sm"
                onClick={() => handleSelectThread(thread.id)}
                className={`h-8 text-xs ${
                  activeThread === normId(thread.id)
                    ? "bg-blue-600 text-white"
                    : "hover:bg-slate-50"
                }`}
              >
                {getThreadIcon(thread)}
                <span className="ml-1 max-w-24 truncate">{thread.name}</span>
                {unreadByThread[normId(thread.id)] > 0 && (
                  <Badge className="ml-1">
                    {unreadByThread[normId(thread.id)]}
                  </Badge>
                )}
              </Button>
            ))}


            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCreateThread(true)}
              className="h-8 text-xs border-dashed"
            >
              <Plus className="w-3 h-3" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 min-h-0">
          <ScrollArea className="h-full p-4">
            <div className="space-y-3">
              <AnimatePresence>
                {threadMessages.map((message, index) => {
                  const isOwnMessage = message.sender_email === user.email;
                  const senderColor = getUserColor(message.sender_email);
                  const senderCountry = getUserCountry(message.sender_email);

                  return (
                    <motion.div
                      key={`${message.id || index}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[80%] ${isOwnMessage ? 'order-2' : 'order-1'}`}>
                        <div
                          className={`p-3 rounded-lg shadow-sm ${
                            isOwnMessage
                              ? 'bg-blue-600 text-white ml-auto'
                              : 'bg-white border border-slate-200'
                          }`}
                        >
                          {!isOwnMessage && (
                            <div className="flex items-center gap-2 mb-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: senderColor }}
                              />
                              <span className="font-semibold text-sm text-slate-700">
                                {senderCountry}
                              </span>
                              {message.sender_email === game.host_email && (
                                <Crown className="w-3 h-3 text-yellow-500" />
                              )}
                            </div>
                          )}
                          <p className={`text-sm leading-relaxed ${
                            isOwnMessage ? 'text-white' : 'text-slate-700'
                          }`}>
                            {message.message}
                          </p>
                          <div className={`text-xs mt-2 ${
                            isOwnMessage ? 'text-blue-100' : 'text-slate-400'
                          }`}>
                            {formatMountainTime(message.created_date)}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              
              {threadMessages.length === 0 && (
                <div className="text-center py-12">
                  <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500 text-sm">No messages in this channel yet.</p>
                  <p className="text-slate-400 text-xs mt-1">Start the conversation!</p>
                </div>
              )}
              {/* This div will be scrolled into view to keep messages at the bottom */}
              <div ref={messagesEndRef} /> 
            </div>
          </ScrollArea>
        </div>

        {/* Message Input */}
        <div className="border-t border-slate-200 p-4 flex-shrink-0">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your diplomatic message..."
              className="flex-1"
              disabled={!activeThread}
            />
            <Button 
              type="submit" 
              size="icon"
              disabled={!newMessage.trim() || !activeThread}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
          
          {activeThread !== "public" && (
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
              <Lock className="w-3 h-3" />
              <span>Private conversation</span>
            </div>
          )}
        </div>
      </div>

      <CreateThreadDialog
        open={showCreateThread}
        onClose={() => setShowCreateThread(false)}
        players={game.players || []}
        currentUserEmail={user.email}
        onCreateThread={handleCreateThread}
      />
    </div>
  );
}
