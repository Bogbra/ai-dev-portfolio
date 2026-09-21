import type { Metadata } from 'next';
import { Cs02Content } from './Cs02Content';

export const metadata: Metadata = {
  title: 'Research-to-Post Multi-Agent Workflow — Case Study 02',
  description:
    'A deployed multi-agent workflow that researches, drafts, critiques, and revises LinkedIn posts — with human review at every step.',
  openGraph: {
    title: 'Research-to-Post Multi-Agent Workflow',
    description:
      'Deployed LangGraph workflow: five specialized workflow stages research, draft, critique, revise, and check groundedness — producing an editable LinkedIn post.',
    type: 'article',
  },
};

export default function ResearchToPostPage() {
  return <Cs02Content />;
}
