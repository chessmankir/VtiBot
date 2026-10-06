import { Module } from '@nestjs/common';
import { LoadsModule } from '../loads/loads.module';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';

@Module({
    imports: [LoadsModule],
    controllers: [TelegramController],
    providers: [TelegramService],
    exports: [TelegramService],
})
export class TelegramModule {}
