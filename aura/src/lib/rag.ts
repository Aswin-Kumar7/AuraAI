import { Pinecone } from "@pinecone-database/pinecone";

const EMBED_DIM = 768;

// Placeholder embedding: in a real system, call Groq/transformer embeddings.
async function embed(texts: string[]): Promise<number[][]> {
  return texts.map(() => new Array(EMBED_DIM).fill(0));
}

const pinecone = process.env.PINECONE_API_KEY 
  ? new Pinecone({ apiKey: process.env.PINECONE_API_KEY }) 
  : null;

export async function retrieveRelevantKB(companyId: string, query: string, topK = 4) {
  const indexName = process.env.PINECONE_INDEX_NAME || process.env.PINECONE_INDEX;
  if (!pinecone || !indexName) {
    return [];
  }

  const [vector] = await embed([query]);
  const index = pinecone.index(indexName);

  const res = await index.query({
    topK,
    vector,
    includeMetadata: true,
    filter: { companyId },
  });

  const chunks: string[] =
    res.matches?.map((m: any) => String(m.metadata?.text || "")).filter(Boolean) ?? [];

  return chunks;
}

