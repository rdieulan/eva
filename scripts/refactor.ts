// Refactoring utilities using ts-morph for AST transformations
// Usage: npm run script -- refactor <action> [options]
// Dry mode: npm run script:dry -- refactor <action> [options]

import { Project } from 'ts-morph';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { glob } from 'glob';
import * as readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDryRun = process.argv.includes('--dry-run');
const args = process.argv.filter(arg => arg !== '--dry-run');

// ANSI colors for terminal output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  dim: '\x1b[2m',
};

// Initialize ts-morph project
function createProject(): Project {
  const project = new Project({
    tsConfigFilePath: path.resolve(__dirname, '../client/tsconfig.json'),
  });

  // Add shared and server files too
  project.addSourceFilesAtPaths([
    path.resolve(__dirname, '../shared/**/*.ts'),
    path.resolve(__dirname, '../server/src/**/*.ts'),
  ]);

  return project;
}

// ============================================
// Rename Symbol (variable, function, class, etc.)
// ============================================
async function renameSymbol(project: Project, filePath: string, oldName: string, newName: string): Promise<void> {
  const sourceFile = project.getSourceFile(filePath);

  if (!sourceFile) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }

  // Find the first identifier with the old name
  const identifier = sourceFile.getDescendants()
    .find(node => node.getText() === oldName && node.getKindName() === 'Identifier');

  if (!identifier) {
    console.error(`❌ Symbol "${oldName}" not found in ${filePath}`);
    process.exit(1);
  }

  console.log(`\n🔍 Found "${oldName}" in ${path.relative(process.cwd(), filePath)}`);

  // Find all references using the language service
  const referencedSymbols = project.getLanguageService().findReferences(identifier);

  let totalRefs = 0;
  const affectedFiles = new Set<string>();

  for (const referencedSymbol of referencedSymbols) {
    for (const reference of referencedSymbol.getReferences()) {
      totalRefs++;
      affectedFiles.add(reference.getSourceFile().getFilePath());
    }
  }

  console.log(`📁 Affected files (${affectedFiles.size}):`);
  affectedFiles.forEach(f => console.log(`   - ${path.relative(process.cwd(), f)}`));
  console.log(`📊 Total references: ${totalRefs}`);

  if (isDryRun) {
    console.log('\n🔸 DRY RUN - No .ts files modified');
    console.log(`   Would rename "${oldName}" → "${newName}" in ${affectedFiles.size} .ts file(s)`);

    // Also check .vue files in dry-run
    await updateVueFiles(oldName, newName);
    return;
  }

  // Perform the rename using the language service
  const renameLocations = project.getLanguageService().findRenameLocations(identifier);

  // Apply renames in reverse order to preserve positions
  const locationsByFile = new Map<string, { start: number; length: number }[]>();
  for (const location of renameLocations) {
    const file = location.getSourceFile().getFilePath();
    if (!locationsByFile.has(file)) {
      locationsByFile.set(file, []);
    }
    locationsByFile.get(file)!.push({
      start: location.getTextSpan().getStart(),
      length: location.getTextSpan().getLength(),
    });
  }

  for (const [file, locations] of locationsByFile) {
    const sf = project.getSourceFile(file);
    if (!sf) continue;

    // Sort in reverse order
    locations.sort((a, b) => b.start - a.start);

    for (const loc of locations) {
      sf.replaceText([loc.start, loc.start + loc.length], newName);
    }
  }

  // Save all modified files
  project.saveSync();
  console.log(`\n✅ Renamed "${oldName}" → "${newName}" in ${affectedFiles.size} .ts file(s)`);

  // Also update .vue files using regex
  await updateVueFiles(oldName, newName);
}

