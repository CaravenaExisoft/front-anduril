import { useState } from "react";
import { ChevronRight, LogIn } from "lucide-react";

export default function Composer({ isConnected, isLoading, onSend, onConnect, authError }) {
  const [input, setInput] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSend(input.trim());
    setInput("");
  };

  return (
    <div className="flex-shrink-0 flex flex-col gap-2 px-2 pt-2 pb-2">
      {authError && <p className="text-xs text-red-400 px-2">{authError}</p>}
      {!isConnected ? (
        <button
          type="button"
          onClick={onConnect}
          className="w-full p-5 bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold rounded-3xl shadow-2xl flex items-center justify-center gap-3 transition-transform active:scale-95 hover:brightness-110"
        >
          <LogIn className="w-5 h-5" /> Conectar con Google
        </button>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="w-full flex items-center bg-white/5 border border-white/20 backdrop-blur-3xl rounded-3xl p-2 pl-6 gap-3 shadow-xl focus-within:border-cyan-400/50 transition-colors"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribí tu pedido..."
            className="flex-1 bg-transparent border-none text-white text-sm py-3 outline-none focus:ring-0"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="bg-white text-blue-900 h-12 w-12 rounded-2xl flex items-center justify-center shadow-lg active:scale-95 transition-all hover:bg-cyan-50 disabled:opacity-50"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </form>
      )}
    </div>
  );
}
