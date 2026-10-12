import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_FILES = [
  'dashboard-crash.test.mjs',
  'attendance-crash.test.mjs',
  'marks-crash.test.mjs',
  'timetable-crash.test.mjs',
  'calendar-crash.test.mjs',
  'backend-contract.test.mjs',
  'fuzz-chaos-crash.test.mjs',
  'new-user-flow.test.mjs',
];

console.log('='.repeat(70));
console.log('🚀 SRM MOBILE - APP RESILIENCE & BACKEND CRASH TEST SUITE');
console.log('='.repeat(70));
console.log(`Node Environment: ${process.version}`);
console.log(`Target Backend:   ${process.env.BACKEND_URL || 'http://localhost:5000/api'}\n`);

async function runTestFile(file) {
  const filePath = path.join(__dirname, file);
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['--test', filePath], {
      stdio: 'pipe',
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    child.on('close', (code) => {
      const pass = code === 0;
      const testsMatch = stdout.match(/tests\s+(\d+)/);
      const passMatch = stdout.match(/pass\s+(\d+)/);
      const failMatch = stdout.match(/fail\s+(\d+)/);

      resolve({
        file,
        pass,
        code,
        tests: testsMatch ? parseInt(testsMatch[1], 10) : 0,
        passed: passMatch ? parseInt(passMatch[1], 10) : 0,
        failed: failMatch ? parseInt(failMatch[1], 10) : 0,
        stdout,
        stderr,
      });
    });
  });
}

async function main() {
  const results = [];
  let totalTests = 0;
  let totalPassed = 0;
  let totalFailed = 0;

  for (const file of TEST_FILES) {
    process.stdout.write(`⏳ Running ${file.padEnd(30)} ... `);
    const res = await runTestFile(file);
    results.push(res);
    totalTests += res.tests;
    totalPassed += res.passed;
    totalFailed += res.failed;

    if (res.pass) {
      console.log(`✅ PASSED (${res.passed} tests)`);
    } else {
      console.log(`❌ FAILED (${res.failed} failures)`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('📊 TEST EXECUTION SUMMARY:');
  console.log('='.repeat(70));

  for (const r of results) {
    const statusIcon = r.pass ? '✅ PASS' : '❌ FAIL';
    console.log(` ${statusIcon.padEnd(8)} | ${r.file.padEnd(28)} | Passed: ${String(r.passed).padStart(2)} / ${String(r.tests).padStart(2)}`);
  }

  console.log('-'.repeat(70));
  console.log(` TOTAL: ${totalTests} tests run across ${TEST_FILES.length} suites.`);
  console.log(` PASSED: ${totalPassed} | FAILED: ${totalFailed}`);

  if (totalFailed > 0) {
    console.log('\n⚠️ FAILURE DETAILS:');
    for (const r of results) {
      if (!r.pass) {
        console.log(`\n--- [${r.file}] ---`);
        console.log(r.stdout || r.stderr);
      }
    }
    process.exit(1);
  } else {
    console.log('\n🎉 ALL TESTS PASSED! App parsing pipelines and crash guards are robust.');
    process.exit(0);
  }
}

main();
