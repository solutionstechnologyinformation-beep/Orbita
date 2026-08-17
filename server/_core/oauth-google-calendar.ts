import type { Express, Request, Response } from "express";
import * as db from "../db";
import { sdk } from "./sdk";
import { verifyGoogleOAuthState } from "./google-oauth-state";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerGoogleCalendarOAuthRoute(app: Express) {
  app.get("/api/oauth/google/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code) {
      res.status(400).json({ error: "code is required" });
      return;
    }

    try {
      const oauthState = verifyGoogleOAuthState(state);

      // Exchange code for access token
      const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
      if (!clientId || !clientId.trim() || !clientSecret || !clientSecret.trim()) {
        throw new Error("Credenciais do Google Calendar não configuradas no servidor.");
      }
      const protocol = (req.headers['x-forwarded-proto'] as string) || 'https';
      const host = (req.headers['x-forwarded-host'] as string) || (req.headers.host as string) || 'localhost:3000';
      const redirectUri = `${protocol}://${host}/api/oauth/google/callback`;

      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });

      if (!tokenResponse.ok) {
        throw new Error("Failed to exchange code for token");
      }

      const tokens = await tokenResponse.json();
      const { access_token, refresh_token, expires_in } = tokens;

      // Get user info from Google
      const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${access_token}` },
      });

      if (!userInfoResponse.ok) {
        throw new Error("Failed to get user info");
      }

      const userInfo = await userInfoResponse.json();
      const userEmail = userInfo.email;

      // Associate the Google account with the currently authenticated Orbita user.
      const sessionUser = await sdk.authenticateRequest(req).catch(() => null);
      if (!sessionUser) {
        throw new Error("Sessão do Orbita não encontrada. Faça login novamente antes de conectar o Google.");
      }
      if (oauthState.userId !== sessionUser.id) {
        throw new Error("A autorização Google foi iniciada por outro usuário do Orbita.");
      }
      if (sessionUser.email && userEmail && sessionUser.email.toLowerCase() !== userEmail.toLowerCase()) {
        throw new Error("Selecione no Google o mesmo e-mail usado para entrar no Orbita.");
      }
      const userRecord = await db.getUserByEmail(userEmail);
      if (!userRecord || userRecord.id !== sessionUser.id) {
        throw new Error("O e-mail Google não corresponde ao usuário autenticado no Orbita.");
      }

      {
        const userId = userRecord.id;

        // Calculate token expiration
        const expiresAt = new Date();
        expiresAt.setSeconds(expiresAt.getSeconds() + (expires_in || 3600));

        // Save Google Calendar token
        await db.saveGoogleCalendarToken(userId, {
          accessToken: access_token,
          refreshToken: refresh_token,
          expiresAt,
        });

        // Fetch and save Google Calendar events
        try {
          const eventsResponse = await fetch(
            "https://www.googleapis.com/calendar/v3/calendars/primary/events",
            { headers: { Authorization: `Bearer ${access_token}` } }
          );

          if (eventsResponse.ok) {
            const eventsData = await eventsResponse.json();
            if (eventsData.items && Array.isArray(eventsData.items)) {
              for (const event of eventsData.items) {
                const startDate = event.start?.dateTime || event.start?.date;
                const endDate = event.end?.dateTime || event.end?.date;

                if (startDate && endDate) {
                  await db.saveGoogleCalendarEvent(userId, {
                    googleEventId: event.id,
                    title: event.summary || "(Sem título)",
                    description: event.description,
                    startDate: new Date(startDate),
                    endDate: new Date(endDate),
                    isSynced: true,
                  });
                }
              }
            }
          }
        } catch (error) {
          console.error("[Google Calendar] Error syncing events", error);
        }
      }

      // Redirect back to calendar page with success
      res.redirect(302, "/calendar?google_connected=true");
    } catch (error) {
      console.error("[Google Calendar] Callback failed", error);
      res.redirect(302, "/calendar?error=google_auth_failed");
    }
  });
}