// ============================================
// Update .vue files using regex (interactive)
// ============================================
async function updateVueFiles(oldName: string, newName: string): Promise<void> {
  const vueFiles = glob.sync('client/src/**/*.vue', { cwd: process.cwd() });

  // Simple word boundary regex
  const regex = new RegExp(`\\b${escapeRegex(oldName)}\\b`, 'g');

  const filesToUpdate: { file: string; original: string; updated: string; matches: number }[] = [];

  for (const file of vueFiles) {
    const filePath = path.resolve(process.cwd(), file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const matches = content.match(regex);

    if (matches && matches.length > 0) {
      const updatedContent = content.replace(regex, newName);
      filesToUpdate.push({
        file,
        original: content,
        updated: updatedContent,
        matches: matches.length,
      });
    }
  }

  if (filesToUpdate.length === 0) {
    console.log('\n📁 No .vue files affected');
    return;
  }

  console.log(`\n📁 Vue files affected (${filesToUpdate.length}):`);
  filesToUpdate.forEach(({ file, matches }) => console.log(`   - ${file} (${matches} occurrence(s))`));

  if (isDryRun) {
    // Show diff for each file
    console.log('\n--- DIFF PREVIEW ---\n');
    for (const { file, original, updated } of filesToUpdate) {
      console.log(`${colors.cyan}File: ${file}${colors.reset}`);
      showDiff(original, updated);
      console.log('');
    }
    console.log(`🔸 DRY RUN - Would update ${filesToUpdate.length} .vue file(s)`);
    return;
  }

  // Interactive mode: ask for confirmation for each file
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = (question: string): Promise<string> => {
    return new Promise(resolve => rl.question(question, resolve));
  };

  let updatedCount = 0;
  let skippedCount = 0;

  for (const { file, original, updated } of filesToUpdate) {
    console.log(`\n${colors.cyan}━━━ ${file} ━━━${colors.reset}`);
    showDiff(original, updated);

    const answer = await ask(`\n${colors.yellow}Apply changes? [y/n/a/q] ${colors.reset}`);

    if (answer.toLowerCase() === 'q') {
      console.log('Aborted.');
      break;
    } else if (answer.toLowerCase() === 'a') {
      // Apply all remaining including current
      const filePath = path.resolve(process.cwd(), file);
      fs.writeFileSync(filePath, updated, 'utf-8');
      updatedCount++;

      // Find current index and apply remaining
      const currentIndex = filesToUpdate.findIndex(f => f.file === file);
      for (let i = currentIndex + 1; i < filesToUpdate.length; i++) {
        const remaining = filesToUpdate[i];
        const remainingPath = path.resolve(process.cwd(), remaining.file);
        fs.writeFileSync(remainingPath, remaining.updated, 'utf-8');
        updatedCount++;
      }
      break;
    } else if (answer.toLowerCase() === 'y') {
      const filePath = path.resolve(process.cwd(), file);
      fs.writeFileSync(filePath, updated, 'utf-8');
      updatedCount++;
    } else {
      skippedCount++;
    }
  }

  rl.close();
  console.log(`\n✅ Updated ${updatedCount} .vue file(s), skipped ${skippedCount}`);
}

// Show a simple diff between original and updated content
function showDiff(original: string, updated: string): void {
  const originalLines = original.split('\n');
  const updatedLines = updated.split('\n');

  for (let i = 0; i < originalLines.length; i++) {
    if (originalLines[i] !== updatedLines[i]) {
      const lineNum = `${i + 1}`.padStart(4);
      console.log(`${colors.dim}${lineNum}${colors.reset} ${colors.red}- ${originalLines[i]}${colors.reset}`);
      console.log(`${colors.dim}${lineNum}${colors.reset} ${colors.green}+ ${updatedLines[i]}${colors.reset}`);
    }
  }
}

// Escape special regex characters
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================
// Move and rename file with import updates
// ============================================
function moveFile(project: Project, sourcePath: string, targetPath: string): void {
  const sourceFile = project.getSourceFile(sourcePath);

  if (!sourceFile) {
    console.error(`❌ Source file not found: ${sourcePath}`);
    process.exit(1);
  }

  // Find all files that import this file
  const referencingFiles: string[] = [];
  for (const file of project.getSourceFiles()) {
    for (const imp of file.getImportDeclarations()) {
      const resolvedPath = imp.getModuleSpecifierSourceFile()?.getFilePath();
      if (resolvedPath === sourceFile.getFilePath()) {
        referencingFiles.push(file.getFilePath());
      }
    }
  }

  console.log(`\n🔍 File: ${path.relative(process.cwd(), sourcePath)}`);
  console.log(`   → ${path.relative(process.cwd(), targetPath)}`);
  console.log(`📁 Files importing this module (${referencingFiles.length}):`);
  referencingFiles.forEach(f => console.log(`   - ${path.relative(process.cwd(), f)}`));

  if (isDryRun) {
    console.log('\n🔸 DRY RUN - No changes made');
    return;
  }

  // Move the file (ts-morph updates all imports automatically)
  sourceFile.move(targetPath);

  // Save all modified files
  project.saveSync();
  console.log(`\n✅ Moved file and updated ${referencingFiles.length} import(s)`);
}

// ============================================
// Find unused exports
// ============================================
function findUnusedExports(project: Project): void {
  console.log('\n🔍 Searching for unused exports...\n');

  const unusedExports: { file: string; name: string }[] = [];

  for (const sourceFile of project.getSourceFiles()) {
    // Skip node_modules and test files
    const filePath = sourceFile.getFilePath();
    if (filePath.includes('node_modules') || filePath.includes('.test.')) continue;

    for (const exportedDeclaration of sourceFile.getExportedDeclarations()) {
      const [name, declarations] = exportedDeclaration;

      for (const declaration of declarations) {
        // Use language service to find references
        const references = project.getLanguageService().findReferences(declaration);
        let externalRefs = 0;

        for (const ref of references) {
          for (const refEntry of ref.getReferences()) {
            if (refEntry.getSourceFile().getFilePath() !== filePath) {
              externalRefs++;
            }
          }
        }

        if (externalRefs === 0) {
          unusedExports.push({
            file: path.relative(process.cwd(), filePath),
            name,
          });
        }
      }
    }
  }

  if (unusedExports.length === 0) {
    console.log('✅ No unused exports found');
    return;
  }

  console.log(`⚠️ Found ${unusedExports.length} potentially unused exports:\n`);
  unusedExports.forEach(({ file, name }) => {
    console.log(`   ${file}: ${name}`);
  });
}

// ============================================
// Main CLI
// ============================================
async function main(): Promise<void> {
  const action = args[2];

  if (isDryRun) {
    console.log('🔸 DRY RUN MODE - No files will be modified\n');
  }

  const project = createProject();

  switch (action) {
    case 'symbol': {
      // npm run script -- refactor symbol <file> <oldName> <newName>
      const filePath = args[3];
      const oldName = args[4];
      const newName = args[5];

      if (!filePath || !oldName || !newName) {
        console.error('Usage: refactor symbol <file> <oldName> <newName>');
        process.exit(1);
      }

      const absolutePath = path.resolve(process.cwd(), filePath);
      await renameSymbol(project, absolutePath, oldName, newName);
      break;
    }

    case 'move': {
      // npm run script -- refactor move <source> <target>
      const sourcePath = args[3];
      const targetPath = args[4];

      if (!sourcePath || !targetPath) {
        console.error('Usage: refactor move <source> <target>');
        process.exit(1);
      }

      const absoluteSource = path.resolve(process.cwd(), sourcePath);
      const absoluteTarget = path.resolve(process.cwd(), targetPath);
      moveFile(project, absoluteSource, absoluteTarget);
      break;
    }

    case 'unused': {
      // npm run script -- refactor unused
      findUnusedExports(project);
      break;
    }

    default:
      console.log(`
Refactoring utilities using ts-morph

Usage: npm run script -- refactor <action> [options]
       npm run script:dry -- refactor <action> [options]

Actions:
  symbol <file> <oldName> <newName>   Rename a variable/function/class and update all references
  move <source> <target>              Move/rename a file and update all imports
  unused                              Find potentially unused exports

Examples:
  npm run script:dry -- refactor symbol client/src/api/utils.ts authFetch authenticatedFetch
  npm run script -- refactor move client/src/utils/old.ts client/src/utils/new.ts
  npm run script -- refactor unused
      `);
  }
}

main();
