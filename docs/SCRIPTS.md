# EVA - Coding Agent Scripts

This document describes the utility scripts available for the coding agent to automate common refactoring and code quality tasks.

> ⚠️ **Important**: When working on this project, the coding agent MUST also refer to [CODE_RULES.md](./CODE_RULES.md) for coding conventions, naming standards, and project structure guidelines.

---

## 🚨 Règles de Comportement Obligatoires

1. **NE JAMAIS modifier** ROADMAP.md, README.md ou tout fichier de documentation sans validation explicite de l'utilisateur
2. **TOUJOURS proposer** un plan détaillé et attendre validation AVANT d'implémenter
3. **NE JAMAIS supprimer** ou écraser du contenu existant sans le montrer d'abord
4. **NE PAS agir** sur une simple interprétation - demander clarification si ambiguïté
5. **ATTENDRE la validation** avant de passer à l'étape suivante d'un plan

---

## 📂 Scripts Location

All scripts are located in `/scripts/` directory.

---

## 🚀 Available Commands

### Master Script Runner

The master script runner executes child scripts and validates changes with build + tests.

```bash
# Normal mode: executes script, then runs build + tests
npm run script -- <script-name> [args...]

# Dry-run mode: simulates changes without modifying files (skips build/tests)
npm run script:dry -- <script-name> [args...]
```

---

## 📝 Available Scripts

### `rename-file`

Moves and/or renames a file while updating all imports in the codebase.

#### Usage

```bash
# Dry-run (preview changes without modifying files)
npm run script:dry -- rename-file <source-path> <target-path>

# Execute (modify files, then build + test)
npm run script -- rename-file <source-path> <target-path>
```

#### Examples

```bash
# Preview renaming a component
npm run script:dry -- rename-file client/src/components/common/Modal.vue client/src/components/common/BaseModal.vue

# Execute renaming
npm run script -- rename-file client/src/components/common/Modal.vue client/src/components/common/BaseModal.vue

# Move a file to a different directory
npm run script -- rename-file client/src/utils/helper.ts client/src/utils/helpers/string.ts
```

#### Features

- ✅ Updates all import statements (`import ... from '...'`)
- ✅ Updates dynamic imports (`import('...')`)
- ✅ Updates re-exports (`export * from '...'`, `export { ... } from '...'`)
- ✅ Updates SCSS imports (`@use`, `@import`)
- ✅ Renames import variable names (e.g., `import OldName` → `import NewName`)
- ✅ Renames component usage in Vue templates (`<OldName>` → `<NewName>`)
- ✅ Handles all project aliases (`@/`, `@shared/`, `@db/`, etc.)
- ✅ Handles relative imports (`./`, `../`)
- ✅ Creates target directory if it doesn't exist

#### Dry-run Output

In dry-run mode, the script shows a diff for each file that would be modified:

```
🔍 Scanning for imports to update...
   [would update] client/src/pages/TeamPage.vue
     L16:
       - import Modal from '@/components/common/Modal.vue';
       + import Modal from '@/components/common/BaseModal.vue';
```

#### Supported File Types

**Files that can be renamed:**
- `.vue`, `.ts`, `.js`, `.tsx`, `.jsx`, `.scss`, `.css`

**Files scanned for imports:**
- `.vue`, `.ts`, `.js`, `.tsx`, `.jsx`

---

### `refactor`

AST-based refactoring using ts-morph for precise code transformations.

#### Usage

```bash
# Dry-run (preview changes)
npm run script:dry -- refactor <action> [options]

# Execute
npm run script -- refactor <action> [options]
```

#### Actions

##### `symbol` - Rename a symbol

Renames a variable, function, class, or any other symbol and updates all references across the project.

```bash
# Preview
npm run script:dry -- refactor symbol <file> <oldName> <newName>

# Execute
npm run script -- refactor symbol client/src/api/utils.ts authFetch authenticatedFetch
```

##### `move` - Move/rename a file

Moves or renames a file and automatically updates all imports (alternative to `rename-file` using AST).

```bash
npm run script -- refactor move <source> <target>
```

##### `unused` - Find unused exports

Scans the project for exports that are not imported anywhere.

```bash
npm run script -- refactor unused
```

#### Features

- ✅ Uses TypeScript AST for precise transformations
- ✅ Finds all references across the entire project
- ✅ Updates imports, exports, and usages
- ✅ Shows affected files before making changes
- ✅ Dry-run mode for safe previewing

---

## 🧪 Quality Control Tests

Located in `/tests/quality/`, these tests ensure code quality standards.

### Encoding Test

File: `tests/quality/encoding.test.ts`

Scans the entire codebase for corrupted or improperly encoded characters.

```bash
# Run encoding tests
npx vitest run tests/quality/encoding.test.ts
```

#### What it checks

- ✅ No Unicode replacement characters (`�`, `\uFFFD`)
- ✅ No corrupted French accents (e.g., `Ã©` instead of `é`)
- ✅ Valid UTF-8 encoding for all source files
- ✅ French accented characters are properly preserved

#### Scanned directories

- `client/src`
- `server/src`
- `shared`

---

## 🔧 Best Practices for Agent

### Before any refactoring

1. **Always commit/push first** to create a restore point
2. **Use dry-run mode** to preview changes before executing
3. **Verify the output** shows expected files and changes

### Workflow for renaming files

```bash
# 1. Preview changes
npm run script:dry -- rename-file <source> <target>

# 2. Review the diff output

# 3. If changes look correct, execute
npm run script -- rename-file <source> <target>

# 4. Script automatically runs build + tests to validate
```

### If something goes wrong

If the script fails mid-execution:
1. Run the script in reverse to undo: `npm run script -- rename-file <target> <source>`
2. Or use git to restore: `git checkout -- .` (if changes weren't committed)

---

## 📋 Adding New Scripts

To add a new script:

1. Create the script file in `/scripts/<script-name>.ts`
2. Export a main function that accepts arguments
3. Handle `--dry-run` flag for preview mode
4. Register the script in `/scripts/run.ts` in `AVAILABLE_SCRIPTS`

### Script Template

```typescript
/**
 * Script: <script-name>
 * 
 * Description of what the script does.
 * 
 * Usage:
 *   npm run script -- <script-name> [args...]
 *   npm run script:dry -- <script-name> [args...]
 */

import * as fs from 'fs';
import * as path from 'path';

export function myScript(arg1: string, arg2: string, dryRun: boolean = false): Result {
  if (dryRun) {
    console.log('\n🔍 DRY-RUN MODE - No files will be modified\n');
  }
  
  // Script logic here
  
  return { success: true, /* ... */ };
}

// CLI execution
if (process.argv[1]?.includes('<script-name>')) {
  const args = process.argv.slice(2);
  const dryRunIndex = args.indexOf('--dry-run');
  const dryRun = dryRunIndex !== -1;
  
  if (dryRun) args.splice(dryRunIndex, 1);
  
  // Parse args and call myScript()
}
```

---

## 📅 Last Updated

**Date**: 2026-01-23
