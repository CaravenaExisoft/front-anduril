import { LogIn } from "lucide-react";
import AnduriHead from "./AnduriHead.jsx";

export default function Sidebar({ isConnected, onConnect }) {
  return (
    <aside className="w-20 lg:w-72 hidden md:flex flex-col bg-white/5 border border-white/10 backdrop-blur-2xl rounded-[2rem] p-6 shadow-2xl">
      <div className="flex items-center gap-4 mb-10">
        <div className="w-14 h-14 lg:w-20 lg:h-20 rounded-2xl overflow-hidden border border-cyan-400/30 flex-shrink-0">
          <AnduriHead className="w-full h-full" />
        </div>
        <div className="hidden lg:block">
          <h1 className="font-bold text-white leading-none">Andúril</h1>
          <p className="text-[10px] text-cyan-400 uppercase font-bold tracking-wide">Asistente ejecutivo</p>
        </div>
      </div>

      <nav className="flex-1">
        <button
          type="button"
          onClick={onConnect}
          className="w-full flex items-center gap-4 p-4 rounded-2xl text-slate-400 hover:bg-white/5 transition-all cursor-pointer text-left"
        >
          <div className="relative">
            <LogIn className="w-5 h-5" />
            <span
              className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${
                isConnected ? "bg-emerald-400" : "bg-red-500"
              }`}
            />
          </div>
          <span className="hidden lg:block text-sm">Cuenta de Google</span>
        </button>
      </nav>
    </aside>
  );
}
