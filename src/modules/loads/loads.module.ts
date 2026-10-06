import { Module } from '@nestjs/common';
import { LoadsService } from './loads.service';

@Module({
    providers: [LoadsService],
    exports: [LoadsService],
})
export class LoadsModule {}
