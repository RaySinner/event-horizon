import { describe, it, expect } from 'vitest';
import { buildClaudeMcpEntry } from '../setupHooks.js';
import { buildCopilotMcpEntry } from '../setupCopilotHooks.js';
import { buildOpenCodeMcpEntry } from '../setupOpenCodeHooks.js';
import { buildCursorMcpEntry } from '../setupCursorHooks.js';

describe('MCP config builders', () => {
  describe('buildClaudeMcpEntry', () => {
    it('includes headers with Bearer token when token is provided', () => {
      const entry = buildClaudeMcpEntry(28766, 'tok');
      expect(entry.type).toBe('http');
      expect(entry.url).toBe('http://127.0.0.1:28766/mcp');
      expect(entry.headers).toEqual({ Authorization: 'Bearer tok' });
    });

    it('omits headers when token is null', () => {
      const entry = buildClaudeMcpEntry(28765, null);
      expect(entry.type).toBe('http');
      expect(entry.url).toBe('http://127.0.0.1:28765/mcp');
      expect(entry.headers).toBeUndefined();
    });
  });

  describe('buildCopilotMcpEntry', () => {
    it('includes headers with Bearer token when token is provided', () => {
      const entry = buildCopilotMcpEntry(28766, 'tok');
      expect(entry.type).toBe('http');
      expect(entry.url).toBe('http://127.0.0.1:28766/mcp');
      expect(entry.headers).toEqual({ Authorization: 'Bearer tok' });
    });

    it('omits headers when token is null', () => {
      const entry = buildCopilotMcpEntry(28765, null);
      expect(entry.type).toBe('http');
      expect(entry.url).toBe('http://127.0.0.1:28765/mcp');
      expect(entry.headers).toBeUndefined();
    });
  });

  describe('buildOpenCodeMcpEntry', () => {
    it('includes headers with Bearer token when token is provided', () => {
      const entry = buildOpenCodeMcpEntry(28766, 'tok');
      expect(entry.type).toBe('remote');
      expect(entry.enabled).toBe(true);
      expect(entry.url).toBe('http://127.0.0.1:28766/mcp');
      expect(entry.headers).toEqual({ Authorization: 'Bearer tok' });
    });

    it('omits headers when token is null', () => {
      const entry = buildOpenCodeMcpEntry(28765, null);
      expect(entry.type).toBe('remote');
      expect(entry.enabled).toBe(true);
      expect(entry.url).toBe('http://127.0.0.1:28765/mcp');
      expect(entry.headers).toBeUndefined();
    });
  });

  describe('buildCursorMcpEntry', () => {
    it('includes headers with Bearer token when token is provided', () => {
      const entry = buildCursorMcpEntry(28766, 'tok');
      expect(entry.url).toBe('http://127.0.0.1:28766/mcp');
      expect(entry.headers).toEqual({ Authorization: 'Bearer tok' });
    });

    it('only contains url when token is null', () => {
      const entry = buildCursorMcpEntry(28765, null);
      expect(entry).toEqual({ url: 'http://127.0.0.1:28765/mcp' });
    });
  });
});
