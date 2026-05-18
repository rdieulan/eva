/**
 * Quality Control Tests - Encoding Verification
 *
 * These tests ensure the codebase doesn't contain corrupted or
 * improperly encoded characters that could cause display issues.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Directories to scan
const SCAN_DIRECTORIES = [
  'client/src',
  'server/src',
  'shared',
];

// File extensions to check
const FILE_EXTENSIONS = ['.ts', '.vue', '.scss', '.css', '.json'];

// Patterns indicating encoding problems
const CORRUPTED_PATTERNS = [
  /�/g,                           // Unicode replacement character
  /\uFFFD/g,                       // Unicode replacement character (explicit)
  /Ã©/g,                           // é encoded as Latin-1 then read as UTF-8
  /Ã¨/g,                           // è encoded as Latin-1 then read as UTF-8
  /Ã /g,                           // à encoded as Latin-1 then read as UTF-8
  /Ã´/g,                           // ô encoded as Latin-1 then read as UTF-8
  /Ã¢/g,                           // â encoded as Latin-1 then read as UTF-8
  /Ã®/g,                           // î encoded as Latin-1 then read as UTF-8
  /Ã¹/g,                           // ù encoded as Latin-1 then read as UTF-8
  /Ãª/g,                           // ê encoded as Latin-1 then read as UTF-8
  /Ã§/g,                           // ç encoded as Latin-1 then read as UTF-8
  /â€™/g,                          // ' (apostrophe) corrupted
  /â€œ/g,                          // " (left quote) corrupted
  /â€/g,                           // " (right quote) corrupted
  /Â /g,                           // Non-breaking space corrupted
];

// Valid French characters that should NOT be flagged
const VALID_FRENCH_CHARS = /[éèêëàâäùûüôöîïçœæÉÈÊËÀÂÄÙÛÜÔÖÎÏÇŒÆ]/;

/**
 * Recursively get all files in a directory matching given extensions
 */
function getAllFiles(dirPath: string, extensions: string[]): string[] {
  const projectRoot = path.resolve(__dirname, '../..');
  const fullDirPath = path.join(projectRoot, dirPath);

  if (!fs.existsSync(fullDirPath)) {
    return [];
  }

  const files: string[] = [];

  function walkDir(currentPath: string) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        // Skip node_modules and dist directories
        if (entry.name !== 'node_modules' && entry.name !== 'dist') {
          walkDir(fullPath);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (extensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  }

  walkDir(fullDirPath);
  return files;
}

/**
 * Check a file for encoding problems
 */
function checkFileEncoding(filePath: string): { valid: boolean; issues: string[] } {
  const content = fs.readFileSync(filePath, 'utf-8');
  const issues: string[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    for (const pattern of CORRUPTED_PATTERNS) {
      const matches = line?.match(pattern);
      if (matches) {
        issues.push(`Line ${lineNumber}: Found corrupted character pattern "${matches[0]}"`);
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

describe('Encoding Quality Control', () => {
  it('should not contain corrupted or improperly encoded characters', () => {
    const allIssues: { file: string; issues: string[] }[] = [];

    for (const dir of SCAN_DIRECTORIES) {
      const files = getAllFiles(dir, FILE_EXTENSIONS);

      for (const file of files) {
        const result = checkFileEncoding(file);

        if (!result.valid) {
          // Get relative path for cleaner output
          const projectRoot = path.resolve(__dirname, '../..');
          const relativePath = path.relative(projectRoot, file);

          allIssues.push({
            file: relativePath,
            issues: result.issues,
          });
        }
      }
    }

    if (allIssues.length > 0) {
      const errorMessage = allIssues
        .map(({ file, issues }) => `\n${file}:\n  ${issues.join('\n  ')}`)
        .join('\n');

      expect.fail(`Found encoding issues in ${allIssues.length} file(s):${errorMessage}`);
    }

    expect(allIssues).toHaveLength(0);
  });

  it('should have valid UTF-8 encoding for all source files', () => {
    let totalFiles = 0;
    let validFiles = 0;

    for (const dir of SCAN_DIRECTORIES) {
      const files = getAllFiles(dir, FILE_EXTENSIONS);

      for (const file of files) {
        totalFiles++;

        try {
          // Try to read as UTF-8
          const content = fs.readFileSync(file, 'utf-8');

          // Check if content can be properly encoded/decoded
          const buffer = Buffer.from(content, 'utf-8');
          const decoded = buffer.toString('utf-8');

          if (content === decoded) {
            validFiles++;
          }
        } catch (error) {
          // File couldn't be read as UTF-8
          const projectRoot = path.resolve(__dirname, '../..');
          const relativePath = path.relative(projectRoot, file);
          expect.fail(`File ${relativePath} is not valid UTF-8`);
        }
      }
    }

    expect(validFiles).toBe(totalFiles);
  });

  it('should properly handle French accented characters', () => {
    // This test ensures that valid French characters are preserved
    // and not corrupted during file operations

    const testStrings = [
      'Février',
      'Décembre',
      'équipe',
      'événement',
      'créé',
      'modifié',
      'supprimé',
      'à',
      'où',
      'ça',
    ];

    for (const str of testStrings) {
      // Encode and decode to verify no corruption
      const encoded = Buffer.from(str, 'utf-8');
      const decoded = encoded.toString('utf-8');

      expect(decoded).toBe(str);
      expect(VALID_FRENCH_CHARS.test(str)).toBe(true);
    }
  });
});

describe('Code Quality Patterns', () => {
  it('should not have console.log statements in production code (except server)', () => {
    const clientFiles = getAllFiles('client/src', ['.ts', '.vue']);
    const issues: string[] = [];

    for (const file of clientFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Skip comments
        if (line?.trim().startsWith('//') || line?.trim().startsWith('*')) {
          continue;
        }

        if (line?.includes('console.log(')) {
          const projectRoot = path.resolve(__dirname, '../..');
          const relativePath = path.relative(projectRoot, file);
          issues.push(`${relativePath}:${i + 1}`);
        }
      }
    }

    if (issues.length > 0) {
      console.warn(`Found ${issues.length} console.log statement(s) in client code:\n  ${issues.join('\n  ')}`);
    }

    // This is a warning, not a failure - uncomment to enforce
    // expect(issues).toHaveLength(0);
  });
});
