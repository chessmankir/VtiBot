import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoadsService } from '../loads/loads.service';
import { LoadTask } from '../loads/types/loads.type';

interface TelegramResponse {
    ok: boolean;
    description?: string;
    result?: {
        message_id: number;
    };
}

@Injectable()
export class TelegramService {
    private readonly logger = new Logger(TelegramService.name);
    private readonly botToken: string;
    private readonly chatId: string;

    constructor(
        private readonly configService: ConfigService,
        private readonly loadsService: LoadsService
    ) {
        this.botToken = this.configService.getOrThrow<string>('TELEGRAM_BOT_TOKEN');

        this.chatId = this.configService.getOrThrow<string>('TELEGRAM_CHAT_ID');
    }

    async sendMessage(text: string): Promise<number> {
        const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    chat_id: this.chatId,
                    text,
                    disable_web_page_preview: true,
                }),
            });

            const data = (await response.json()) as TelegramResponse;

            if (!response.ok || !data.ok || !data.result) {
                this.logger.error(`Telegram API error: ${data.description ?? response.statusText}`);

                throw new BadGatewayException(data.description ?? 'Не удалось отправить сообщение в Telegram');
            }

            this.logger.log(`Сообщение отправлено: ${data.result.message_id}`);

            return data.result.message_id;
        } catch (error) {
            if (error instanceof BadGatewayException) {
                throw error;
            }

            const message = error instanceof Error ? error.message : 'Unknown error';

            this.logger.error(`Telegram request failed: ${message}`);

            throw new BadGatewayException('Ошибка подключения к Telegram API');
        }
    }

    async sendLatestLoadErrorsReport(): Promise<{
        syncRunId: string;
        total: number;
        counts: Record<Marketplace, number>;
        messageIds: number[];
    }> {
        const { syncRunId, tasks } = await this.loadsService.getLatestRunErrorTasks();
        const counts = this.countByMarketplace(tasks);
        const messages = this.buildReportMessages(syncRunId, tasks, counts);
        const messageIds: number[] = [];

        for (const message of messages) {
            messageIds.push(await this.sendMessage(message));
        }

        return {
            syncRunId,
            total: tasks.length,
            counts,
            messageIds,
        };
    }

    private countByMarketplace(tasks: LoadTask[]): Record<Marketplace, number> {
        const counts: Record<Marketplace, number> = {
            wb: 0,
            ozon: 0,
            yamarket: 0,
            other: 0,
        };

        for (const task of tasks) {
            counts[this.getMarketplace(task.cabinetType)] += 1;
        }

        return counts;
    }

    private buildReportMessages(syncRunId: string, tasks: LoadTask[], counts: Record<Marketplace, number>): string[] {
        const blocks: string[] = [
            [
                'Ошибки последней синхронизации',
                `Sync run: ${syncRunId}`,
                '',
                `Ozon: ${counts.ozon}`,
                `WB: ${counts.wb}`,
                `Yamarket: ${counts.yamarket}`,
                ...(counts.other ? [`Другие: ${counts.other}`] : []),
            ].join('\n'),
        ];

        const sections: Array<[Marketplace, string]> = [
            ['wb', 'WB'],
            ['ozon', 'OZON'],
            ['yamarket', 'YAMARKET'],
            ['other', 'ДРУГИЕ'],
        ];

        for (const [marketplace, title] of sections) {
            const sectionTasks = tasks.filter((task) => this.getMarketplace(task.cabinetType) === marketplace);

            if (!sectionTasks.length) {
                continue;
            }

            blocks.push(`\n${title}`);

            sectionTasks.forEach((task, index) => {
                const error = task.messageError ?? task.techError?.message ?? task.techError?.code ?? 'Неизвестная ошибка';

                blocks.push(
                    [
                        `${index + 1}) ${this.truncate(task.cabinetName ?? 'Без названия', 200)}`,
                        `   ID кабинета: ${task.cabinetId ?? 'не указан'}`,
                        `   Ошибка: ${this.truncate(error, 700)}`,
                    ].join('\n')
                );
            });
        }

        return this.packMessages(blocks);
    }

    private packMessages(blocks: string[]): string[] {
        const maxLength = 3900;
        const messages: string[] = [];
        let current = '';

        for (const block of blocks) {
            const candidate = current ? `${current}\n\n${block}` : block;

            if (candidate.length <= maxLength) {
                current = candidate;
                continue;
            }

            if (current) {
                messages.push(current);
            }

            current = block;
        }

        if (current) {
            messages.push(current);
        }

        return messages;
    }

    private getMarketplace(cabinetType: string | null): Marketplace {
        const value = cabinetType?.toLowerCase() ?? '';

        if (value === 'wb' || value.includes('wildberries')) {
            return 'wb';
        }

        if (value.includes('ozon')) {
            return 'ozon';
        }

        if (value.includes('yamarket') || value.includes('yandex') || value.includes('ya_market')) {
            return 'yamarket';
        }

        return 'other';
    }

    private truncate(value: string, maxLength: number): string {
        return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}…`;
    }
}

type Marketplace = 'wb' | 'ozon' | 'yamarket' | 'other';
