import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ProgrammeController } from './programme.controller';
import { ProgrammeUserController } from './programme-user.controller';
import { ProgrammeService } from './programme.service';

@Module({
  imports: [PrismaModule],
  controllers: [ProgrammeController, ProgrammeUserController],
  providers: [ProgrammeService],
  exports: [ProgrammeService],
})
export class ProgrammeModule {}
