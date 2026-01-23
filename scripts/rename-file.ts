/**
 * Script: rename-file
 *
 * Moves and/or renames a file while updating all imports in the codebase.
 * Handles .vue, .ts, .scss files.
 *
 * Usage:
 *   npm run script -- rename-file <source-path> <target-path>
 *   npm run script:dry -- rename-file <source-path> <target-path>
 *
 * Examples:
 *   npm run script -- rename-file client/src/components/Old.vue client/src/components/New.vue
 *   npm run script:dry -- rename-file client/src/utils/old.ts client/src/utils/new.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// Directories to scan for imports
const SCAN_DIRECTORIES = [
  'client/src',
  'server/src',
  'shared',
  'tests',
];

// File extensions to scan for imports
const SCANNABLE_EXTENSIONS = ['.ts', '.vue', '.js', '.tsx', '.jsx'];

// File extensions that can be renamed
const RENAMEABLE_EXTENSIONS = ['.ts', '.vue', '.scss', '.css', '.js'];

interface RenameResult {
  success: boolean;
  movedFile: boolean;
  updatedImports: string[];
  errors: string[];
  dryRun: boolean;
}

/**
 * Get all files recursively from a directory
 */
function getAllFiles(dirPath: string, extensions: string[]): string[] {
  const projectRoot = process.cwd();
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
        if (entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== 'dist-server') {
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
 * Convert a file path to possible import paths
 */
function getImportVariants(filePath: string, projectRoot: string): string[] {
  const relativePath = path.relative(projectRoot, filePath).replace(/\\/g, '/');
  const variants: string[] = [];

  // Remove extension for imports
  const withoutExt = relativePath.replace(/\.(ts|vue|js|tsx|jsx)$/, '');

  // Handle @ alias for client/src
  if (relativePath.startsWith('client/src/')) {
    const aliasPath = relativePath.replace('client/src/', '@/');
    const aliasWithoutExt = aliasPath.replace(/\.(ts|vue|js|tsx|jsx)$/, '');
    variants.push(aliasPath);
    variants.push(aliasWithoutExt);
  }

  // Handle @shared alias
  if (relativePath.startsWith('shared/')) {
    const sharedAlias = relativePath.replace('shared/', '@shared/');
    const sharedAliasWithoutExt = sharedAlias.replace(/\.(ts|vue|js|tsx|jsx)$/, '');
    variants.push(sharedAlias);
    variants.push(sharedAliasWithoutExt);
  }

  // Handle server aliases
  if (relativePath.startsWith('server/src/')) {
    const serverAliases = [
      relativePath.replace('server/src/db/', '@db/'),
      relativePath.replace('server/src/middleware/', '@middleware/'),
      relativePath.replace('server/src/routes/', '@routes/'),
      relativePath.replace('server/src/services/', '@services/'),
    ];
    for (const alias of serverAliases) {
      if (alias !== relativePath) {
        variants.push(alias);
        variants.push(alias.replace(/\.(ts|js)$/, ''));
      }
    }
  }

  // Add relative paths (full and without extension)
  variants.push(relativePath);
  variants.push(withoutExt);

  // Add just the filename (for same-directory imports like ./Modal)
  const fileName = path.basename(filePath);
  const fileNameWithoutExt = fileName.replace(/\.(ts|vue|js|tsx|jsx)$/, '');
  variants.push('./' + fileName);
  variants.push('./' + fileNameWithoutExt);

  // Add just the base name for re-exports in index.ts
  variants.push(fileNameWithoutExt);

  return [...new Set(variants)];
}

interface ImportChange {
  lineNumber: number;
  oldLine: string;
  newLine: string;
}

/**
 * Update imports in a file
 */
function updateImportsInFile(
  filePath: string,
  oldVariants: string[],
  newVariants: string[],
  projectRoot: string,
  dryRun: boolean = false
): { modified: boolean; changes: ImportChange[] } {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const changes: ImportChange[] = [];
  let modified = false;

  // Build replacement map (old -> new)
  const replacements: Map<string, string> = new Map();

  for (let i = 0; i < oldVariants.length && i < newVariants.length; i++) {
    replacements.set(oldVariants[i]!, newVariants[i]!);
  }

  // Extract component names from file paths for renaming imports
  const oldComponentName = getComponentNameFromPath(oldVariants[0] || '');
  const newComponentName = getComponentNameFromPath(newVariants[0] || '');
  const shouldRenameComponent = oldComponentName && newComponentName && oldComponentName !== newComponentName;

  // Process each line
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const originalLine = lines[lineIndex]!;
    let newLine = originalLine;

    for (const [oldPath, newPath] of replacements) {
      // Standard imports: from 'path' or from "path"
      const singleQuoteRegex = new RegExp(`(from\\s+')${escapeRegex(oldPath)}(')`, 'g');
      const doubleQuoteRegex = new RegExp(`(from\\s+")${escapeRegex(oldPath)}(")`, 'g');

      // Dynamic imports
      const dynamicSingleRegex = new RegExp(`(import\\s*\\(\\s*')${escapeRegex(oldPath)}('\\s*\\))`, 'g');
      const dynamicDoubleRegex = new RegExp(`(import\\s*\\(\\s*")${escapeRegex(oldPath)}("\\s*\\))`, 'g');

      // Re-exports
      const reExportSingleRegex = new RegExp(`(export\\s+(?:\\{[^}]*}|\\*)\\s+from\\s+')${escapeRegex(oldPath)}(')`, 'g');
      const reExportDoubleRegex = new RegExp(`(export\\s+(?:\\{[^}]*}|\\*)\\s+from\\s+")${escapeRegex(oldPath)}(")`, 'g');

      // SCSS
      const scssUseRegex = new RegExp(`(@use\\s+['"])${escapeRegex(oldPath)}(['"])`, 'g');
      const scssImportRegex = new RegExp(`(@import\\s+['"])${escapeRegex(oldPath)}(['"])`, 'g');

      newLine = newLine
        .replace(singleQuoteRegex, `$1${newPath}$2`)
        .replace(doubleQuoteRegex, `$1${newPath}$2`)
        .replace(dynamicSingleRegex, `$1${newPath}$2`)
        .replace(dynamicDoubleRegex, `$1${newPath}$2`)
        .replace(reExportSingleRegex, `$1${newPath}$2`)
        .replace(reExportDoubleRegex, `$1${newPath}$2`)
        .replace(scssUseRegex, `$1${newPath}$2`)
        .replace(scssImportRegex, `$1${newPath}$2`);
    }

    // Rename component/variable names in imports if the file was renamed
    if (shouldRenameComponent && newLine !== originalLine) {
      // Rename default import: import OldName from '...'
      const defaultImportRegex = new RegExp(`(import\\s+)${escapeRegex(oldComponentName)}(\\s+from)`, 'g');
      newLine = newLine.replace(defaultImportRegex, `$1${newComponentName}$2`);
    }

    // Also check for component usage in template (for Vue files)
    if (shouldRenameComponent && filePath.endsWith('.vue')) {
      // Rename component usage in templates: <OldName ... /> or <OldName>
      const componentOpenTagRegex = new RegExp(`(<)${escapeRegex(oldComponentName)}(\\s|>|\\/)`, 'g');
      const componentCloseTagRegex = new RegExp(`(</)${escapeRegex(oldComponentName)}(>)`, 'g');
      newLine = newLine
        .replace(componentOpenTagRegex, `$1${newComponentName}$2`)
        .replace(componentCloseTagRegex, `$1${newComponentName}$2`);
    }

    if (newLine !== originalLine) {
      modified = true;
      lines[lineIndex] = newLine;
      changes.push({
        lineNumber: lineIndex + 1,
        oldLine: originalLine.trim(),
        newLine: newLine.trim(),
      });
    }
  }

  // Only write if not in dry-run mode and there were changes
  if (modified && !dryRun) {
    fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
  }

  return { modified, changes };
}

/**
 * Extract component name from file path (e.g., '@/components/Modal.vue' -> 'Modal')
 */
function getComponentNameFromPath(filePath: string): string {
  const basename = path.basename(filePath);
  // Remove extension
  const withoutExt = basename.replace(/\.(vue|ts|js|tsx|jsx)$/, '');
  return withoutExt;
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Main rename function
 */
export function renameFile(sourcePath: string, targetPath: string, dryRun: boolean = false): RenameResult {
  const projectRoot = process.cwd();
  const result: RenameResult = {
    success: false,
    movedFile: false,
    updatedImports: [],
    errors: [],
    dryRun,
  };

  if (dryRun) {
    console.log('\n🔍 DRY-RUN MODE - No files will be modified\n');
  }

  // Resolve paths
  const absoluteSource = path.isAbsolute(sourcePath)
    ? sourcePath
    : path.join(projectRoot, sourcePath);
  const absoluteTarget = path.isAbsolute(targetPath)
    ? targetPath
    : path.join(projectRoot, targetPath);

  // Validate source exists
  if (!fs.existsSync(absoluteSource)) {
    result.errors.push(`Source file does not exist: ${sourcePath}`);
    return result;
  }

  // Validate extension
  const sourceExt = path.extname(absoluteSource);
  const targetExt = path.extname(absoluteTarget);

  if (!RENAMEABLE_EXTENSIONS.includes(sourceExt)) {
    result.errors.push(`Unsupported file extension: ${sourceExt}`);
    return result;
  }

  if (sourceExt !== targetExt) {
    result.errors.push(`Cannot change file extension from ${sourceExt} to ${targetExt}`);
    return result;
  }

  // Get import variants for old and new paths
  const oldVariants = getImportVariants(absoluteSource, projectRoot);
  const newVariants = getImportVariants(absoluteTarget, projectRoot);

  console.log('\n📂 Renaming file:');
  console.log(`   From: ${path.relative(projectRoot, absoluteSource)}`);
  console.log(`   To:   ${path.relative(projectRoot, absoluteTarget)}`);

  // Scan and update all imports
  console.log('\n🔍 Scanning for imports to update...');

  for (const dir of SCAN_DIRECTORIES) {
    const files = getAllFiles(dir, SCANNABLE_EXTENSIONS);

    for (const file of files) {
      // Don't update the source file itself
      if (file === absoluteSource) continue;

      const { modified, changes } = updateImportsInFile(file, oldVariants, newVariants, projectRoot, dryRun);

      if (modified) {
        const relativePath = path.relative(projectRoot, file);
        result.updatedImports.push(relativePath);

        if (dryRun) {
          console.log(`   [would update] ${relativePath}`);
          for (const change of changes) {
            console.log(`     L${change.lineNumber}:`);
            console.log(`       - ${change.oldLine}`);
            console.log(`       + ${change.newLine}`);
          }
        } else {
          console.log(`   ✓ Updated: ${relativePath}`);
        }
      }
    }
  }

  // Create target directory if it doesn't exist
  const targetDir = path.dirname(absoluteTarget);
  if (!fs.existsSync(targetDir)) {
    if (!dryRun) {
      fs.mkdirSync(targetDir, { recursive: true });
      console.log(`\n📁 Created directory: ${path.relative(projectRoot, targetDir)}`);
    } else {
      console.log(`\n📁 [would create directory]: ${path.relative(projectRoot, targetDir)}`);
    }
  }

  // Move the file
  if (!dryRun) {
    try {
      fs.renameSync(absoluteSource, absoluteTarget);
      result.movedFile = true;
      console.log('\n✅ File moved successfully');
    } catch (error) {
      result.errors.push(`Failed to move file: ${error}`);
      return result;
    }
  } else {
    result.movedFile = true;
    console.log('\n✅ [would move file]');
  }

  result.success = true;

  console.log(`\n📊 Summary${dryRun ? ' (DRY-RUN)' : ''}:`);
  console.log(`   - File ${dryRun ? 'would be ' : ''}moved: Yes`);
  console.log(`   - Imports ${dryRun ? 'would be ' : ''}updated: ${result.updatedImports.length}`);

  return result;
}

// CLI execution - run only when called directly
if (process.argv[1]?.includes('rename-file')) {
  const args = process.argv.slice(2);

  // Check for --dry-run flag
  const dryRunIndex = args.indexOf('--dry-run');
  const dryRun = dryRunIndex !== -1;

  // Remove --dry-run from args if present
  if (dryRun) {
    args.splice(dryRunIndex, 1);
  }

  if (args.length !== 2) {
    console.error('Usage: npm run script -- rename-file <source-path> <target-path>');
    console.error('       npm run script:dry -- rename-file <source-path> <target-path>');
    console.error('');
    console.error('Examples:');
    console.error('  npm run script -- rename-file client/src/Old.vue client/src/New.vue');
    console.error('  npm run script:dry -- rename-file client/src/Old.vue client/src/New.vue');
    process.exit(1);
  }

  const [source, target] = args;
  const result = renameFile(source!, target!, dryRun);

  if (!result.success) {
    console.error('\n❌ Errors:');
    result.errors.forEach(err => console.error(`   - ${err}`));
    process.exit(1);
  }

  if (dryRun) {
    console.log('\n💡 This was a dry-run. Use "npm run script" to apply changes.');
  }

  process.exit(0);
}
