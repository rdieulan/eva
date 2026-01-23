/**
 * Master Script Runner
 *
 * Executes child scripts and then runs build + tests to validate changes.
 *
 * Usage:
 *   npm run script -- <script-name> [args...]        # Normal mode
 *   npm run script:dry -- <script-name> [args...]    # Dry-run mode
 *
 * Examples:
 *   npm run script -- rename-file client/src/Old.vue client/src/New.vue
 *   npm run script:dry -- rename-file client/src/Old.vue client/src/New.vue
 *
 * Available scripts:
 *   - rename-file <source> <target>  : Rename/move a file and update imports
 */

import { spawnSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

// Scripts directory
const SCRIPTS_DIR = path.join(process.cwd(), 'scripts');

// Available scripts
const AVAILABLE_SCRIPTS: Record<string, { description: string; minArgs: number }> = {
  'rename-file': {
    description: 'Rename/move a file and update all imports',
    minArgs: 2,
  },
};

interface ScriptResult {
  success: boolean;
  scriptOutput: string;
  buildOutput?: string;
  testOutput?: string;
  errors: string[];
}

/**
 * Run a child script
 */
function runScript(scriptName: string, args: string[]): { success: boolean; output: string } {
  const scriptPath = path.join(SCRIPTS_DIR, `${scriptName}.ts`);

  if (!fs.existsSync(scriptPath)) {
    return {
      success: false,
      output: `Script not found: ${scriptName}`,
    };
  }

  try {
    const result = spawnSync('npx', ['tsx', scriptPath, ...args], {
      encoding: 'utf-8',
      stdio: 'pipe',
      shell: true,
    });

    const output = result.stdout + result.stderr;

    return {
      success: result.status === 0,
      output,
    };
  } catch (error) {
    return {
      success: false,
      output: `Error running script: ${error}`,
    };
  }
}

/**
 * Run build
 */
function runBuild(): { success: boolean; output: string } {
  console.log('\n🔨 Running build...');

  try {
    const result = spawnSync('npm', ['run', 'build'], {
      encoding: 'utf-8',
      stdio: 'pipe',
      shell: true,
    });

    const output = result.stdout + result.stderr;
    const success = result.status === 0;

    if (success) {
      console.log('   ✅ Build passed');
    } else {
      console.log('   ❌ Build failed');
    }

    return { success, output };
  } catch (error) {
    return {
      success: false,
      output: `Build error: ${error}`,
    };
  }
}

/**
 * Run tests
 */
function runTests(): { success: boolean; output: string } {
  console.log('\n🧪 Running tests...');

  try {
    const result = spawnSync('npx', ['vitest', 'run'], {
      encoding: 'utf-8',
      stdio: 'pipe',
      shell: true,
    });

    const output = result.stdout + result.stderr;
    const success = result.status === 0;

    if (success) {
      // Extract test summary
      const summaryMatch = output.match(/Test Files\s+(\d+)\s+passed.*\n\s+Tests\s+(\d+)\s+passed/);
      if (summaryMatch) {
        console.log(`   ✅ Tests passed (${summaryMatch[1]} files, ${summaryMatch[2]} tests)`);
      } else {
        console.log('   ✅ Tests passed');
      }
    } else {
      console.log('   ❌ Tests failed');
    }

    return { success, output };
  } catch (error) {
    return {
      success: false,
      output: `Test error: ${error}`,
    };
  }
}

/**
 * Print usage help
 */
function printHelp() {
  console.log('\n📜 Master Script Runner');
  console.log('========================\n');
  console.log('Usage:');
  console.log('  npm run script -- <script-name> [args...]');
  console.log('  npm run script:dry -- <script-name> [args...]  (dry-run mode)\n');
  console.log('Available scripts:');

  for (const [name, info] of Object.entries(AVAILABLE_SCRIPTS)) {
    console.log(`  ${name}`);
    console.log(`    ${info.description}`);
  }

  console.log('\nExamples:');
  console.log('  npm run script -- rename-file client/src/Old.vue client/src/New.vue');
  console.log('  npm run script:dry -- rename-file client/src/Old.vue client/src/New.vue');
}

/**
 * Main execution
 */
function main(): ScriptResult {
  const args = process.argv.slice(2);
  const result: ScriptResult = {
    success: false,
    scriptOutput: '',
    errors: [],
  };

  // Detect dry-run mode (--dry-run passed as first arg by npm run script:dry)
  const isDryRun = args[0] === '--dry-run';
  const effectiveArgs = isDryRun ? args.slice(1) : args;

  // Check for help
  if (effectiveArgs.length === 0 || effectiveArgs[0] === '--help' || effectiveArgs[0] === '-h') {
    printHelp();
    result.success = true;
    return result;
  }

  const scriptName = effectiveArgs[0]!;
  const scriptArgs = effectiveArgs.slice(1);

  // Add --dry-run flag to script args if in dry-run mode
  if (isDryRun) {
    scriptArgs.unshift('--dry-run');
  }

  // Validate script exists
  if (!AVAILABLE_SCRIPTS[scriptName]) {
    result.errors.push(`Unknown script: ${scriptName}`);
    console.error(`\n❌ Unknown script: ${scriptName}`);
    printHelp();
    return result;
  }

  // Validate args count (excluding flags from count)
  const scriptInfo = AVAILABLE_SCRIPTS[scriptName]!;
  const argsWithoutFlags = scriptArgs.filter(arg => !arg.startsWith('--'));
  if (argsWithoutFlags.length < scriptInfo.minArgs) {
    result.errors.push(`Script '${scriptName}' requires at least ${scriptInfo.minArgs} arguments`);
    console.error(`\n❌ Script '${scriptName}' requires at least ${scriptInfo.minArgs} arguments`);
    return result;
  }

  console.log('\n🚀 Master Script Runner');
  console.log('========================');

  if (isDryRun) {
    console.log('🔍 DRY-RUN MODE - Build and tests will be skipped');
  }

  // Step 1: Run the script
  console.log(`\n📌 Step 1: Running script '${scriptName}'...`);
  const scriptResult = runScript(scriptName, scriptArgs);
  result.scriptOutput = scriptResult.output;
  console.log(scriptResult.output);

  if (!scriptResult.success) {
    result.errors.push('Script execution failed');
    console.error('\n❌ Script failed. Aborting.');
    return result;
  }

  // Skip build and tests in dry-run mode
  if (isDryRun) {
    result.success = true;
    console.log('\n✅ Dry-run completed successfully!');
    console.log('💡 Use "npm run script" instead to apply changes.');
    console.log('========================\n');
    return result;
  }

  // Step 2: Run build
  console.log('\n📌 Step 2: Validating build...');
  const buildResult = runBuild();
  result.buildOutput = buildResult.output;

  if (!buildResult.success) {
    result.errors.push('Build failed after script execution');
    console.error('\n❌ Build failed. Check the output above.');
    console.error('\n💡 You may need to manually fix the issues or revert changes.');
    return result;
  }

  // Step 3: Run tests
  console.log('\n📌 Step 3: Running tests...');
  const testResult = runTests();
  result.testOutput = testResult.output;

  if (!testResult.success) {
    result.errors.push('Tests failed after script execution');
    console.error('\n❌ Tests failed. Check the output above.');
    console.error('\n💡 You may need to manually fix the issues or revert changes.');
    return result;
  }

  // Success!
  result.success = true;
  console.log('\n✅ All steps completed successfully!');
  console.log('========================\n');

  return result;
}

// CLI execution - run only when called directly
if (process.argv[1]?.includes('run.ts') || process.argv[1]?.includes('run')) {
  const result = main();
  process.exit(result.success ? 0 : 1);
}

export { main, runScript, runBuild, runTests };
