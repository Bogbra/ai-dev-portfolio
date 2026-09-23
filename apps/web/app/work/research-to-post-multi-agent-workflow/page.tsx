import { createCaseStudyMetadata } from '@/lib/metadata';
import { Cs02Content } from './Cs02Content';

export const metadata = createCaseStudyMetadata({
  slug: 'research-to-post-multi-agent-workflow',
  title: 'Research-to-Post Multi-Agent Workflow — Case Study 02',
  description:
    'A deployed multi-agent workflow that researches, drafts, critiques, and revises LinkedIn posts — with human review at every step.',
  ogTitle: 'Research-to-Post Multi-Agent Workflow',
  ogDescription:
    'Deployed LangGraph workflow: five specialized workflow stages research, draft, critique, revise, and check groundedness — producing an editable LinkedIn post.',
});

export default function ResearchToPostPage() {
  return <Cs02Content />;
}
