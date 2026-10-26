import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as readline from 'readline';
import { stdin, stdout } from 'process';

const EXPECTED_DATABASE = 'mcom_solutions';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

function assertLocalDatabaseUrl(): URL {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to run with NODE_ENV=production.');
  }

  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) throw new Error('DATABASE_URL is not set.');

  let databaseUrl: URL;
  try {
    databaseUrl = new URL(rawUrl);
  } catch {
    throw new Error('DATABASE_URL is not a valid PostgreSQL URL.');
  }

  const databaseName = decodeURIComponent(databaseUrl.pathname.replace(/^\//, ''));
  if (databaseName !== EXPECTED_DATABASE) {
    throw new Error(`Refusing to run: DATABASE_URL must target ${EXPECTED_DATABASE}.`);
  }
  if (!LOCAL_HOSTS.has(databaseUrl.hostname.toLowerCase())) {
    throw new Error('Refusing to run: database host must be localhost or loopback.');
  }
  if (!['postgres:', 'postgresql:'].includes(databaseUrl.protocol)) {
    throw new Error('DATABASE_URL must use the PostgreSQL protocol.');
  }

  return databaseUrl;
}

function ask(question: string): Promise<string> {
  const terminal = readline.createInterface({ input: stdin, output: stdout });
  return new Promise((resolve) => terminal.question(question, (answer) => {
    terminal.close();
    resolve(answer.trim());
  }));
}

function askPassword(question: string): Promise<string> {
  if (!stdin.isTTY || !stdout.isTTY) {
    return Promise.reject(new Error('Password entry requires an interactive terminal.'));
  }

  return new Promise((resolve, reject) => {
    let password = '';
    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    const restoreTerminal = () => {
      stdin.removeListener('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write('\n');
    };

    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === '\u0003') {
          restoreTerminal();
          reject(new Error('Cancelled.'));
          return;
        }
        if (char === '\r' || char === '\n') {
          restoreTerminal();
          resolve(password);
          return;
        }
        if (char === '\u007f' || char === '\b') {
          if (password.length > 0) {
            password = password.slice(0, -1);
            stdout.write('\b \b');
          }
          continue;
        }
        if (char >= ' ' && char !== '\u007f') {
          password += char;
          stdout.write('*');
        }
      }
    };

    stdin.on('data', onData);
  });
}

async function main() {
  // Validate the configured target before prompting for credentials or connecting.
  assertLocalDatabaseUrl();

  const prisma = new PrismaClient();
  try {
    const rows = await prisma.$queryRaw<Array<{ database_name: string }>>`
      SELECT current_database() AS database_name
    `;
    const actualDatabase = rows[0]?.database_name;
    if (actualDatabase !== EXPECTED_DATABASE) {
      throw new Error(`Connected database is ${actualDatabase ?? 'unknown'}; expected ${EXPECTED_DATABASE}.`);
    }
    console.log(`Confirmed local database: ${actualDatabase}`);

    const email = (await ask('Admin email: ')).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('Enter a valid email address.');
    }

    const password = await askPassword('Admin password (12+ characters; input hidden): ');
    if (password.length < 12) {
      throw new Error('Password must be at least 12 characters.');
    }

    const existing = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existing) {
      throw new Error('A user with that email already exists. No account was changed.');
    }

    const passwordHash = await bcrypt.hash(password, await bcrypt.genSalt(12));
    await prisma.user.create({
      data: {
        email,
        password: passwordHash,
        role: Role.ADMIN,
        adminRole: 'Super Admin',
      },
      select: { id: true },
    });
    console.log(`Created local admin account for ${email}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Admin bootstrap failed.');
  process.exitCode = 1;
});
