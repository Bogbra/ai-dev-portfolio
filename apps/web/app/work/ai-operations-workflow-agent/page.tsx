import { createCaseStudyMetadata } from '@/lib/metadata';
import { Cs01Content } from './Cs01Content';

export const metadata = createCaseStudyMetadata({
  slug: 'ai-operations-workflow-agent',
  title: 'AI Operations Workflow Agent — Case Study 01',
  description:
    'A deployed AI workflow app for turning uploaded contact data and natural-language requests into reviewable business email drafts.',
  ogTitle: 'AI Operations Workflow Agent',
  ogDescription:
    'Deployed AI workflow: upload contacts, describe an action, get an editable draft. Human-in-the-loop approval at every step.',
});

export default function AiOperationsWorkflowPage() {
  return <Cs01Content />;
}
