"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  MessageCircle,
  X,
  Send,
  Loader2,
  Bot,
  User,
  Zap,
  Volume2,
  Sparkles,
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "bot";
  text: string;
  timeStr: string;
  deviceAction?: string | null;
}

const QUICK_PROMPTS = [
  "What medicines do I have today?",
  "Any missed doses?",
  "Trigger alert on Bay 1",
  "Is it safe to take my medicines together?",
];

export function CuraBot() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "bot",
      text: "👋 Hi! I'm CuraBot, your AI health assistant. Ask me about your medicines, today's doses, drug interactions, or I can trigger your dispenser alerts!",
      timeStr: "Just now",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasNew, setHasNew] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const getNowTimeStr = () =>
    new Date().toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });

  useEffect(() => {
    if (open) {
      setHasNew(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, open]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || loading) return;

      const userMsg: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        text: text.trim(),
        timeStr: getNowTimeStr(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setLoading(true);

      try {
        const res = await fetch("/api/ai/curabot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text.trim(), userId: user?.id }),
        });

        const data = await res.json();

        const botMsg: Message = {
          id: `bot-${Date.now()}`,
          role: "bot",
          text: data.reply || data.error || "Sorry, I couldn't process that request.",
          timeStr: getNowTimeStr(),
          deviceAction: data.deviceAction || null,
        };
        setMessages((prev) => [...prev, botMsg]);

        if (!open) setHasNew(true);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: "bot",
            text: "Connection error. Please try again.",
            timeStr: getNowTimeStr(),
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [loading, user?.id, open]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <>
      {/* Floating Chat Button */}
      <button
        id="curabot-toggle"
        onClick={() => setOpen((v) => !v)}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 group ${
          open
            ? "bg-slate-700 rotate-0"
            : "bg-gradient-to-br from-violet-600 to-indigo-600 hover:scale-110"
        }`}
        title="CuraBot AI Assistant"
      >
        {open ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <>
            <Bot className="w-6 h-6 text-white" />
            {hasNew && (
              <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white animate-bounce" />
            )}
            <span className="absolute inset-0 rounded-full bg-violet-400 opacity-30 animate-ping" />
          </>
        )}
      </button>

      {/* Chat Panel */}
      {open && (
        <div
          id="curabot-panel"
          className="fixed bottom-24 right-6 z-50 w-[360px] max-w-[calc(100vw-24px)] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
          style={{ height: "520px", animation: "slideUpFade 0.2s ease-out" }}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3 flex items-center gap-3 flex-shrink-0">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm">CuraBot</span>
                <span className="flex items-center gap-1 text-[10px] text-violet-200 bg-white/15 px-1.5 py-0.5 rounded-full">
                  <Sparkles className="w-2.5 h-2.5" />
                  AI
                </span>
              </div>
              <p className="text-[10px] text-violet-200">Context-aware health assistant</p>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-emerald-300 bg-emerald-500/20 border border-emerald-400/30 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Online
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex items-end gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
              >
                {/* Avatar */}
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                    msg.role === "bot"
                      ? "bg-gradient-to-br from-violet-500 to-indigo-600"
                      : "bg-sky-500"
                  }`}
                >
                  {msg.role === "bot" ? (
                    <Bot className="w-4 h-4 text-white" />
                  ) : (
                    <User className="w-4 h-4 text-white" />
                  )}
                </div>

                {/* Bubble */}
                <div
                  className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-gradient-to-br from-sky-500 to-indigo-500 text-white rounded-br-sm"
                      : "bg-white text-slate-800 border border-slate-200 shadow-xs rounded-bl-sm"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                  {msg.deviceAction && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1">
                      <Volume2 className="w-3 h-3" />
                      <span>Dispenser alert triggered!</span>
                    </div>
                  )}
                  <p
                    className={`text-[10px] mt-1 ${
                      msg.role === "user" ? "text-white/60 text-right" : "text-slate-400"
                    }`}
                  >
                    {msg.timeStr}
                  </p>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-end gap-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3">
                  <div className="flex gap-1 items-center">
                    <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Quick Prompts */}
          {messages.length <= 1 && (
            <div className="px-3 py-2 bg-slate-50 border-t border-slate-100 flex gap-1.5 overflow-x-auto scrollbar-none flex-shrink-0">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  disabled={loading}
                  className="text-[11px] font-medium bg-white border border-violet-200 text-violet-700 rounded-full px-2.5 py-1 whitespace-nowrap hover:bg-violet-50 transition-colors flex-shrink-0 cursor-pointer disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <form
            onSubmit={handleSubmit}
            className="px-3 py-3 border-t border-slate-200 flex items-center gap-2 bg-white flex-shrink-0"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your medicines..."
              disabled={loading}
              className="flex-1 text-sm px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent bg-slate-50 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              id="curabot-send"
              className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white disabled:opacity-50 hover:opacity-90 transition-opacity flex-shrink-0 cursor-pointer"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </form>
        </div>
      )}

      <style>{`
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .scrollbar-none::-webkit-scrollbar { display: none; }
      `}</style>
    </>
  );
}
