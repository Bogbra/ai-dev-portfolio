import { describe, it, expect } from 'vitest';
import { ragAskRequestSchema, ragUploadRequestSchema } from './rag.js';

// ─── Ask request ──────────────────────────────────────────────────────────────

const validAsk = {
  question: 'What are the main findings?',
  sessionId: 'sess-abc-123',
};

function parseAsk(overrides: Partial<typeof validAsk & { _honey: string }>) {
  return ragAskRequestSchema.safeParse({ ...validAsk, ...overrides });
}

describe('ragAskRequestSchema — valid', () => {
  it('accepts a clean ask request', () => {
    expect(parseAsk({}).success).toBe(true);
  });

  it('trims whitespace from question', () => {
    const result = parseAsk({ question: '  What are the findings?  ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.question).toBe('What are the findings?');
  });

  it('defaults _honey to empty string when omitted', () => {
    const result = ragAskRequestSchema.safeParse(validAsk);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data._honey).toBe('');
  });

  it('accepts _honey when filled — schema passes, route handles silently', () => {
    const result = parseAsk({ _honey: 'bot was here' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data._honey).toBe('bot was here');
  });

  it('accepts a question of exactly 3 characters', () => {
    expect(parseAsk({ question: 'Why' }).success).toBe(true);
  });

  it('accepts a question of exactly 500 characters', () => {
    expect(parseAsk({ question: 'A'.repeat(500) }).success).toBe(true);
  });
});

describe('ragAskRequestSchema — question validation', () => {
  it('rejects a question shorter than 3 characters', () => {
    expect(parseAsk({ question: 'Hi' }).success).toBe(false);
  });

  it('rejects an empty question', () => {
    expect(parseAsk({ question: '' }).success).toBe(false);
  });

  it('rejects a question longer than 500 characters', () => {
    expect(parseAsk({ question: 'A'.repeat(501) }).success).toBe(false);
  });

  it('rejects a whitespace-only question (becomes empty after trim)', () => {
    expect(parseAsk({ question: '   ' }).success).toBe(false);
  });
});

describe('ragAskRequestSchema — sessionId validation', () => {
  it('rejects a missing sessionId', () => {
    expect(ragAskRequestSchema.safeParse({ question: validAsk.question }).success).toBe(false);
  });

  it('rejects an empty sessionId', () => {
    expect(parseAsk({ sessionId: '' }).success).toBe(false);
  });

  it('rejects a sessionId longer than 64 characters', () => {
    expect(parseAsk({ sessionId: 'a'.repeat(65) }).success).toBe(false);
  });

  it('accepts a sessionId of exactly 64 characters', () => {
    expect(parseAsk({ sessionId: 'a'.repeat(64) }).success).toBe(true);
  });
});

describe('ragAskRequestSchema — unknown fields', () => {
  it('rejects a payload with an extra top-level field', () => {
    expect(parseAsk({ extra: 'not allowed' } as never).success).toBe(false);
  });
});

// ─── Upload request ───────────────────────────────────────────────────────────

const validFile = {
  filename: 'report.pdf',
  content: 'JVBERi0xLj==', // base64 placeholder
  mimeType: 'application/pdf',
};

const validUpload = {
  files: [validFile],
};

describe('ragUploadRequestSchema — valid', () => {
  it('accepts a single-file upload', () => {
    expect(ragUploadRequestSchema.safeParse(validUpload).success).toBe(true);
  });

  it('accepts up to 3 files', () => {
    const result = ragUploadRequestSchema.safeParse({
      ...validUpload,
      files: [validFile, validFile, validFile],
    });
    expect(result.success).toBe(true);
  });
});

describe('ragUploadRequestSchema — files validation', () => {
  it('rejects an empty files array', () => {
    expect(ragUploadRequestSchema.safeParse({ ...validUpload, files: [] }).success).toBe(false);
  });

  it('rejects more than 3 files', () => {
    expect(
      ragUploadRequestSchema.safeParse({
        ...validUpload,
        files: [validFile, validFile, validFile, validFile],
      }).success,
    ).toBe(false);
  });

  it('rejects a file with an empty filename', () => {
    expect(
      ragUploadRequestSchema.safeParse({
        ...validUpload,
        files: [{ ...validFile, filename: '' }],
      }).success,
    ).toBe(false);
  });

  it('rejects a file with empty content', () => {
    expect(
      ragUploadRequestSchema.safeParse({
        ...validUpload,
        files: [{ ...validFile, content: '' }],
      }).success,
    ).toBe(false);
  });

  it('rejects a file with an empty mimeType', () => {
    expect(
      ragUploadRequestSchema.safeParse({
        ...validUpload,
        files: [{ ...validFile, mimeType: '' }],
      }).success,
    ).toBe(false);
  });

  it('rejects a file with a filename longer than 255 characters', () => {
    expect(
      ragUploadRequestSchema.safeParse({
        ...validUpload,
        files: [{ ...validFile, filename: 'a'.repeat(256) + '.pdf' }],
      }).success,
    ).toBe(false);
  });

  it('rejects a payload with an extra top-level field', () => {
    expect(ragUploadRequestSchema.safeParse({ ...validUpload, extra: 'x' }).success).toBe(false);
  });

  it('rejects a file with an extra field', () => {
    expect(
      ragUploadRequestSchema.safeParse({
        ...validUpload,
        files: [{ ...validFile, extra: 'x' }],
      }).success,
    ).toBe(false);
  });
});
