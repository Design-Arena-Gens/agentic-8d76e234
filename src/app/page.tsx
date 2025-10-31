/* eslint-disable @next/next/no-img-element */
"use client";

import { FormEvent, useState } from "react";

type AnalysisResult = {
  channelTitle: string;
  styleSummary: {
    voiceTone: string;
    narrativeStructure: string;
    recurringDevices: string;
    pacing: string;
    audienceEngagement: string;
  };
  writingGuidelines: string[];
  generatedScript: string;
  sampledTranscripts: { videoId: string; title: string; excerpt: string }[];
};

export default function Home() {
  const [channelUrl, setChannelUrl] = useState("");
  const [topic, setTopic] = useState("");
  const [youtubeApiKey, setYoutubeApiKey] = useState("");
  const [openAiKey, setOpenAiKey] = useState("");
  const [videoCount, setVideoCount] = useState(4);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          channelUrl,
          topic,
          youtubeApiKey,
          openAiKey,
          videoCount,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Unable to analyze channel.");
      }

      const payload = (await response.json()) as AnalysisResult;
      setResult(payload);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-12">
        <header className="space-y-4">
          <span className="inline-flex items-center gap-2 rounded-full bg-slate-900/70 px-4 py-1 text-sm text-slate-300 ring-1 ring-white/10">
            <img
              src="/favicon.ico"
              alt="logo"
              className="h-4 w-4 grayscale invert"
            />
            Channel Stylist
          </span>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            Clone any YouTube storyteller&apos;s script voice in minutes.
          </h1>
          <p className="max-w-2xl text-lg text-slate-300">
            Paste a channel link, plug in your API keys, and synthesize a new
            script tailored to your topic. We study recent uploads,
            reverse-engineer the writing DNA, and hand you a ready-to-record
            draft.
          </p>
        </header>

        <main className="grid gap-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <section className="rounded-3xl border border-white/10 bg-slate-900/40 p-8 shadow-2xl shadow-slate-950/60 backdrop-blur">
            <h2 className="text-xl font-medium text-white">
              1. Analyze a channel
            </h2>
            <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label
                  className="block text-sm font-medium text-slate-200"
                  htmlFor="channel"
                >
                  YouTube channel link
                </label>
                <input
                  id="channel"
                  type="url"
                  required
                  placeholder="https://www.youtube.com/@yourfavoritecreator"
                  value={channelUrl}
                  onChange={(event) => setChannelUrl(event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40"
                />
              </div>

              <div className="space-y-2">
                <label
                  className="block text-sm font-medium text-slate-200"
                  htmlFor="topic"
                >
                  Script topic
                </label>
                <input
                  id="topic"
                  type="text"
                  required
                  placeholder="e.g. The hidden economics behind vintage sneakers"
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40"
                />
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <label
                    className="block text-sm font-medium text-slate-200"
                    htmlFor="youtubeKey"
                  >
                    YouTube Data API key
                  </label>
                  <input
                    id="youtubeKey"
                    type="password"
                    required
                    placeholder="AIza..."
                    value={youtubeApiKey}
                    onChange={(event) => setYoutubeApiKey(event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40"
                  />
                </div>
                <div className="space-y-2">
                  <label
                    className="block text-sm font-medium text-slate-200"
                    htmlFor="openai"
                  >
                    OpenAI API key
                  </label>
                  <input
                    id="openai"
                    type="password"
                    required
                    placeholder="sk-..."
                    value={openAiKey}
                    onChange={(event) => setOpenAiKey(event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label
                  className="block text-sm font-medium text-slate-200"
                  htmlFor="videoCount"
                >
                  Number of recent videos to study
                </label>
                <input
                  id="videoCount"
                  type="number"
                  min={1}
                  max={8}
                  value={videoCount}
                  onChange={(event) =>
                    setVideoCount(Number(event.target.value) || 1)
                  }
                  className="w-24 rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? (
                  <>
                    <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                    Analyzing channel DNA...
                  </>
                ) : (
                  "Generate style-guided script"
                )}
              </button>

              {error && (
                <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {error}
                </p>
              )}
            </form>
            <p className="mt-6 text-xs text-slate-400">
              Keys stay in your browser—the request is proxied to your own APIs.
              No data is stored server-side.
            </p>
          </section>

          <section className="space-y-6 rounded-3xl border border-white/10 bg-slate-900/40 p-8 shadow-2xl shadow-slate-950/60 backdrop-blur">
            <h2 className="text-xl font-medium text-white">
              2. Style breakdown & script
            </h2>
            {!result && !loading && (
              <div className="rounded-2xl border border-dashed border-white/10 p-8 text-sm text-slate-400">
                Drop a channel and keys to see a full style dossier and script
                output here. We&apos;ll compare hooks, pacing, storytelling
                beats, and call-to-action patterns.
              </div>
            )}

            {loading && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="h-4 w-48 animate-pulse rounded bg-white/10" />
                  <div className="h-3 w-full animate-pulse rounded bg-white/5" />
                  <div className="h-3 w-3/4 animate-pulse rounded bg-white/5" />
                </div>
                <div className="space-y-2">
                  <div className="h-4 w-40 animate-pulse rounded bg-white/10" />
                  <div className="h-3 w-full animate-pulse rounded bg-white/5" />
                  <div className="h-3 w-2/3 animate-pulse rounded bg-white/5" />
                </div>
                <div className="space-y-2">
                  <div className="h-4 w-32 animate-pulse rounded bg-white/10" />
                  <div className="h-3 w-full animate-pulse rounded bg-white/5" />
                  <div className="h-3 w-4/5 animate-pulse rounded bg-white/5" />
                </div>
              </div>
            )}

            {result && !loading && (
              <div className="space-y-8">
                <div className="space-y-2">
                  <p className="text-sm uppercase tracking-[0.2em] text-blue-300/80">
                    Channel blueprint
                  </p>
                  <h3 className="text-2xl font-semibold text-white">
                    {result.channelTitle}
                  </h3>
                </div>

                <div className="grid gap-4 rounded-2xl border border-white/10 bg-slate-950/60 p-6 md:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                      Voice & Tone
                    </p>
                    <p className="mt-2 text-sm text-slate-100">
                      {result.styleSummary.voiceTone}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                      Narrative Structure
                    </p>
                    <p className="mt-2 text-sm text-slate-100">
                      {result.styleSummary.narrativeStructure}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                      Engagement
                    </p>
                    <p className="mt-2 text-sm text-slate-100">
                      {result.styleSummary.audienceEngagement}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                      Pacing
                    </p>
                    <p className="mt-2 text-sm text-slate-100">
                      {result.styleSummary.pacing}
                    </p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                      Recurring Devices
                    </p>
                    <p className="mt-2 text-sm text-slate-100">
                      {result.styleSummary.recurringDevices}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-950/60 p-6">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                    Writing guardrails
                  </p>
                  <ul className="space-y-2 text-sm text-slate-100">
                    {result.writingGuidelines.map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-2 text-left text-slate-200"
                      >
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-400" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-950/60 p-6">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                    Generated script
                  </p>
                  <article className="prose prose-invert max-w-none text-slate-100">
                    {result.generatedScript
                      .split("\n")
                      .filter(Boolean)
                      .map((line, index) => (
                        <p key={`${line}-${index}`} className="whitespace-pre-wrap">
                          {line}
                        </p>
                      ))}
                  </article>
                </div>

                {!!result.sampledTranscripts.length && (
                  <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-950/60 p-6">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                      Transcript snippets
                    </p>
                    <ul className="space-y-4 text-sm text-slate-200">
                      {result.sampledTranscripts.map((sample) => (
                        <li key={sample.videoId} className="space-y-1">
                          <p className="font-medium text-white">
                            {sample.title}
                          </p>
                          <p className="rounded-lg border border-white/5 bg-slate-950/80 p-3 text-xs leading-relaxed text-slate-300">
                            {sample.excerpt}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
