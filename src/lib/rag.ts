import { Pinecone } from "@pinecone-database/pinecone";

const DEFAULT_EMBED_DIM = 768;
const configuredEmbedDim = Number.parseInt(
  process.env.PINECONE_EMBED_DIM || `${DEFAULT_EMBED_DIM}`,
  10
);
const EMBED_DIM = Number.isFinite(configuredEmbedDim) && configuredEmbedDim > 0
  ? configuredEmbedDim
  : DEFAULT_EMBED_DIM;
const PINECONE_EMBED_MODE = (process.env.PINECONE_EMBED_MODE || "hash").toLowerCase();
const PINECONE_EMBED_MODEL = process.env.PINECONE_EMBED_MODEL || "multilingual-e5-large";
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME || process.env.PINECONE_INDEX || "";

const pinecone = process.env.PINECONE_API_KEY
  ? new Pinecone({ apiKey: process.env.PINECONE_API_KEY })
  : null;

export interface RetrievedKnowledge {
  text: string;
  score: number;
}

let loggedEmbedFallback = false;
let loggedIndexDimensionFallback = false;
let cachedIndexDimension: number | null = null;
let hasResolvedIndexDimension = false;

function hashToken(token: string): number {
  // FNV-1a 32-bit hash for stable, fast token indexing.
  let h = 2166136261;
  for (let i = 0; i < token.length; i += 1) {
    h ^= token.charCodeAt(i);
    h +=
      (h << 1) +
      (h << 4) +
      (h << 7) +
      (h << 8) +
      (h << 24);
  }

  return h >>> 0;
}

function normalizeVector(values: number[]): number[] {
  const norm = Math.sqrt(values.reduce((sum, v) => sum + v * v, 0));
  if (!Number.isFinite(norm) || norm <= 0) {
    return values;
  }

  return values.map((v) => v / norm);
}

function fitVectorDimension(values: number[], targetDim: number): number[] {
  if (targetDim <= 0) {
    return values;
  }

  if (values.length === targetDim) {
    return values;
  }

  if (values.length > targetDim) {
    return values.slice(0, targetDim);
  }

  return [...values, ...new Array(targetDim - values.length).fill(0)];
}

async function getTargetEmbeddingDimension(): Promise<number> {
  if (hasResolvedIndexDimension) {
    return cachedIndexDimension || EMBED_DIM;
  }

  hasResolvedIndexDimension = true;

  if (!pinecone || !PINECONE_INDEX_NAME) {
    cachedIndexDimension = EMBED_DIM;
    return cachedIndexDimension;
  }

  try {
    const stats = await pinecone.index(PINECONE_INDEX_NAME).describeIndexStats();
    const rawDimension = (stats as { dimension?: unknown })?.dimension;
    const dim =
      typeof rawDimension === "number"
        ? rawDimension
        : Number.parseInt(String(rawDimension || ""), 10);

    if (Number.isFinite(dim) && dim > 0) {
      cachedIndexDimension = dim;
      return dim;
    }
  } catch (error) {
    if (!loggedIndexDimensionFallback) {
      console.warn(
        `[RAG] Could not read Pinecone index dimension for ${PINECONE_INDEX_NAME}. ` +
          `Falling back to ${EMBED_DIM}.`,
        error
      );
      loggedIndexDimensionFallback = true;
    }
  }

  cachedIndexDimension = EMBED_DIM;
  return cachedIndexDimension;
}

function hashEmbedText(text: string, targetDim: number): number[] {
  const vector = new Array(targetDim).fill(0);
  const normalized = String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = normalized.length > 0 ? normalized.split(" ") : [];

  if (tokens.length === 0) {
    return vector;
  }

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const idx = hashToken(token) % targetDim;
    vector[idx] += 1.0;

    // Add bigram context so short policy phrases still cluster reasonably.
    if (i < tokens.length - 1) {
      const bigram = `${token}_${tokens[i + 1]}`;
      const biIdx = hashToken(bigram) % targetDim;
      vector[biIdx] += 0.55;
    }
  }

  return normalizeVector(vector);
}

function extractDenseValues(row: unknown, targetDim: number): number[] | null {
  const record =
    typeof row === "object" && row !== null
      ? (row as Record<string, unknown>)
      : null;
  if (!record) {
    return null;
  }

  const values = record.values;
  if (!Array.isArray(values)) {
    return null;
  }

  const nums = values.map((v) =>
    typeof v === "number" && Number.isFinite(v) ? v : 0
  );

  if (nums.length === 0) {
    return null;
  }

  return normalizeVector(fitVectorDimension(nums, targetDim));
}

export async function embedKnowledgeTexts(
  texts: string[],
  inputType: "query" | "passage" = "passage"
): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const targetDim = await getTargetEmbeddingDimension();

  if (PINECONE_EMBED_MODE === "pinecone" && pinecone) {
    try {
      const embedded = await pinecone.inference.embed({
        model: PINECONE_EMBED_MODEL,
        inputs: texts,
        parameters: {
          inputType,
          truncate: "END",
        },
      });

      const rows = Array.isArray(embedded.data) ? embedded.data : [];
      const vectors = rows.map((row) => extractDenseValues(row, targetDim));

      if (
        vectors.length === texts.length &&
        vectors.every((v): v is number[] => Array.isArray(v) && v.length === targetDim)
      ) {
        return vectors as number[][];
      }

      if (!loggedEmbedFallback) {
        console.warn(
          `[RAG] Pinecone inference embeddings did not match expected dimension ${targetDim}. Falling back to hash embeddings.`
        );
        loggedEmbedFallback = true;
      }
    } catch (error) {
      if (!loggedEmbedFallback) {
        console.warn("[RAG] Pinecone inference embed failed, falling back to hash embeddings:", error);
        loggedEmbedFallback = true;
      }
    }
  }

  return texts.map((t) => hashEmbedText(t, targetDim));
}

export async function retrieveRelevantKB(companyId: string, query: string, topK = 4) {
  const scored = await retrieveRelevantKBWithScores(companyId, query, topK);
  return scored.map((m) => m.text);
}

function normalizePineconeScore(score: number | null | undefined): number {
  if (typeof score !== "number" || Number.isNaN(score)) {
    return 0;
  }

  // Cosine scores are typically 0..1, dot product can exceed 1.
  if (score <= 1) {
    return Math.max(0, Math.min(1, score));
  }

  return Math.max(0, Math.min(1, score / 10));
}

export async function retrieveRelevantKBWithScores(
  companyId: string,
  query: string,
  topK = 4
): Promise<RetrievedKnowledge[]> {
  if (!pinecone || !PINECONE_INDEX_NAME) {
    return [];
  }

  const [vector] = await embedKnowledgeTexts([query], "query");
  const index = pinecone.index(PINECONE_INDEX_NAME);

  const res = await index.query({
    topK,
    vector,
    includeMetadata: true,
    filter: { companyId },
  });

  const matches = Array.isArray(res.matches) ? res.matches : [];

  const chunks: RetrievedKnowledge[] = matches
    .map((m) => {
      const metadata =
        typeof m.metadata === "object" && m.metadata !== null
          ? (m.metadata as Record<string, unknown>)
          : {};
      const text = String(metadata.text || "").trim();
      const score = normalizePineconeScore(
        typeof m.score === "number" ? m.score : null
      );

      return { text, score };
    })
    .filter((m) => m.text.length > 0);

  return chunks;
}

