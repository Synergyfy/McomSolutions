import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { GeographyModule } from '../src/geography/geography.module';
import { UkReferenceDataService } from '../src/geography/uk-reference-data.service';

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function numberArg(name: string): number | undefined {
  const prefix = `--${name}=`;
  const value = process.argv.find((arg) => arg.startsWith(prefix));
  if (!value) return undefined;
  const parsed = Number(value.slice(prefix.length));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

async function main() {
  const app = await NestFactory.createApplicationContext(GeographyModule, {
    logger: ['error', 'warn'],
  });

  try {
    const service = app.get(UkReferenceDataService);
    const includeAdministrative = !hasFlag('--no-ons');
    const includeMalls = !hasFlag('--no-malls');
    const mallLimit = numberArg('mall-limit');

    const result: Record<string, unknown> = {};

    if (includeAdministrative) {
      console.log('Importing ONS administrative areas...');
      result.administrative = await service.importAdministrativeAreas();
      console.log(JSON.stringify(result.administrative, null, 2));
    }

    if (includeMalls) {
      console.log('Importing OSM shopping malls...');
      result.malls = await service.importMalls(mallLimit);
      console.log(JSON.stringify(result.malls, null, 2));
    }

    console.log('Import complete.');
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
