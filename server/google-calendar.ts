import { getGoogleCalendarToken, saveGoogleCalendarToken } from "./db";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const MEET_API_URL = "https://meet.googleapis.com/v2";

function getGoogleCredentials() {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("As credenciais do Google Calendar não estão configuradas.");
  }
  return { clientId, clientSecret };
}

async function refreshAccessToken(userId: number, refreshToken: string) {
  const { clientId, clientSecret } = getGoogleCredentials();
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) throw new Error("Não foi possível renovar a conexão com o Google.");
  const data = await response.json() as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error("O Google não retornou um novo token de acesso.");
  const expiresAt = new Date(Date.now() + (data.expires_in ?? 3600) * 1000);
  await saveGoogleCalendarToken(userId, { accessToken: data.access_token, refreshToken, expiresAt });
  return data.access_token;
}

export async function getValidGoogleAccessToken(userId: number) {
  const token = await getGoogleCalendarToken(userId);
  if (!token) throw new Error("Conecte sua conta Google antes de criar ou sincronizar reuniões.");
  const stillValid = token.expiresAt && token.expiresAt.getTime() > Date.now() + 5 * 60 * 1000;
  if (stillValid) return token.accessToken;
  if (!token.refreshToken) throw new Error("A conexão Google expirou. Desconecte e conecte novamente.");
  return refreshAccessToken(userId, token.refreshToken);
}

async function googleFetch(userId: number, url: string, init: RequestInit = {}) {
  const accessToken = await getValidGoogleAccessToken(userId);
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(url, { ...init, headers });
  if (response.status === 401) {
    const token = await getGoogleCalendarToken(userId);
    if (token?.refreshToken) {
      const refreshed = await refreshAccessToken(userId, token.refreshToken);
      headers.set("Authorization", `Bearer ${refreshed}`);
      return fetch(url, { ...init, headers });
    }
  }
  return response;
}

export function extractMeetingCode(meetUrl?: string | null) {
  if (!meetUrl) return undefined;
  const match = meetUrl.match(/meet\.google\.com\/([a-z0-9-]+)/i);
  return match?.[1];
}

export async function createGoogleCalendarMeeting(input: {
  userId: number;
  title: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  attendeeEmails: string[];
  crsId: number;
  taskId?: number;
}) {
  const requestId = `orbita-${input.userId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const eventPayload = {
    summary: input.title,
    description: input.description ?? "",
    start: { dateTime: input.startDate.toISOString() },
    end: { dateTime: input.endDate.toISOString() },
    attendees: input.attendeeEmails.map((email) => ({ email })),
    conferenceData: {
      createRequest: {
        requestId,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
    extendedProperties: {
      private: {
        orbitaMeeting: "true",
        orbitaCrsId: String(input.crsId),
        ...(input.taskId ? { orbitaTaskId: String(input.taskId) } : {}),
      },
    },
  };

  const response = await googleFetch(input.userId, `${CALENDAR_EVENTS_URL}?conferenceDataVersion=1&sendUpdates=all`, {
    method: "POST",
    body: JSON.stringify(eventPayload),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`O Google Calendar recusou a criação da reunião (${response.status}). ${detail.slice(0, 200)}`);
  }

  const event = await response.json() as any;
  const meetUrl = event.hangoutLink
    ?? event.conferenceData?.entryPoints?.find((entry: any) => entry.entryPointType === "video")?.uri;
  return {
    googleEventId: event.id as string,
    googleMeetUrl: meetUrl as string | undefined,
    meetingCode: extractMeetingCode(meetUrl),
  };
}

export async function syncGoogleMeetReport(userId: number, meetingCode: string) {
  const filter = encodeURIComponent(`space.meeting_code = "${meetingCode}"`);
  const conferencesResponse = await googleFetch(userId, `${MEET_API_URL}/conferenceRecords?filter=${filter}&pageSize=20`);
  if (!conferencesResponse.ok) {
    const detail = await conferencesResponse.text();
    throw new Error(`Não foi possível consultar os registros do Google Meet (${conferencesResponse.status}). ${detail.slice(0, 200)}`);
  }
  const conferences = await conferencesResponse.json() as any;
  const records = Array.isArray(conferences.conferenceRecords) ? conferences.conferenceRecords : [];
  const record = records
    .filter((item: any) => item.startTime)
    .sort((a: any, b: any) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())[0];
  if (!record?.name) return null;

  const participantsResponse = await googleFetch(userId, `${MEET_API_URL}/${record.name}/participants?pageSize=100`);
  if (!participantsResponse.ok) {
    const detail = await participantsResponse.text();
    throw new Error(`Não foi possível consultar os participantes do Google Meet (${participantsResponse.status}). ${detail.slice(0, 200)}`);
  }
  const participantsData = await participantsResponse.json() as any;
  const participants = (Array.isArray(participantsData.participants) ? participantsData.participants : []).map((participant: any) => ({
    name: participant.signedInUser?.displayName
      ?? participant.anonymousUser?.displayName
      ?? participant.phoneUser?.displayName
      ?? participant.signedInUser?.user?.replace(/^users\//, "")
      ?? "Participante",
    user: participant.signedInUser?.user ?? null,
  }));

  return {
    actualStartDate: record.startTime ? new Date(record.startTime) : null,
    actualEndDate: record.endTime ? new Date(record.endTime) : null,
    participants,
  };
}
