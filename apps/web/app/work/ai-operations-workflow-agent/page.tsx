import type { Metadata } from 'next';
import { Cs01Content } from './Cs01Content';

export const metadata: Metadata = {
  title: 'AI Operations Workflow Agent — Case Study 01',
  description:
    'A deployed AI workflow app for turning uploaded contact data and natural-language requests into reviewable business email drafts.',
  openGraph: {
    title: 'AI Operations Workflow Agent',
    description:
      'Deployed AI workflow: upload contacts, describe an action, get an editable draft. Human-in-the-loop approval at every step.',
    type: 'article',
  },
};

export default function AiOperationsWorkflowPage() {
  return <Cs01Content />;
}
