import { useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import Sidebar from "./components/Sidebar.jsx";
import ChatMessages from "./components/ChatMessages.jsx";
import Composer from "./components/Composer.jsx";
import { AGENT_NAME, AGENT_VERSION, BACKEND_URL, CLIENT_ID, GREETING, TOKEN_TTL_MS } from "./config.js";

export default function App() {
  const [userToken, setUserToken] = useState(null);
  const [messages, setMessages] = useState([{ role: "assistant", content: GREETING }]);
  const [isLoading, setIsLoading] = useState(false);
  const [previousResponseId, setPreviousResponseId] = useState(null);
  const [authError, setAuthError] = useState(null);

  const tokenExpiresRef = useRef(null);
  const isSendingRef = useRef(false);
  // ID estable para toda la sesión del navegador: el MCP de Calendar cachea el
  // token de Google por este ID, así que tiene que ser el mismo en cada request.
  const conversationIdRef = useRef(crypto.randomUUID());

  const isTokenValid = () => userToken && tokenExpiresRef.current && Date.now() < tokenExpiresRef.current;

  const handleLogin = () => {
    setAuthError(null);

    if (!window.google?.accounts?.oauth2) {
      setAuthError("No se pudo cargar el inicio de sesión de Google. Recargá la página e intentá de nuevo.");
      return;
    }

    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/userinfo.email",
      callback: (response) => {
        if (response.error || !response.access_token) {
          setAuthError("No se pudo completar el inicio de sesión con Google. Intentá de nuevo.");
          return;
        }

        const isRenewal = !!userToken || tokenExpiresRef.current !== null;
        setUserToken(response.access_token);
        tokenExpiresRef.current = Date.now() + TOKEN_TTL_MS;
        // Reiniciar la cadena de conversación para que el backend abra una
        // nueva sesión con el token fresco.
        setPreviousResponseId(null);

        const msg = isRenewal
          ? "Sesión renovada. Empezamos de nuevo con el acceso actualizado. ¿En qué te ayudo?"
          : "Sesión iniciada. ¿En qué te ayudo hoy?";
        setMessages((prev) => [...prev, { role: "assistant", content: msg }]);
      },
    });

    client.requestAccessToken();
  };

  const sendMessage = async (userMsg) => {
    if (!userMsg.trim() || isLoading || isSendingRef.current) return;
    // Lock síncrono: isLoading (estado de React) no se refleja hasta el próximo
    // render, así que un doble submit muy rápido podría pasar ese guard solo.
    isSendingRef.current = true;

    const newHistory = [...messages, { role: "user", content: userMsg }];
    setMessages(newHistory);
    setIsLoading(true);

    try {
      if (!isTokenValid()) {
        setUserToken(null);
        tokenExpiresRef.current = null;
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "⚠️ Tu sesión de Google expiró. Volvé a iniciar sesión y reenviá tu mensaje." },
        ]);
        return;
      }

      const payloadMessages = newHistory
        .filter((m) => m.content !== GREETING)
        .map((m) => ({ Role: m.role, Content: m.content }));

      const res = await fetch(BACKEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          Messages: payloadMessages,
          AgentName: AGENT_NAME,
          AgentVersion: AGENT_VERSION,
          GoogleToken: userToken,
          PreviousResponseId: previousResponseId,
          ConversationId: conversationIdRef.current,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error("Respuesta de error de la API:", errorText);
        throw new Error(`Error del servidor: ${res.status}`);
      }

      const data = await res.json();
      if (data.responseId) setPreviousResponseId(data.responseId);

      const botReply = data.reply || "Protocolo ejecutado, pero no se recibió respuesta de texto.";
      setMessages((prev) => [...prev, { role: "assistant", content: botReply }]);
    } catch (e) {
      console.error("Error en el enlace:", e);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "⚠️ Error de comunicación con la Central de Mensajes. Verificá el estado del servicio.",
          retryText: userMsg,
        },
      ]);
    } finally {
      setIsLoading(false);
      isSendingRef.current = false;
    }
  };

  return (
    <div className="flex h-full w-full text-slate-200 overflow-hidden p-2 lg:p-4 gap-4">
      <Sidebar isConnected={isTokenValid()} onConnect={handleLogin} />

      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <header className="h-16 flex-shrink-0 flex items-center gap-3 px-8 bg-white/5 border border-white/10 backdrop-blur-xl rounded-3xl mb-4 shadow-lg">
          <div className="p-2 bg-blue-600/20 rounded-lg text-cyan-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <h2 className="text-xs font-bold text-white uppercase tracking-widest">Andúril · Asistente Ejecutivo</h2>
        </header>

        <ChatMessages messages={messages} isLoading={isLoading} onRetry={sendMessage} />

        <Composer
          isConnected={isTokenValid()}
          isLoading={isLoading}
          onSend={sendMessage}
          onConnect={handleLogin}
          authError={authError}
        />
      </main>
    </div>
  );
}
