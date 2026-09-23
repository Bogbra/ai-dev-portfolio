import { createCaseStudyMetadata } from '@/lib/metadata';
import { Cs03Content } from './Cs03Content';

export const metadata = createCaseStudyMetadata({
  slug: 'research-rag-assistant',
  title: 'Agentic RAG Research Assistant — Case Study 03',
  description:
    'A drag-and-drop PDF research workflow with chunking, retrieval, and retrieval-constrained answers with visible sources — built as a working full-stack prototype.',
  ogTitle: 'Agentic RAG Research Assistant',
  ogDescription:
    'PDF upload, text chunking, embedding-based retrieval, and retrieval-constrained answering with visible sources — deployed as a full-stack RAG prototype.',
});

export default function ResearchRagAssistantPage() {
  return <Cs03Content />;
}
