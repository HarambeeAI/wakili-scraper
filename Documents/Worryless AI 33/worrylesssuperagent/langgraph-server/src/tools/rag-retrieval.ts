import pg from "pg";

const { Pool } = pg;

let pool: pg.Pool | null = null;

function getPool(): pg.Pool {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL required");
  pool = new Pool({ connectionString, max: 5 });
  return pool;
}

export interface RAGResult {
  id: string;
  content: string;
  source: string | null;
  metadata: Record<string, unknown>;
  similarity?: number;
}

// Vector similarity search using pgvector cosine distance operator (<=>).
// Requires an embedding array of dimension 1536 (OpenAI text-embedding-3-small).
// Available Phase 12+ once an embedding model is wired in.
export async function ragRetrieveByVector(
  userId: string,
  embedding: number[],
  topK: number = 5,
  agentType?: string
): Promise<RAGResult[]> {
  const db = getPool();
  const embeddingStr = `[${embedding.join(",")}]`;

  let query = `
    SELECT id, content, source, metadata,
           1 - (embedding <=> $1::vector) AS similarity
    FROM langgraph.document_embeddings
    WHERE user_id = $2
  `;
  const params: unknown[] = [embeddingStr, userId];

  if (agentType) {
    query += ` AND (agent_type = $3 OR agent_type IS NULL)`;
    params.push(agentType);
  }

  query += ` ORDER BY embedding <=> $1::vector LIMIT $${params.length + 1}`;
  params.push(topK);

  const result = await db.query(query, params);
  return result.rows as RAGResult[];
}

// Text search fallback using PostgreSQL full-text search.
// Uses the standard English dictionary and ts_rank scoring.
// No embedding model required — available immediately.
export async function ragRetrieveByText(
  userId: string,
  searchQuery: string,
  topK: number = 5,
  agentType?: string
): Promise<RAGResult[]> {
  const db = getPool();

  let query = `
    SELECT id, content, source, metadata,
           ts_rank(to_tsvector('english', content), plainto_tsquery('english', $1)) AS similarity
    FROM langgraph.document_embeddings
    WHERE user_id = $2
      AND to_tsvector('english', content) @@ plainto_tsquery('english', $1)
  `;
  const params: unknown[] = [searchQuery, userId];

  if (agentType) {
    query += ` AND (agent_type = $3 OR agent_type IS NULL)`;
    params.push(agentType);
  }

  query += ` ORDER BY similarity DESC LIMIT $${params.length + 1}`;
  params.push(topK);

  const result = await db.query(query, params);
  return result.rows as RAGResult[];
}

// Combined retrieval — uses pgvector similarity if an embedding is provided,
// falls back to PostgreSQL full-text search otherwise.
//
// Usage:
//   const docs = await ragRetrieve(userId, "cashflow Q3 2024", { topK: 3 });
//   const docs = await ragRetrieve(userId, "cashflow", { embedding: embeddingArray, topK: 5, agentType: "accountant" });
export async function ragRetrieve(
  userId: string,
  query: string,
  options: {
    embedding?: number[];
    topK?: number;
    agentType?: string;
  } = {}
): Promise<RAGResult[]> {
  const { embedding, topK = 5, agentType } = options;

  if (embedding && embedding.length > 0) {
    return ragRetrieveByVector(userId, embedding, topK, agentType);
  }

  return ragRetrieveByText(userId, query, topK, agentType);
}
