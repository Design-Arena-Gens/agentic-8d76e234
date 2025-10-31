import { NextResponse } from "next/server";
import OpenAI from "openai";
import { YoutubeTranscript } from "youtube-transcript";
import { z } from "zod";

const requestSchema = z.object({
  channelUrl: z.string().min(1),
  topic: z.string().min(4),
  youtubeApiKey: z.string().min(10),
  openAiKey: z.string().min(10),
  videoCount: z.number().int().min(1).max(8),
});

type ChannelIdentifier =
  | { type: "id"; value: string }
  | { type: "handle"; value: string }
  | { type: "custom"; value: string }
  | null;

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload." },
      { status: 400 }
    );
  }

  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please fill in every field with valid values." },
      { status: 400 }
    );
  }

  const { channelUrl, topic, youtubeApiKey, openAiKey, videoCount } =
    parsed.data;

  const identifier = extractChannelIdentifier(channelUrl);
  if (!identifier) {
    return NextResponse.json(
      { error: "Unsupported YouTube channel link. Try a different URL." },
      { status: 400 }
    );
  }

  try {
    const channelMeta = await resolveChannelDetails(
      identifier,
      youtubeApiKey,
      videoCount
    );

    if (!channelMeta) {
      return NextResponse.json(
        { error: "Unable to find the provided channel." },
        { status: 404 }
      );
    }

    const { channelTitle, videos } = channelMeta;

    const transcripts = await fetchTranscripts(videos);
    if (!transcripts.length) {
      return NextResponse.json(
        {
          error:
            "Transcripts are unavailable for the recent uploads. Try a different channel.",
        },
        { status: 422 }
      );
    }

    const transcriptDigest = transcripts
      .map(
        (entry) =>
          `### ${entry.title} (${entry.videoId})\n${entry.transcriptForModel}`
      )
      .join("\n\n");

    const openai = new OpenAI({ apiKey: openAiKey });

    const styleAnalysis = await openai.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "system",
          content:
            "You are a narrative analyst who reverse-engineers the writing style of YouTube storytellers. You only speak JSON when instructed.",
        },
        {
          role: "user",
          content: `Study these transcript excerpts from the YouTube channel "${channelTitle}". Summarize the writing style as JSON using the keys: voiceTone (string), narrativeStructure (string), recurringDevices (string), pacing (string), audienceEngagement (string), writingGuidelines (array of 6 concise bullet strings). Keep each string under 80 words. Transcripts:\n\n${transcriptDigest}`,
        },
      ],
    });

    const stylePayloadText = styleAnalysis.output_text;

    if (!stylePayloadText) {
      throw new Error("Failed to read analysis output.");
    }
    const parsedStyle = parseJsonObject(stylePayloadText) as {
      voiceTone: string;
      narrativeStructure: string;
      recurringDevices: string;
      pacing: string;
      audienceEngagement: string;
      writingGuidelines: string[];
    };

    if (!Array.isArray(parsedStyle.writingGuidelines)) {
      throw new Error("Style payload missing writing guidelines.");
    }

    const guidelineList = parsedStyle.writingGuidelines.slice(0, 6);

    const scriptResponse = await openai.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "system",
          content:
            "You are a senior scriptwriter hired to mimic the target channel's storytelling voice exactly.",
        },
        {
          role: "user",
          content: `Channel: ${channelTitle}\nTopic: ${topic}\nVoice Tone: ${parsedStyle.voiceTone}\nNarrative Structure: ${parsedStyle.narrativeStructure}\nRecurring Devices: ${parsedStyle.recurringDevices}\nPacing: ${parsedStyle.pacing}\nAudience Engagement: ${parsedStyle.audienceEngagement}\nGuidelines: ${guidelineList.join(
            "; "
          )}\n\nWrite a 5-7 paragraph YouTube script that follows this structure:\n1. Hook (1 short paragraph)\n2. Narrative build with vivid storytelling and data callouts (3-4 paragraphs)\n3. Engaging takeaway and CTA (1-2 paragraphs).\nKeep total word count under 600.\nReturn plain text with blank lines between paragraphs.`,
        },
      ],
    });

    const scriptText = scriptResponse.output_text?.trim();

    if (!scriptText) {
      throw new Error("Script generation failed.");
    }

    return NextResponse.json({
      channelTitle,
      styleSummary: {
        voiceTone: parsedStyle.voiceTone,
        narrativeStructure: parsedStyle.narrativeStructure,
        recurringDevices: parsedStyle.recurringDevices,
        pacing: parsedStyle.pacing,
        audienceEngagement: parsedStyle.audienceEngagement,
      },
      writingGuidelines: guidelineList,
      generatedScript: scriptText,
      sampledTranscripts: transcripts.map((entry) => ({
        videoId: entry.videoId,
        title: entry.title,
        excerpt: entry.snippetExcerpt,
      })),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error.";
    const status = message.includes("quota")
      ? 429
      : message.includes("API key")
      ? 401
      : 500;

    return NextResponse.json(
      { error: status === 500 ? "Failed to build script style." : message },
      { status }
    );
  }
}

function parseJsonObject(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model response missing JSON object.");
  }

  const slice = text.slice(start, end + 1);

  try {
    return JSON.parse(slice);
  } catch {
    throw new Error("Model response was not valid JSON.");
  }
}

