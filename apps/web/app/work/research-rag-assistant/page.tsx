import type { Metadata } from 'next';
import { Cs03Content } from './Cs03Content';

export const metadata: Metadata = {
  title: 'Agentic RAG Research Assistant — Case Study 03',
  description:
    'A drag-and-drop PDF research workflow with chunking, retrieval, and retrieval-constrained answers with visible sources — built as a working full-stack prototype.',
  openGraph: {
    title: 'Agentic RAG Research Assistant',
    description:
      'PDF upload, text chunking, embedding-based retrieval, and retrieval-constrained answering with visible sources — deployed as a full-stack RAG prototype.',
    type: 'article',
  },
};

export default function ResearchRagAssistantPage() {
  return <Cs03Content />;
}
