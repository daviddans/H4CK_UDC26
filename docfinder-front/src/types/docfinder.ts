export type SearchMode = "search" | "ask";

export type SortMode = "relevance" | "date";

export type ResultsView = "grid" | "list";

export type DocumentHit = {
  doc_id: string;
  chunk_id: string;
  title: string;
  doc_type: string;
  category: string;
  tags: string[];
  page_start: number;
  page_end: number;
  lang: string;
  date: string;
  score: number;
  snippet_html: string;
};

export type SearchFilters = {
  doc_type: string[];
  category: string[];
  tags: string[];
  lang: string[];
  from?: string;
  to?: string;
  sort: SortMode;
};

export type SearchApiResponse = {
  hits: DocumentHit[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  available: {
    docTypes: string[];
    categories: string[];
    tags: string[];
    langs: string[];
  };
};

export type AskCitation = {
  doc_id: string;
  title: string;
  page: number;
  snippet_html: string;
};

export type AskResponse = {
  answer: string;
  citations: AskCitation[];
};

export type DocumentDetail = {
  doc_id: string;
  title: string;
  doc_type: string;
  category: string;
  tags: string[];
  lang: string;
  date: string;
  score: number;
  download_url?: string;
  open_url?: string;
  chunks: DocumentHit[];
};