function extractChannelIdentifier(url: string): ChannelIdentifier {
  try {
    const parsed = new URL(url);

    const segments = parsed.pathname
      .split("/")
      .map((segment) => segment.trim())
      .filter(Boolean);

    if (!segments.length) {
      return null;
    }

    if (segments[0] === "@") {
      return { type: "handle", value: segments[0] };
    }

    if (segments[0].startsWith("@")) {
      return { type: "handle", value: segments[0] };
    }

    if (segments[0] === "channel" && segments[1]) {
      return { type: "id", value: segments[1] };
    }

    if ((segments[0] === "c" || segments[0] === "user") && segments[1]) {
      return { type: "custom", value: segments[1] };
    }

    if (parsed.pathname.startsWith("/@")) {
      return { type: "handle", value: parsed.pathname.slice(1) };
    }

    return null;
  } catch {
    return null;
  }
}

async function resolveChannelDetails(
  identifier: ChannelIdentifier,
  apiKey: string,
  videoCount: number
): Promise<
  | {
      channelId: string;
      channelTitle: string;
      videos: {
        videoId: string;
        title: string;
        publishedAt: string;
      }[];
    }
  | null
> {
  const channelId = await identifyChannelId(identifier, apiKey);
  if (!channelId) {
    return null;
  }

  const channelRes = await fetch(
    `${YOUTUBE_API_BASE}/channels?part=snippet&id=${channelId}&key=${apiKey}`
  );

  if (!channelRes.ok) {
    throw new Error("Failed to fetch channel metadata.");
  }

  const channelJson = (await channelRes.json()) as {
    items: { snippet: { title: string } }[];
  };

  const channelTitle = channelJson.items?.[0]?.snippet?.title ?? "Channel";

  const videoRes = await fetch(
    `${YOUTUBE_API_BASE}/search?part=snippet&channelId=${channelId}&order=date&type=video&maxResults=${Math.min(
      videoCount,
      8
    )}&key=${apiKey}`
  );

  if (!videoRes.ok) {
    throw new Error("Failed to fetch recent videos. Check your API key quota.");
  }

  const videoJson = (await videoRes.json()) as {
    items?: {
      id?: { videoId?: string };
      snippet?: { title?: string; publishedAt?: string };
    }[];
    error?: { message?: string };
  };

  if (videoJson.error?.message) {
    throw new Error(videoJson.error.message);
  }

  const videos =
    videoJson.items
      ?.map((item) => ({
        videoId: item.id?.videoId,
        title: item.snippet?.title ?? "Untitled video",
        publishedAt: item.snippet?.publishedAt ?? "",
      }))
      .filter(
        (item): item is { videoId: string; title: string; publishedAt: string } =>
          Boolean(item.videoId)
      ) ?? [];

  return {
    channelId,
    channelTitle,
    videos,
  };
}

async function identifyChannelId(
  identifier: ChannelIdentifier,
  apiKey: string
): Promise<string | null> {
  if (!identifier) return null;

  if (identifier.type === "id") {
    return identifier.value;
  }

  if (identifier.type === "handle") {
    const query = identifier.value.startsWith("@")
      ? identifier.value.slice(1)
      : identifier.value;
    const searchRes = await fetch(
      `${YOUTUBE_API_BASE}/search?part=snippet&type=channel&maxResults=1&q=${encodeURIComponent(
        query
      )}&key=${apiKey}`
    );

    if (!searchRes.ok) {
      throw new Error("Unable to resolve channel handle.");
    }

    const searchJson = (await searchRes.json()) as {
      items?: { id?: { channelId?: string } }[];
    };

    return searchJson.items?.[0]?.id?.channelId ?? null;
  }

  if (identifier.type === "custom") {
    const usernameRes = await fetch(
      `${YOUTUBE_API_BASE}/channels?part=id&forUsername=${encodeURIComponent(
        identifier.value
      )}&key=${apiKey}`
    );

    if (!usernameRes.ok) {
      throw new Error("Unable to resolve custom channel URL.");
    }

    const usernameJson = (await usernameRes.json()) as {
      items?: { id?: string }[];
    };

    if (usernameJson.items && usernameJson.items.length > 0) {
      return usernameJson.items[0]?.id ?? null;
    }

    // Fallback to search when the legacy username API returns empty.
    const searchRes = await fetch(
      `${YOUTUBE_API_BASE}/search?part=snippet&type=channel&maxResults=1&q=${encodeURIComponent(
        identifier.value
      )}&key=${apiKey}`
    );

    if (!searchRes.ok) {
      throw new Error("Unable to resolve custom channel URL.");
    }

    const searchJson = (await searchRes.json()) as {
      items?: { id?: { channelId?: string } }[];
    };

    return searchJson.items?.[0]?.id?.channelId ?? null;
  }

  return null;
}

async function fetchTranscripts(
  videos: {
    videoId: string;
    title: string;
  }[]
): Promise<
  {
    videoId: string;
    title: string;
    transcriptForModel: string;
    snippetExcerpt: string;
  }[]
> {
  const chunks = await Promise.all(
    videos.map(async (video) => {
      try {
        const transcript = await YoutubeTranscript.fetchTranscript(
          video.videoId,
          {
            lang: "en",
          }
        );

        if (!transcript || !transcript.length) {
          return null;
        }

        const combined = transcript
          .map((segment) => segment.text)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();

        if (!combined) {
          return null;
        }

        const limitedForModel = combined.slice(0, 3000);
        const excerpt = combined.slice(0, 320);

        return {
          videoId: video.videoId,
          title: video.title,
          transcriptForModel: limitedForModel,
          snippetExcerpt: excerpt,
        };
      } catch {
        return null;
      }
    })
  );

  return chunks.filter(
    (
      entry
    ): entry is {
      videoId: string;
      title: string;
      transcriptForModel: string;
      snippetExcerpt: string;
    } => Boolean(entry)
  );
}
