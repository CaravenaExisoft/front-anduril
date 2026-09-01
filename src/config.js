// Configuración del widget. Nada de esto es secreto: es un frontend público
// (CLIENT_ID de OAuth y URLs de backend no son credenciales).

export const CLIENT_ID = "1004150678649-idb7jd45g24hoe5h41rfugltlj9lqq12.apps.googleusercontent.com";

export const AVATAR_URL =
  "https://blobanduril.blob.core.windows.net/contenido-anduril/Avatar_Anduril.png?sp=r&st=2026-02-20T19:20:50Z&se=2027-07-31T03:35:50Z&sv=2024-11-04&sr=b&sig=QYBhSD6KE8B2odakHE333VQx8HStfhyIKpJf3oa0Ymk%3D";

// Backend en Azure (CentralAgentMessages).
export const BACKEND_URL =
  "https://centralagentmessages-ckbhdqcjg3e4cdfq.canadacentral-01.azurewebsites.net/api/chat";

export const AGENT_NAME = "ITSM-Agent";
export const AGENT_VERSION = "49";

// 50 minutos: margen sobre el vencimiento real de 60 minutos de Google.
export const TOKEN_TTL_MS = 50 * 60 * 1000;

export const GREETING = "Hola, soy Andúril. Iniciá sesión con tu cuenta de Google para empezar.";
