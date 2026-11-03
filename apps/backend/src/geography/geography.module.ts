import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { GeographyController } from './geography.controller';
import { PostcodeService } from './postcode.service';
import { LocationAssignmentService } from './location-assignment.service';
import { LocationAggregationService } from './location-aggregation.service';
import { UkReferenceDataService } from './uk-reference-data.service';

@Module({
  imports: [PrismaModule],
  controllers: [GeographyController],
  providers: [
    PostcodeService,
    LocationAssignmentService,
    LocationAggregationService,
    UkReferenceDataService,
  ],
  exports: [
    PostcodeService,
    LocationAssignmentService,
    LocationAggregationService,
    UkReferenceDataService,
  ],
})
export class GeographyModule {}
