type WhatsAppConfig = {
  accessToken?: string;
  phoneNumberId?: string;
  mock?: boolean;
};

export type SendResult = {
  ok: boolean;
  provider: "whatsapp";
  mode: "LIVE" | "MOCK" | "SKIPPED";
  externalId?: string;
  error?: string;
};

export type WhatsAppMediaKind = "image" | "audio" | "document";

function resolveMode(config: WhatsAppConfig | null | undefined) {
  const token = config?.accessToken?.trim();
  const phoneNumberId = config?.phoneNumberId?.trim();
  const forceMock = config?.mock !== false && (!token || !phoneNumberId);
  return { token, phoneNumberId, forceMock: forceMock || !token || !phoneNumberId };
}

export async function sendWhatsAppMessage(
  config: WhatsAppConfig | null | undefined,
  to: string,
  body: string
): Promise<SendResult> {
  const phone = to.replace(/[^0-9]/g, "");
  if (!phone) {
    return { ok: false, provider: "whatsapp", mode: "SKIPPED", error: "Invalid phone" };
  }

  const { token, phoneNumberId, forceMock } = resolveMode(config);

  if (forceMock) {
    return {
      ok: true,
      provider: "whatsapp",
      mode: "MOCK",
      externalId: `wa-mock-${Date.now()}`,
    };
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phone,
          type: "text",
          text: { body },
        }),
      }
    );
    const data = (await res.json()) as {
      messages?: { id: string }[];
      error?: { message?: string };
    };
    if (!res.ok) {
      return {
        ok: false,
        provider: "whatsapp",
        mode: "LIVE",
        error: data.error?.message || `HTTP ${res.status}`,
      };
    }
    return {
      ok: true,
      provider: "whatsapp",
      mode: "LIVE",
      externalId: data.messages?.[0]?.id,
    };
  } catch (e) {
    return {
      ok: false,
      provider: "whatsapp",
      mode: "LIVE",
      error: e instanceof Error ? e.message : "Send failed",
    };
  }
}

/** Upload binary to Meta media API; returns media id for message send. */
async function uploadWhatsAppMedia(
  token: string,
  phoneNumberId: string,
  file: Buffer,
  mimeType: string,
  fileName: string
): Promise<{ id?: string; error?: string }> {
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", mimeType);
  form.append("file", new Blob([new Uint8Array(file)], { type: mimeType }), fileName);

  const res = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/media`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const data = (await res.json()) as { id?: string; error?: { message?: string } };
  if (!res.ok || !data.id) {
    return { error: data.error?.message || `Media upload HTTP ${res.status}` };
  }
  return { id: data.id };
}

export async function sendWhatsAppMedia(
  config: WhatsAppConfig | null | undefined,
  to: string,
  input: {
    kind: WhatsAppMediaKind;
    buffer: Buffer;
    mimeType: string;
    fileName: string;
    caption?: string;
  }
): Promise<SendResult> {
  const phone = to.replace(/[^0-9]/g, "");
  if (!phone) {
    return { ok: false, provider: "whatsapp", mode: "SKIPPED", error: "Invalid phone" };
  }

  const { token, phoneNumberId, forceMock } = resolveMode(config);

  if (forceMock) {
    return {
      ok: true,
      provider: "whatsapp",
      mode: "MOCK",
      externalId: `wa-mock-media-${Date.now()}`,
    };
  }

  try {
    const uploaded = await uploadWhatsAppMedia(
      token!,
      phoneNumberId!,
      input.buffer,
      input.mimeType,
      input.fileName
    );
    if (!uploaded.id) {
      return {
        ok: false,
        provider: "whatsapp",
        mode: "LIVE",
        error: uploaded.error || "Media upload failed",
      };
    }

    const mediaPayload =
      input.kind === "image"
        ? { image: { id: uploaded.id, caption: input.caption || undefined } }
        : input.kind === "audio"
          ? { audio: { id: uploaded.id } }
          : {
              document: {
                id: uploaded.id,
                caption: input.caption || undefined,
                filename: input.fileName,
              },
            };

    const res = await fetch(
      `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phone,
          type: input.kind,
          ...mediaPayload,
        }),
      }
    );
    const data = (await res.json()) as {
      messages?: { id: string }[];
      error?: { message?: string };
    };
    if (!res.ok) {
      return {
        ok: false,
        provider: "whatsapp",
        mode: "LIVE",
        error: data.error?.message || `HTTP ${res.status}`,
      };
    }
    return {
      ok: true,
      provider: "whatsapp",
      mode: "LIVE",
      externalId: data.messages?.[0]?.id,
    };
  } catch (e) {
    return {
      ok: false,
      provider: "whatsapp",
      mode: "LIVE",
      error: e instanceof Error ? e.message : "Media send failed",
    };
  }
}
