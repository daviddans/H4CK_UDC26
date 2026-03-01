export type SearchMode = "search" | "ask";

export type SortMode =
  | "relevance_desc"
  | "relevance_asc"
  | "date_desc"
  | "date_asc";

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
  total_pages?: number;
  lang: string;
  date: string;
  score: number;
  snippet_html: string;
  source_name?: string;
  source_path?: string;
};

export type SearchFilters = {
  doc_type: string[];
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
  doc_type?: string;
  source_name?: string;
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
  total_pages?: number;
  source_name?: string;
  source_path?: string;
  viewer_type?: "pdf" | "text" | "csv" | "spreadsheet" | "binary";
  download_url?: string;
  open_url?: string;
  chunks: DocumentHit[];
};
