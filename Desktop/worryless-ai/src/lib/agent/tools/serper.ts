interface SerperResult {
  title: string;
  link: string;
  snippet: string;
  position: number;
}

interface SerperResponse {
  organic: SerperResult[];
  knowledgeGraph?: {
    title?: string;
    description?: string;
  };
}

export async function searchWeb(
  query: string,
  numResults = 10,
): Promise<SerperResult[]> {
  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": process.env.SERPER_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      q: query,
      num: numResults,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    console.error(
      `Serper error for query "${query}":`,
      response.status,
      errorBody,
    );
    throw new Error(
      `Serper search failed: ${response.statusText} - ${errorBody}`,
    );
  }

  const data: SerperResponse = await response.json();
  return data.organic || [];
}

export async function searchMultiple(
  queries: string[],
): Promise<Record<string, SerperResult[]>> {
  const results: Record<string, SerperResult[]> = {};

  await Promise.all(
    queries.map(async (query) => {
      results[query] = await searchWeb(query);
    }),
  );

  return results;
}
