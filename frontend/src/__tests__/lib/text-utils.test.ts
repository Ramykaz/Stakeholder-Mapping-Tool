import { replaceInitiativePlaceholders } from '@/lib/initiativeText';
import { normalizeLlmText } from '@/lib/llmText';

describe('Text utility coverage', () => {
  test('replaceInitiativePlaceholders replaces initiative tokens case-insensitively', () => {
    const source = 'The [initiative] supports [ the initiative ] priorities.';
    expect(replaceInitiativePlaceholders(source, 'Blue Economy Program')).toBe(
      'The Blue Economy Program supports Blue Economy Program priorities.',
    );
  });

  test('replaceInitiativePlaceholders returns source when initiative name is empty', () => {
    expect(replaceInitiativePlaceholders('Keep [initiative] as-is', '   ')).toBe('Keep [initiative] as-is');
  });

  test('normalizeLlmText strips markdown artifacts and list markers', () => {
    const source = '**Header**\n\n- item one\n2) item two\n`inline code`';
    expect(normalizeLlmText(source)).toBe('Header\n\nitem one\nitem two\ninline code');
  });

  test('normalizeLlmText normalizes whitespace and newlines', () => {
    const source = 'Line   one\r\n\r\n\r\nLine two';
    expect(normalizeLlmText(source)).toBe('Line one\n\nLine two');
  });
});
