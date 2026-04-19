import { WorkOS } from '@workos-inc/node';

// ACHTUNG: Diese Werte müssen in deiner .env Datei im Dayova-MVP Verzeichnis gesetzt werden.
// Da wir in React Native sind, nutzen wir WorkOS für Backend-Operationen (über Convex)
// oder direkt über Auth-Session für den OAuth Flow.

export const workos = new WorkOS(process.env.WORKOS_API_KEY);
export const clientId = process.env.WORKOS_CLIENT_ID;
export const redirectUri = 'dayova-mvp://callback'; // Expo deep link
