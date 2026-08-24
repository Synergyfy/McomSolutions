import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ProgrammeController } from './programme.controller';
import { ProgrammeService } from './programme.service';

@Module({
  imports: [PrismaModule],
  controllers: [ProgrammeController],
  providers: [ProgrammeService],
  exports: [ProgrammeService],
})
export class ProgrammeModule {}
