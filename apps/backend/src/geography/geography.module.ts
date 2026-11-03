import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { GeographyController } from './geography.controller';
import { PostcodeService } from './postcode.service';
import { LocationAssignmentService } from './location-assignment.service';
import { LocationAggregationService } from './location-aggregation.service';

@Module({
  imports: [PrismaModule],
  controllers: [GeographyController],
  providers: [PostcodeService, LocationAssignmentService, LocationAggregationService],
  exports: [PostcodeService, LocationAssignmentService, LocationAggregationService],
})
export class GeographyModule {}
