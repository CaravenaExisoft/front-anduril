import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { Cpu, User } from "lucide-react";
import { AVATAR_URL } from "../config.js";

export default function ChatMessages({ messages, isLoading, onRetry }) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <div className="flex-1 overflow-y-auto px-2 space-y-4 custom-scrollbar">
      {messages.map((msg, idx) => (
        <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
          <div
            className={`flex gap-3 max-w-[95%] lg:max-w-[80%] ${
              msg.role === "user" ? "flex-row-reverse" : "flex-row"
            }`}
          >
            <div className="w-10 h-10 rounded-xl flex-shrink-0 border border-white/10 overflow-hidden bg-slate-800 shadow-inner">
              {msg.role === "user" ? (
                <div className="w-full h-full flex items-center justify-center">
                  <User className="w-5 h-5 text-slate-400" />
                </div>
              ) : (
                <img src={AVATAR_URL} className="w-full h-full object-cover object-top scale-125" alt="Andúril" />
              )}
            </div>
            <div
              className={`flex flex-col gap-2 p-4 rounded-3xl text-sm leading-relaxed shadow-xl ${
                msg.role === "user" ? "bg-blue-600 text-white" : "bg-white/10 text-slate-100"
              }`}
            >
              <div className="prose-chat">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
              {msg.retryText && (
                <button
                  type="button"
                  onClick={() => onRetry(msg.retryText)}
                  className="self-start text-xs font-semibold text-cyan-300 hover:text-cyan-200 underline underline-offset-2"
                >
                  Reintentar
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
      {isLoading && (
        <div className="flex items-center gap-2 px-14 text-cyan-400">
          <Cpu className="w-4 h-4 animate-spin" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Procesando tu pedido...</span>
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}
