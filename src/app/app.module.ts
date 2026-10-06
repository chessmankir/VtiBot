import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import * as Joi from 'joi';
import { TelegramModule } from '../modules/telegram/telegram.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            validationSchema: Joi.object({
                PORT: Joi.number().port().default(3017),

                TELEGRAM_BOT_TOKEN: Joi.string().required(),

                TELEGRAM_CHAT_ID: Joi.string()
                    .pattern(/^-?\d+$/)
                    .required(),

                TELEGRAM_THREAD_ID: Joi.number().integer().positive().optional(),

                SELLER_API: Joi.string().required(),

                USER_TOKEN: Joi.string().required(),
            }),
        }),

        ScheduleModule.forRoot(),

        TelegramModule,
    ],
})
export class AppModule {}
